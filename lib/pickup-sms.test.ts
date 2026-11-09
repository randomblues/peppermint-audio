import { describe, expect, it } from "vitest";
import { isPickupSmsDue, type PickupSmsBooking } from "./pickup-sms";

const booking: PickupSmsBooking = {
  id: "booking-1", mobile: "0400000000", status: "confirmed",
  pickup_date: "2026-11-10", pickup_time: "10:00:00",
  payment_method: "stripe_card_hold", hire_payment_status: "paid", security_deposit_cents: 10000,
  deposit_payment_status: "authorized", deposit_capture_before: "2026-11-13T00:00:00Z",
  pickup_sms_sent_at: null, pickup_sms_claimed_at: null,
};
const at = (time: string) => new Date(`2026-11-10T${time}:00+11:00`);

describe("Melbourne pickup SMS scheduling", () => {
  it("starts at 8am on pickup day and stops at the requested pickup time", () => {
    expect(isPickupSmsDue(booking, at("07:59"))).toBe(false);
    expect(isPickupSmsDue(booking, at("08:00"))).toBe(true);
    expect(isPickupSmsDue(booking, at("09:59"))).toBe(true);
    expect(isPickupSmsDue(booking, at("10:00"))).toBe(false);
    expect(isPickupSmsDue(booking, at("12:00"))).toBe(false);
  });

  it.each(["scheduled", "authorizing", "failed", "action_required", "expired", "released", "hold_too_short", "not_required"])(
    "waits for a required Stripe deposit in state %s", status => {
      expect(isPickupSmsDue({ ...booking, deposit_payment_status: status }, at("08:00"))).toBe(false);
    },
  );

  it("catches up before pickup once the deposit is secured", () => {
    expect(isPickupSmsDue({ ...booking, deposit_payment_status: "failed" }, at("08:00"))).toBe(false);
    expect(isPickupSmsDue(booking, at("09:15"))).toBe(true);
    expect(isPickupSmsDue({ ...booking, deposit_payment_status: "captured" }, at("09:15"))).toBe(true);
    expect(isPickupSmsDue({ ...booking, hire_payment_status: "pending" }, at("08:00"))).toBe(false);
  });

  it("does not require a card hold for non-Stripe payments or a zero deposit", () => {
    expect(isPickupSmsDue({ ...booking, payment_method: "bank_transfer", deposit_payment_status: "bank_transfer_received" }, at("08:00"))).toBe(true);
    expect(isPickupSmsDue({ ...booking, payment_method: "cash_on_pickup", deposit_payment_status: "cash_due" }, at("08:00"))).toBe(true);
    expect(isPickupSmsDue({ ...booking, security_deposit_cents: 0, deposit_payment_status: "not_required" }, at("08:00"))).toBe(true);
  });

  it.each(["07:30", "08:00", "08:30", "09:00"])("starts in the previous evening window for a %s pickup and catches up only before pickup", time => {
    const early = { ...booking, pickup_time: time };
    expect(isPickupSmsDue(early, new Date("2026-11-09T18:59:00+11:00"))).toBe(false);
    expect(isPickupSmsDue(early, new Date("2026-11-09T19:00:00+11:00"))).toBe(true);
    expect(isPickupSmsDue(early, at("06:15"))).toBe(true);
    expect(isPickupSmsDue(early, at(time))).toBe(false);
    expect(isPickupSmsDue({ ...early, deposit_payment_status: "scheduled" }, new Date("2026-11-09T19:00:00+11:00"))).toBe(false);
  });

  it("does not send a normal pickup message the previous evening or on other dates", () => {
    expect(isPickupSmsDue(booking, new Date("2026-11-09T18:00:00+11:00"))).toBe(false);
    expect(isPickupSmsDue(booking, new Date("2026-11-08T18:00:00+11:00"))).toBe(false);
    expect(isPickupSmsDue(booking, new Date("2026-11-11T08:00:00+11:00"))).toBe(false);
  });

  it("keeps local timing through standard time and DST transitions", () => {
    for (const [date, offset, start] of [["2026-06-10", "+10:00", "07"], ["2026-10-04", "+11:00", "08"], ["2027-04-04", "+10:00", "07"]]) {
      const current = { ...booking, pickup_date: date, deposit_capture_before: null };
      const startAt = new Date(`${date}T${start}:00:00${offset}`);
      expect(isPickupSmsDue(current, new Date(startAt.getTime() - 60000))).toBe(false);
      expect(isPickupSmsDue(current, startAt)).toBe(true);
      expect(isPickupSmsDue(current, new Date(startAt.getTime() + 59 * 60000))).toBe(true);
    }
  });

  it("uses the 6–7pm standard-time evening window and does not send normal pickups early", () => {
    const early = { ...booking, pickup_date: "2026-06-11", pickup_time: "09:00", deposit_capture_before: null };
    expect(isPickupSmsDue(early, new Date("2026-06-10T17:59:00+10:00"))).toBe(false);
    expect(isPickupSmsDue(early, new Date("2026-06-10T18:00:00+10:00"))).toBe(true);
    expect(isPickupSmsDue({ ...early, pickup_time: "09:01" }, new Date("2026-06-10T18:59:00+10:00"))).toBe(false);
  });

  it("does not send for expired holds, cancelled/completed bookings or an already sent reminder", () => {
    expect(isPickupSmsDue({ ...booking, deposit_capture_before: at("08:00").toISOString() }, at("08:00"))).toBe(false);
    for (const status of ["cancelled", "completed"]) {
      expect(isPickupSmsDue({ ...booking, status }, at("08:00"))).toBe(false);
    }
    expect(isPickupSmsDue({ ...booking, pickup_sms_sent_at: at("08:00").toISOString() }, at("09:00"))).toBe(false);
  });

  it.each([null, "", "25:00", "not-a-time"])("surfaces a missing or invalid requested pickup time: %s", time => {
    expect(() => isPickupSmsDue({ ...booking, pickup_time: time }, at("08:00"))).toThrow("valid agreed pickup time");
  });
});
