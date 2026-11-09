import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({ from: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  createAdminClient: () => ({ from: mocks.from }),
}));

import { recordBookingSms } from "./sms-log";

const message = {
  bookingId: "booking-1", recipientMobile: "+61400000000", smsType: "confirmation" as const,
  body: "Booking confirmed.", idempotencyKey: "booking-confirmation-booking-1",
};

describe("booking SMS history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ upsert: mocks.upsert });
    mocks.upsert.mockResolvedValue({ error: null });
  });

  it("upserts an accepted logical message, clearing a previous failure", async () => {
    await recordBookingSms({ ...message, status: "accepted", providerMessageId: "sms-1" });
    expect(mocks.from).toHaveBeenCalledWith("booking_sms_log");
    expect(mocks.upsert).toHaveBeenCalledWith({
      booking_id: message.bookingId, recipient_mobile: message.recipientMobile, sms_type: "confirmation",
      body: message.body, status: "accepted", provider_message_id: "sms-1", error: null,
      idempotency_key: message.idempotencyKey, recorded_at: expect.any(String),
    }, { onConflict: "idempotency_key", ignoreDuplicates: false });
  });

  it("records failed sends without overwriting an accepted retry", async () => {
    await recordBookingSms({ ...message, status: "failed", error: "SMS unavailable" });
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      status: "failed", provider_message_id: null, error: "SMS unavailable",
    }), { onConflict: "idempotency_key", ignoreDuplicates: true });
  });

  it("surfaces persistence failures", async () => {
    mocks.upsert.mockResolvedValue({ error: { message: "Database unavailable" } });
    await expect(recordBookingSms({ ...message, status: "accepted", providerMessageId: "sms-1" }))
      .rejects.toThrow("Booking SMS history could not be saved: Database unavailable");
  });

  it("restricts SMS history to server access, cascades booking deletion and expires old records", () => {
    const sql = readFileSync("supabase/001_booking_management.sql", "utf8");
    const table = sql.slice(sql.indexOf("create table if not exists public.booking_sms_log"), sql.indexOf("create table if not exists public.booking_phone_verifications"));
    expect(table).toContain("references public.bookings(id) on delete cascade");
    expect(table).toContain("idempotency_key text not null unique");
    expect(table).toContain("enable row level security");
    expect(table).toContain("revoke all on public.booking_sms_log from anon, authenticated");
    expect(table).not.toContain("'otp'");
    expect(table).toContain("'dropoff_reminder'");
    expect(table).toContain("drop constraint if exists booking_sms_log_sms_type_check");
    expect(sql).toContain("add column if not exists dropoff_sms_sent_at");
    expect(sql).toContain("add column if not exists dropoff_sms_claimed_at");
    expect(sql).toContain("delete from public.booking_sms_log where recorded_at < now() - interval '30 days'");
  });
});
