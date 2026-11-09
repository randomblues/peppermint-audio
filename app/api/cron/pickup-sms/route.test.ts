import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PickupSmsBooking } from "@/lib/pickup-sms";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), send: vi.fn(), selection: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/send-booking-sms", () => ({ sendPickupReminderSms: mocks.send }));
import { GET } from "./route";
import { sendDuePickupReminderSms } from "@/lib/booking-sms-cron";

const now = new Date("2026-11-09T21:00:00Z");
let booking: PickupSmsBooking;

function configure(options: { queryError?: boolean; claimError?: boolean; trackingError?: boolean; releaseError?: boolean; changed?: boolean } = {}) {
  const updates: Record<string, unknown>[] = [];
  mocks.admin.mockReturnValue({
    from: vi.fn(() => {
      let values: Record<string, unknown> | null = null;
      const filters: [string, unknown][] = [];
      const query = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn((field: string, value: unknown) => {
          if (!values) mocks.selection(field, value);
          filters.push([field, value]); return query;
        }),
        is: vi.fn((field: string, value: unknown) => { filters.push([field, value]); return query; }),
        update: vi.fn((value: Record<string, unknown>) => { values = value; updates.push(value); return query; }),
        maybeSingle: vi.fn(async () => {
          if (!values) throw new Error("Expected an update.");
          const claim = typeof values.pickup_sms_claimed_at === "string";
          const tracking = "pickup_sms_sent_at" in values;
          if ((claim && options.claimError) || (tracking && options.trackingError) || (!claim && !tracking && options.releaseError)) {
            return { data: null, error: { message: "Database unavailable" } };
          }
          if (options.changed || !filters.every(([field, value]) => booking[field as keyof PickupSmsBooking] === value)) {
            return { data: null, error: null };
          }
          Object.assign(booking, values);
          return { data: { id: booking.id }, error: null };
        }),
        then: (resolve: (value: object) => unknown) => Promise.resolve({
          data: options.queryError ? null : [{ ...booking }],
          error: options.queryError ? { message: "Query unavailable" } : null,
        }).then(resolve),
      };
      return query;
    }),
  });
  return updates;
}

function request(authorized = true) {
  return new Request("http://localhost/api/cron/pickup-sms", {
    headers: authorized ? { authorization: `Bearer ${process.env.CRON_SECRET}` } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.stubEnv("CRON_SECRET", "test-cron-secret");
  booking = {
    id: "booking-1", mobile: "0400000000", status: "confirmed",
    pickup_date: "2026-11-10", pickup_time: "10:00:00",
    payment_method: "stripe_card_hold", hire_payment_status: "paid",
    security_deposit_cents: 10000, deposit_payment_status: "authorized",
    deposit_capture_before: "2026-11-12T00:00:00Z", pickup_sms_sent_at: null, pickup_sms_claimed_at: null,
  };
  mocks.send.mockResolvedValue({ id: "sms-1" });
  configure();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("pickup SMS cron", () => {
  it("requires the cron secret", async () => {
    expect((await GET(request(false))).status).toBe(401);
    expect(mocks.admin).not.toHaveBeenCalled();
  });

  it("sends a due SMS once, tracks it and skips later invocations", async () => {
    expect(await (await GET(request())).json()).toEqual({ selected: 1, sent: 1, failures: [] });
    expect(booking.pickup_sms_sent_at).toBe(now.toISOString());
    expect(booking.pickup_sms_claimed_at).toBeNull();
    await GET(request());
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it("prevents duplicate sends when cron invocations overlap or use stale rows", async () => {
    await Promise.all([GET(request()), GET(request())]);
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it("skips a claimed row, then recovers an abandoned claim", async () => {
    booking.pickup_sms_claimed_at = now.toISOString();
    await GET(request());
    expect(mocks.send).not.toHaveBeenCalled();
    booking.pickup_sms_claimed_at = new Date(now.getTime() - 16 * 60000).toISOString();
    await GET(request());
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it("leaves an unpaid Stripe deposit pending for a later invocation before pickup", async () => {
    booking.deposit_payment_status = "scheduled";
    await GET(request());
    expect(mocks.send).not.toHaveBeenCalled();
    booking.deposit_payment_status = "authorized";
    vi.setSystemTime(new Date("2026-11-09T22:15:00Z"));
    configure();
    expect((await GET(request())).status).toBe(200);
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it("does not send after pickup or to cancelled bookings", async () => {
    booking.pickup_time = "08:00";
    await GET(request());
    booking.pickup_time = "10:00";
    booking.status = "cancelled";
    await GET(request());
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("does not send if the booking changed before the notification claim", async () => {
    configure({ changed: true });
    await GET(request());
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("surfaces query errors without sending", async () => {
    configure({ queryError: true });
    expect((await GET(request())).status).toBe(500);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it.each(["claimError", "trackingError", "releaseError"] as const)("surfaces %s rather than a success-shaped response", async failure => {
    configure({ [failure]: true });
    if (failure === "releaseError") mocks.send.mockRejectedValueOnce(new Error("Provider unavailable"));
    const response = await GET(request());
    expect(response.status).toBe(502);
    expect((await response.json()).failures.length).toBeGreaterThan(0);
  });

  it("releases a failed send claim so the next run can retry", async () => {
    mocks.send.mockRejectedValueOnce(new Error("Provider unavailable"));
    expect((await GET(request())).status).toBe(502);
    expect(booking.pickup_sms_sent_at).toBeNull();
    expect(booking.pickup_sms_claimed_at).toBeNull();
    expect((await GET(request())).status).toBe(200);
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });

  it("reports invalid pickup times instead of silently sending misleading details", async () => {
    booking.pickup_time = null;
    expect((await GET(request())).status).toBe(502);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("targets only the paid booking for an event-driven catch-up and shares cron duplicate protection", async () => {
    await Promise.all([sendDuePickupReminderSms(booking.id), GET(request())]);
    expect(mocks.selection).toHaveBeenCalledWith("id", booking.id);
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it("waits until the morning window for an ordinary pickup's deposit event", async () => {
    vi.setSystemTime(new Date("2026-11-10T07:30:00+11:00"));
    await sendDuePickupReminderSms(booking.id);
    expect(mocks.send).not.toHaveBeenCalled();
    vi.setSystemTime(new Date("2026-11-10T09:15:00+11:00"));
    await sendDuePickupReminderSms(booking.id);
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it("surfaces event-driven catch-up errors for provider retries", async () => {
    configure({ trackingError: true });
    await expect(sendDuePickupReminderSms(booking.id)).rejects.toThrow("Pending pickup SMS could not be sent or tracked.");
  });
});
