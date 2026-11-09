import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { PickupSmsBooking } from "@/lib/pickup-sms";
import type { DropoffSmsBooking } from "@/lib/dropoff-sms";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), pickup: vi.fn(), dropoff: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/send-booking-sms", () => ({
  sendPickupReminderSms: mocks.pickup, sendDropoffReminderSms: mocks.dropoff,
}));
import { GET } from "./route";
import { GET as eveningGET } from "../hire-reminders-evening/route";

let booking: PickupSmsBooking & DropoffSmsBooking;

function request() {
  return new Request("http://localhost/api/cron/hire-reminders", {
    headers: { authorization: ["Bearer", "test-cron-secret"].join(" ") },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-10T08:30:00+11:00"));
  vi.stubEnv("CRON_SECRET", "test-cron-secret");
  booking = {
    id: "booking-1", mobile: "0400000000", status: "confirmed",
    pickup_date: "2026-11-10", pickup_time: "10:00",
    dropoff_date: "2026-11-10", dropoff_time: "18:00",
    payment_method: "stripe_card_hold", hire_payment_status: "paid", security_deposit_cents: 10000,
    deposit_payment_status: "authorized", deposit_capture_before: null,
    pickup_sms_sent_at: null, pickup_sms_claimed_at: null, dropoff_sms_sent_at: null, dropoff_sms_claimed_at: null,
  };
  mocks.pickup.mockResolvedValue({ id: "pickup-1" });
  mocks.dropoff.mockResolvedValue({ id: "dropoff-1" });
  mocks.admin.mockReturnValue({
    from: vi.fn(() => {
      let updates: Record<string, unknown> | null = null;
      const filters: [string, unknown][] = [];
      const query = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn((field: string, value: unknown) => { filters.push([field, value]); return query; }),
        is: vi.fn((field: string, value: unknown) => { filters.push([field, value]); return query; }),
        update: vi.fn((value: Record<string, unknown>) => { updates = value; return query; }),
        maybeSingle: vi.fn(async () => {
          if (!updates) throw new Error("Expected an update.");
          if (!filters.every(([field, value]) => booking[field as keyof typeof booking] === value)) {
            return { data: null, error: null };
          }
          Object.assign(booking, updates);
          return { data: { id: booking.id }, error: null };
        }),
        then: (resolve: (value: object) => unknown) => Promise.resolve({ data: [{ ...booking }], error: null }).then(resolve),
      };
      return query;
    }),
  });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("Hobby-compatible morning and evening reminder jobs", () => {
  it("authenticates both routes before touching the database", async () => {
    for (const route of [GET, eveningGET]) {
      expect((await route(new Request("http://localhost/api/cron/hire-reminders"))).status).toBe(401);
    }
    expect(mocks.admin).not.toHaveBeenCalled();
  });

  it("sends both reminder types in the morning and skips them in later runs", async () => {
    const result = await GET(request());
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({
      pickup: { selected: 1, sent: 1, failures: [] }, dropoff: { selected: 1, sent: 1, failures: [] },
    });
    await eveningGET(request());
    expect(mocks.pickup).toHaveBeenCalledTimes(1);
    expect(mocks.dropoff).toHaveBeenCalledTimes(1);
  });

  it("sends early next-day reminders from the evening route", async () => {
    vi.setSystemTime(new Date("2026-11-09T19:30:00+11:00"));
    booking.pickup_time = "09:00";
    booking.dropoff_time = "08:30";
    expect((await eveningGET(request())).status).toBe(200);
    expect(mocks.pickup).toHaveBeenCalledOnce();
    expect(mocks.dropoff).toHaveBeenCalledOnce();
  });

  it("still attempts drop-off reminders if pickup SMS fails", async () => {
    mocks.pickup.mockRejectedValueOnce(new Error("Pickup provider unavailable"));
    const result = await GET(request());
    expect(result.status).toBe(502);
    const body = await result.json();
    expect(body.pickup.failures).toHaveLength(1);
    expect(body.dropoff.sent).toBe(1);
  });

  it("keeps every configured Vercel job at a once-daily frequency", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8"));
    for (const cron of config.crons) {
      expect(cron.schedule).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/);
    }
    expect(config.crons).toContainEqual({ path: "/api/cron/hire-reminders", schedule: "0 21 * * *" });
    expect(config.crons).toContainEqual({ path: "/api/cron/hire-reminders-evening", schedule: "0 8 * * *" });
    expect(new Set(config.crons.map((cron: { path: string }) => cron.path)).size).toBe(config.crons.length);
  });
});
