import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  send: vi.fn(),
  recordCustomerEmail: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("resend", () => ({ Resend: vi.fn(() => ({ emails: { send: mocks.send } })) }));
vi.mock("@/lib/email-log", () => ({ recordCustomerEmail: mocks.recordCustomerEmail }));

import { createAdminClient } from "@/lib/supabase";
import { sendDuePickupReminderEmail, sendPickupReminderEmail, type TrackedPickupReminderBooking } from "./send-pickup-reminder";

const booking: TrackedPickupReminderBooking = {
  id: "booking-1",
  email: "customer@example.com",
  first_name: "Alex",
  last_name: "Customer",
  status: "confirmed",
  event_type: "Party",
  pickup_date: "2026-11-15",
  pickup_time: "10:00",
  hire_line_items: [],
  additional_details: null,
  reminder_sent_at: null,
};

function client(overrides: Partial<TrackedPickupReminderBooking> = {}) {
  const read = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { ...booking, ...overrides }, error: null }),
  };
  const update = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: booking.id }, error: null }),
  };
  const from = vi.fn((table: string) => {
    expect(table).toBe("bookings");
    return { select: vi.fn(() => read), update: vi.fn((values) => {
      update.update(values);
      return update;
    }) };
  });
  mocks.createAdminClient.mockReturnValue({ from });
  return { admin: createAdminClient(), read, update };
}

describe("automatic pickup reminder email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-14T09:00:00Z"));
    vi.stubEnv("SUPABASE_TARGET", "");
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("ENQUIRY_FROM_EMAIL", "Peppermint Audio <from@example.com>");
    mocks.send.mockResolvedValue({ data: { id: "email-1" }, error: null });
    mocks.recordCustomerEmail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it.each([
    ["2026-11-14T09:00:00Z", "2026-11-15"],
    ["2026-05-14T09:00:00Z", "2026-05-15"],
    ["2026-11-14T13:15:00Z", "2026-11-15"],
    ["2026-11-14T22:00:00Z", "2026-11-15"],
  ])("sends automatically for an imminent pickup when confirmed at %s", async (now, pickupDate) => {
    vi.setSystemTime(new Date(now));
    const { admin, update } = client({ pickup_date: pickupDate });

    await expect(sendDuePickupReminderEmail(admin, booking.id)).resolves.toBe(true);

    expect(mocks.send).toHaveBeenCalledOnce();
    const email = mocks.send.mock.calls[0][0];
    expect(email.to).toEqual(["customer@example.com"]);
    expect(email.text).toContain("Your pickup is on");
    expect(email.text).not.toContain("tomorrow");
    expect(email.html).toContain("Your pickup details");
    expect(update.update).toHaveBeenCalledWith({
      reminder_sent_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    });
    expect(mocks.recordCustomerEmail).toHaveBeenCalledWith(admin, expect.objectContaining({
      bookingId: booking.id, emailType: "pickup_reminder", providerMessageId: "email-1",
    }));
  });

  it.each<Partial<TrackedPickupReminderBooking>>([
    { status: "submitted" },
    { status: "cancelled" },
    { status: "completed" },
    { pickup_date: "2026-11-16" },
    { pickup_date: "2026-11-13" },
    { reminder_sent_at: "2026-11-14T01:00:00Z" },
  ])("skips an ineligible or already reminded booking: %j", async (overrides) => {
    const { admin, update } = client(overrides);

    await expect(sendDuePickupReminderEmail(admin, booking.id)).resolves.toBe(false);

    expect(mocks.send).not.toHaveBeenCalled();
    expect(update.update).not.toHaveBeenCalled();
    expect(mocks.recordCustomerEmail).not.toHaveBeenCalled();
  });

  it("does not resend after a successfully tracked confirmation reminder", async () => {
    const { admin, read } = client();
    await sendDuePickupReminderEmail(admin, booking.id);
    read.single.mockResolvedValue({
      data: { ...booking, reminder_sent_at: new Date().toISOString() }, error: null,
    });

    await expect(sendDuePickupReminderEmail(admin, booking.id)).resolves.toBe(false);
    expect(mocks.send).toHaveBeenCalledOnce();
  });

  it("uses identical delivery requests across midnight when tracking needs a retry", async () => {
    const { admin, update } = client();
    update.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "database down" } });

    await expect(sendDuePickupReminderEmail(admin, booking.id)).rejects.toThrow("Reminder sent but could not be marked");
    expect(mocks.recordCustomerEmail).not.toHaveBeenCalled();
    vi.setSystemTime(new Date("2026-11-14T13:15:00Z"));
    await expect(sendDuePickupReminderEmail(admin, booking.id)).resolves.toBe(true);

    expect(mocks.send.mock.calls[0]).toEqual(mocks.send.mock.calls[1]);
    expect(mocks.send.mock.calls[1][1]).toEqual({
      idempotencyKey: "pickup-reminder-booking-1-2026-11-15",
    });
    expect(mocks.recordCustomerEmail).toHaveBeenCalledOnce();
  });

  it("shares the provider delivery key and records history once when cron and confirmation overlap", async () => {
    const { admin, update } = client();
    update.maybeSingle.mockResolvedValueOnce({ data: { id: booking.id }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    const sent = await Promise.all([
      sendPickupReminderEmail(admin, booking),
      sendDuePickupReminderEmail(admin, booking.id),
    ]);

    expect(sent.sort()).toEqual([false, true]);
    expect(mocks.send.mock.calls[0]).toEqual(mocks.send.mock.calls[1]);
    expect(mocks.recordCustomerEmail).toHaveBeenCalledOnce();
    expect(update.is).toHaveBeenCalledWith("reminder_sent_at", null);
  });

  it("does not mark a provider failure and can retry automatically", async () => {
    const { admin, update } = client();
    mocks.send.mockResolvedValueOnce({ data: null, error: { message: "provider down" } });

    await expect(sendDuePickupReminderEmail(admin, booking.id)).rejects.toThrow("provider down");
    expect(update.update).not.toHaveBeenCalled();
    expect(mocks.recordCustomerEmail).not.toHaveBeenCalled();
    await expect(sendDuePickupReminderEmail(admin, booking.id)).resolves.toBe(true);
  });

  it("surfaces lookup, configuration and history failures", async () => {
    const { admin, read } = client();
    read.single.mockResolvedValueOnce({ data: null, error: { message: "database unavailable" } });
    await expect(sendDuePickupReminderEmail(admin, booking.id)).rejects.toThrow("database unavailable");
    read.single.mockResolvedValueOnce({ data: null, error: null });
    await expect(sendDuePickupReminderEmail(admin, booking.id)).rejects.toThrow("could not be found");
    expect(mocks.send).not.toHaveBeenCalled();

    vi.stubEnv("RESEND_API_KEY", "");
    await expect(sendDuePickupReminderEmail(admin, booking.id)).rejects.toThrow("Email service is not configured.");
    vi.stubEnv("RESEND_API_KEY", "test-key");
    mocks.recordCustomerEmail.mockRejectedValueOnce(new Error("history unavailable"));
    await expect(sendDuePickupReminderEmail(admin, booking.id)).rejects.toThrow("history unavailable");
  });
});
