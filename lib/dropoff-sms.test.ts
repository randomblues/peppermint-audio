import { describe, expect, it } from "vitest";
import { isDropoffSmsDue, type DropoffSmsBooking } from "./dropoff-sms";

const booking: DropoffSmsBooking = {
  id: "booking-1", mobile: "0400000000", status: "confirmed",
  dropoff_date: "2026-11-10", dropoff_time: "18:00:00",
  dropoff_sms_sent_at: null, dropoff_sms_claimed_at: null,
};
const at = (time: string) => new Date(`2026-11-10T${time}:00+11:00`);

describe("Melbourne drop-off SMS scheduling", () => {
  it("starts at 8am on return day, catches up before return and stops at the return time", () => {
    expect(isDropoffSmsDue(booking, at("07:59"))).toBe(false);
    expect(isDropoffSmsDue(booking, at("08:00"))).toBe(true);
    expect(isDropoffSmsDue(booking, at("17:59"))).toBe(true);
    expect(isDropoffSmsDue(booking, at("18:00"))).toBe(false);
    expect(isDropoffSmsDue(booking, at("19:00"))).toBe(false);
    expect(isDropoffSmsDue(booking, new Date("2026-11-09T18:00:00+11:00"))).toBe(false);
    expect(isDropoffSmsDue(booking, new Date("2026-11-11T08:00:00+11:00"))).toBe(false);
  });

  it.each(["07:30", "08:00", "08:30", "09:00"])("starts in the previous evening window for a %s return", time => {
    const early = { ...booking, dropoff_time: time };
    expect(isDropoffSmsDue(early, new Date("2026-11-09T18:59:00+11:00"))).toBe(false);
    expect(isDropoffSmsDue(early, new Date("2026-11-09T19:00:00+11:00"))).toBe(true);
    expect(isDropoffSmsDue(early, at("06:00"))).toBe(true);
    expect(isDropoffSmsDue(early, at(time))).toBe(false);
  });

  it.each(["submitted", "cancelled", "completed"])("skips %s bookings", status => {
    expect(isDropoffSmsDue({ ...booking, status }, at("08:00"))).toBe(false);
  });

  it("skips an already sent reminder", () => {
    expect(isDropoffSmsDue({ ...booking, dropoff_sms_sent_at: at("08:00").toISOString() }, at("09:00"))).toBe(false);
  });

  it.each([null, "", "25:00", "bad"])("surfaces missing or invalid return time: %s", time => {
    expect(() => isDropoffSmsDue({ ...booking, dropoff_time: time }, at("08:00"))).toThrow("valid agreed drop-off time");
  });

  it("follows Melbourne time through daylight saving changes", () => {
    for (const [date, offset, start] of [["2026-06-10", "+10:00", "07"], ["2026-10-04", "+11:00", "08"], ["2027-04-04", "+10:00", "07"]]) {
      const current = { ...booking, dropoff_date: date };
      const startAt = new Date(`${date}T${start}:00:00${offset}`);
      expect(isDropoffSmsDue(current, new Date(startAt.getTime() - 60000))).toBe(false);
      expect(isDropoffSmsDue(current, startAt)).toBe(true);
      expect(isDropoffSmsDue(current, new Date(startAt.getTime() + 59 * 60000))).toBe(true);
    }
  });
});
