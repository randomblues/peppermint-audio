import { describe, expect, it } from "vitest";
import {
  buildBookingConfirmationSms,
  buildDepositAttentionSms,
  buildPhoneVerificationSms,
  buildPickupReminderSms,
  buildDropoffReminderSms,
} from "./sms-messages";

describe("transactional SMS copy", () => {
  it("keeps verification messages concise and time limited", () => {
    const message = buildPhoneVerificationSms("123456");
    expect(message).toContain("123456");
    expect(message).toContain("expires in 5 minutes");
    expect(message).not.toMatch(/optout|Opt out|Reply Stop/);
    expect(message.length).toBeLessThanOrEqual(160);
  });

  it("confirms the booking and pickup without exposing extra booking details", () => {
    const message = buildBookingConfirmationSms({
      id: "12345678-1234-1234-1234-123456789012",
      pickup_date: "2026-11-14",
      pickup_time: "10:00:00",
    }, `https://www.peppermintaudio.com.au/calendar/${"a".repeat(22)}`);
    expect(message).toContain("Booking confirmed");
    expect(message).toContain("Sat, 14 Nov 10:00");
    expect(message).toContain("Reply here");
    expect(message).not.toMatch(/optout|Opt out|Reply Stop/);
    expect(message).toContain("\n\nAdd pickup & drop-off to your calendar:");
    expect(message.length).toBeGreaterThan(160);
    expect(message.length).toBeLessThanOrEqual(306);
  });

  it("uses the exact approved pickup copy within three parts", () => {
    const message = buildPickupReminderSms({ pickup_date: "2026-11-14", pickup_time: "10:00:00" }, new Date("2026-11-13T22:00:00Z"));
    expect(message).toBe("Peppermint Audio: Hi! Your pickup is today at 10:00 AM, as requested. We're at 181 Nicholson St, Abbotsford. Please bring suitable transport in case you're collecting larger equipment.\n\nPlease note: Peppermint Audio is a small business operating from a private residence. Please respect the property and message or call 0452 316 823 upon arrival. In case you're running late or need to change your scheduled pickup time, please contact us beforehand.");
    expect(message.length).toBe(450);
    expect(message).not.toMatch(/photo ID|30 mins|30 minutes/i);
  });

  it("includes the actual date for pickups beyond tomorrow within three parts", () => {
    const message = buildPickupReminderSms({ pickup_date: "2026-11-14", pickup_time: "10:00:00" }, new Date("2026-11-09T00:00:00Z"));
    expect(message).toContain("Peppermint Audio: Hi! Your pickup is on 14 Nov at 10:00 AM, as requested.");
    expect(message).toContain("181 Nicholson St, Abbotsford");
    expect(message).toContain("Please note: Peppermint Audio is a small business operating from a private residence.");
    expect(message).toContain("Please bring suitable transport");
    expect(message).not.toMatch(/photo ID/i);
    expect(message).toContain("message or call 0452 316 823 upon arrival. In case you're running late or need to change your scheduled pickup time, please contact us beforehand.");
    expect(message).not.toMatch(/tomorrow|today|optout|Opt out|Reply Stop/);
    expect(message.length).toBeGreaterThan(306);
    expect(message.length).toBeLessThanOrEqual(459);
    expect(message).toMatch(/^[\x20-\x7e\n]+$/);
  });

  it.each([
    ["2026-11-14", "2026-11-13T12:59:00Z", "tomorrow"],
    ["2026-11-14", "2026-11-13T13:00:00Z", "today"],
    ["2026-10-04", "2026-10-03T16:30:00Z", "today"],
    ["2026-10-05", "2026-10-03T16:30:00Z", "tomorrow"],
    ["2027-04-05", "2027-04-04T13:30:00Z", "tomorrow"],
    ["2027-01-01", "2026-12-31T08:00:00Z", "tomorrow"],
  ])("describes pickup on %s at %s as %s in Melbourne", (pickupDate, now, day) => {
    const message = buildPickupReminderSms({ pickup_date: pickupDate, pickup_time: "10:00:00" }, new Date(now));
    expect(message).toContain(`Peppermint Audio: Hi! Your pickup is ${day} at 10:00 AM, as requested.`);
    expect(message.length).toBeLessThanOrEqual(459);
  });

  it("omits a missing pickup time without inventing one", () => {
    const message = buildPickupReminderSms({ pickup_date: "2026-11-14" }, new Date("2026-11-13T22:00:00Z"));
    expect(message).toContain("Your pickup is today, as requested.");
    expect(message).not.toContain("undefined");
  });

  it.each([
    ["00:00", "12:00 AM"],
    ["07:30:00", "7:30 AM"],
    ["12:00", "12:00 PM"],
    ["13:45:00", "1:45 PM"],
    ["23:59", "11:59 PM"],
  ])("formats %s as %s without changing the requested local time", (time, expected) => {
    expect(buildPickupReminderSms({ pickup_date: "2026-11-14", pickup_time: time }, new Date("2026-11-13T22:00:00Z")))
      .toContain(`today at ${expected}, as requested.`);
  });

  it.each(["25:00", "10:60", "invalid"])("rejects an invalid pickup time: %s", time => {
    expect(() => buildPickupReminderSms({ pickup_date: "2026-11-14", pickup_time: time }))
      .toThrow("Booking SMS requires a valid scheduled time.");
  });

  it("keeps every weekday and month combination within three parts", () => {
    const now = new Date("2026-11-09T00:00:00Z");
    for (let day = 0; day < 365; day++) {
      const pickupDate = new Date(Date.UTC(2027, 0, 1 + day)).toISOString().slice(0, 10);
      const message = buildPickupReminderSms({ pickup_date: pickupDate, pickup_time: "10:00" }, now);
      expect(message.length, pickupDate).toBeLessThanOrEqual(459);
      expect(message).toMatch(/^[\x20-\x7e\n]+$/);
      const dropoff = buildDropoffReminderSms({ dropoff_date: pickupDate, dropoff_time: "18:00" }, now);
      expect(dropoff.length, pickupDate).toBeLessThanOrEqual(459);
      expect(dropoff).toMatch(/^[\x20-\x7e\n]+$/);
    }
  });

  it("uses the exact approved drop-off copy without the residence notice", () => {
    const message = buildDropoffReminderSms({ dropoff_date: "2026-11-14", dropoff_time: "18:00:00" }, new Date("2026-11-13T22:00:00Z"));
    expect(message).toBe("Peppermint Audio: Hi! Your equipment drop-off is today at 6:00 PM, as scheduled. Please check that all hired equipment, cables and accessories are accounted for and packed before returning them.\n\nMessage or call 0452 316 823 upon arrival or in case you're running late or need to change your scheduled drop-off time to avoid a late drop-off fee.");
    expect(message).not.toMatch(/residence|photo ID|optout/i);
    expect(message.length).toBeGreaterThan(306);
    expect(message.length).toBeLessThanOrEqual(459);
    expect(message).not.toContain("181 Nicholson St");
  });

  it("uses tomorrow for an early return reminder sent the previous evening", () => {
    const message = buildDropoffReminderSms({ dropoff_date: "2026-11-14", dropoff_time: "07:30" }, new Date("2026-11-13T18:00:00+11:00"));
    expect(message).toContain("drop-off is tomorrow at 7:30 AM");
  });

  it("asks customers to resolve their deposit before pickup without exposing payment diagnostics", () => {
    const message = buildDepositAttentionSms();
    expect(message).toContain("security deposit needs attention");
    expect(message).toContain("Check your email");
    expect(message).toContain("before pickup");
    expect(message).toContain("Reply for help");
    expect(message).not.toMatch(/optout|Opt out|Reply Stop/);
    expect(message).not.toMatch(/Stripe|decline_code|payment_intent|https?:/);
    expect(message.length).toBeLessThanOrEqual(160);
    expect(message).toMatch(/^[\x20-\x7e]+$/);
  });

  it.each([
    ["insufficient_funds", "insufficient funds"],
    ["expired_card", "the saved card has expired"],
    ["incorrect_cvc", "the card security code could not be verified"],
    ["card_not_supported", "the card is not supported"],
    ["do_not_honor", "your bank declined it"],
    ["generic_decline", "your bank declined it"],
    ["transaction_not_allowed", "your bank did not allow this hold"],
    ["restricted_card", "your bank restricted the card"],
    ["issuer_not_available", "your bank could not be reached"],
    ["processing_error", "a card processing error"],
    ["try_again_later", "your bank could not approve it just now"],
  ])("includes only the safe explanation for %s", (code, reason) => {
    const message = buildDepositAttentionSms({ deposit_payment_status: "failed", deposit_error: `[decline_code: ${code}] Private diagnostic` });
    expect(message).toContain(`Deposit hold failed: ${reason}.`);
    expect(message).toContain("before pickup");
    expect(message).not.toContain("Private diagnostic");
    expect(message).not.toContain("decline_code");
    expect(message.length).toBeLessThanOrEqual(160);
  });

  it.each([
    ["action_required", "Your bank needs you to verify the deposit hold."],
    ["expired", "Your security-deposit hold has expired."],
    ["hold_too_short", "Your deposit hold does not cover the hire period."],
  ])("explains %s without inventing a decline reason", (status, reason) => {
    const message = buildDepositAttentionSms({ deposit_payment_status: status, deposit_error: "[decline_code: insufficient_funds] Stale diagnostic" });
    expect(message).toContain(reason);
    expect(message).not.toContain("insufficient funds");
    expect(message.length).toBeLessThanOrEqual(160);
  });

  it("uses a generic message for unknown reasons but recognises a recorded insufficient-funds explanation", () => {
    expect(buildDepositAttentionSms({ deposit_payment_status: "failed", deposit_error: "[decline_code: unknown] Secret" }))
      .toContain("Your security deposit needs attention.");
    expect(buildDepositAttentionSms({ deposit_payment_status: "failed", deposit_error: "Your card has insufficient funds." }))
      .toContain("Deposit hold failed: insufficient funds.");
    expect(buildDepositAttentionSms({ deposit_payment_status: "failed", deposit_error: "[decline_code: constructor]" }))
      .toContain("Your security deposit needs attention.");
  });
});
