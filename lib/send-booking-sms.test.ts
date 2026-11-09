import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ send: vi.fn(), record: vi.fn(), calendar: vi.fn() }));
vi.mock("@/lib/sms-provider", () => ({ createSmsProvider: () => ({ send: mocks.send }) }));
vi.mock("@/lib/sms-log", () => ({ recordBookingSms: mocks.record }));
vi.mock("@/lib/booking-calendar-access", () => ({ ensureBookingCalendarLink: mocks.calendar }));

import { sendBookingConfirmationSms, sendDepositAttentionSms, sendPickupReminderSms, sendDropoffReminderSms } from "./send-booking-sms";
import { buildDepositAttentionSms, buildDropoffReminderSms } from "./sms-messages";

describe("deposit attention SMS delivery", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.send.mockResolvedValue({ id: "sms-1" });
    mocks.record.mockResolvedValue(undefined);
    mocks.calendar.mockResolvedValue(`https://www.peppermintaudio.com.au/calendar/${"a".repeat(22)}`);
    vi.stubEnv("SUPABASE_TARGET", "hosted");
    vi.stubEnv("NODE_ENV", "production");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("normalizes the mobile and uses a stable booking-level idempotency key", async () => {
    const booking = { id: "booking-1", mobile: "0400 000 000" };
    await expect(sendDepositAttentionSms(booking)).resolves.toEqual({ id: "sms-1" });
    await sendDepositAttentionSms(booking);
    expect(mocks.send).toHaveBeenNthCalledWith(1, {
      to: "+61400000000",
      body: buildDepositAttentionSms(),
    }, { idempotencyKey: "deposit-attention-booking-1" });
    expect(mocks.send.mock.calls[1]).toEqual(mocks.send.mock.calls[0]);
  });

  it("rejects an invalid mobile without contacting the provider", async () => {
    await expect(sendDepositAttentionSms({ id: "booking-1", mobile: "invalid" })).rejects.toThrow("Australian mobile");
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("surfaces provider failures for the caller to retry", async () => {
    mocks.send.mockRejectedValue(new Error("SMS unavailable"));
    await expect(sendDepositAttentionSms({ id: "booking-1", mobile: "0400000000" })).rejects.toThrow("SMS unavailable");
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({
      status: "failed", error: "SMS unavailable", smsType: "deposit_attention", recipientMobile: "0400000000",
    }));
  });

  it("records each kind of booking SMS with its submitted text and provider ID", async () => {
    const booking = { id: "booking-1", mobile: "0400000000", pickup_date: "2026-11-14" };
    await sendBookingConfirmationSms(booking);
    await sendPickupReminderSms(booking);
    await sendDepositAttentionSms(booking);
    expect(mocks.record.mock.calls.map(([log]) => log.smsType)).toEqual(["confirmation", "pickup_reminder", "deposit_attention"]);
    for (const [log] of mocks.record.mock.calls) {
      expect(log).toEqual(expect.objectContaining({
        bookingId: booking.id, recipientMobile: booking.mobile, status: "accepted", providerMessageId: "sms-1",
        body: expect.not.stringContaining("{optout}"),
      }));
    }
  });

  it("allows three parts only for pickup details and forwards deposit failure reasons", async () => {
    await sendPickupReminderSms({ id: "booking-1", mobile: "0400000000", pickup_date: "2026-11-14", pickup_time: "10:00" });
    expect(mocks.send).toHaveBeenLastCalledWith(expect.objectContaining({ maxParts: 3 }),
      { idempotencyKey: "pickup-reminder-booking-1-2026-11-14" });
    await sendDepositAttentionSms({
      id: "booking-1", mobile: "0400000000", deposit_payment_status: "failed",
      deposit_error: "[decline_code: insufficient_funds] Internal",
    });
    expect(mocks.send).toHaveBeenLastCalledWith(expect.objectContaining({
      body: expect.stringContaining("Deposit hold failed: insufficient funds."),
    }), { idempotencyKey: "deposit-attention-booking-1" });
    expect(mocks.send.mock.calls[1][0]).not.toHaveProperty("maxParts");
  });

  it("logs the designated local test recipient rather than claiming the customer was contacted", async () => {
    vi.stubEnv("SUPABASE_TARGET", "local");
    vi.stubEnv("LOCAL_SMS_TEST_RECIPIENT", "0411111111");
    await sendDepositAttentionSms({ id: "booking-1", mobile: "0400000000" });
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ recipientMobile: "0411111111" }));
  });

  it("sends and records drop-off reminders with three-part allowance and stable return-date idempotency", async () => {
    const booking = { id: "booking-1", mobile: "0400000000", dropoff_date: "2026-11-14", dropoff_time: "18:00" };
    await sendDropoffReminderSms(booking);
    expect(mocks.send).toHaveBeenCalledWith({
      to: "+61400000000", body: buildDropoffReminderSms(booking), maxParts: 3,
    }, { idempotencyKey: "dropoff-reminder-booking-1-2026-11-14" });
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({
      smsType: "dropoff_reminder", body: buildDropoffReminderSms(booking), status: "accepted",
    }));
  });

  it("adds a stable private calendar link to confirmation SMS with two-part allowance", async () => {
    await sendBookingConfirmationSms({ id: "booking-1", mobile: "0400000000", pickup_date: "2026-11-14" });
    expect(mocks.calendar).toHaveBeenCalledWith("booking-1");
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining(`\n\nAdd pickup & drop-off to your calendar: https://www.peppermintaudio.com.au/calendar/${"a".repeat(22)}`),
      maxParts: 2,
    }), { idempotencyKey: "booking-confirmation-booking-1" });
  });

  it("does not send a confirmation with a broken calendar link if persistence fails", async () => {
    mocks.calendar.mockRejectedValueOnce(new Error("Calendar link unavailable"));
    await expect(sendBookingConfirmationSms({ id: "booking-1", mobile: "0400000000", pickup_date: "2026-11-14" }))
      .rejects.toThrow("Calendar link unavailable");
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("surfaces persistence failure after acceptance without recording a failed send", async () => {
    mocks.record.mockRejectedValue(new Error("History unavailable"));
    await expect(sendDepositAttentionSms({ id: "booking-1", mobile: "0400000000" })).rejects.toThrow("History unavailable");
    expect(mocks.record).toHaveBeenCalledTimes(1);
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ status: "accepted" }));
  });

  it("preserves both errors if sending and history persistence fail", async () => {
    mocks.send.mockRejectedValue(new Error("SMS unavailable"));
    mocks.record.mockRejectedValue(new Error("History unavailable"));
    await expect(sendDepositAttentionSms({ id: "booking-1", mobile: "0400000000" })).rejects.toThrow(AggregateError);
  });
});
