import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DropoffSmsBooking } from "@/lib/dropoff-sms";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), send: vi.fn(), pickup: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/send-booking-sms", () => ({ sendDropoffReminderSms: mocks.send, sendPickupReminderSms: mocks.pickup }));
import { GET } from "./route";

const now = new Date("2026-11-10T08:00:00+11:00");
let booking: DropoffSmsBooking;

function configure(options: { queryError?: boolean; claimError?: boolean; trackingError?: boolean; releaseError?: boolean; changed?: boolean } = {}) {
  mocks.admin.mockReturnValue({
    from: vi.fn(() => {
      let values: Record<string, unknown> | null = null;
      const filters: [string, unknown][] = [];
      const query = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn((field: string, value: unknown) => { filters.push([field, value]); return query; }),
        is: vi.fn((field: string, value: unknown) => { filters.push([field, value]); return query; }),
        update: vi.fn((value: Record<string, unknown>) => { values = value; return query; }),
        maybeSingle: vi.fn(async () => {
          if (!values) throw new Error("Expected an update.");
          const claim = typeof values.dropoff_sms_claimed_at === "string";
          const tracking = "dropoff_sms_sent_at" in values;
          if ((claim && options.claimError) || (tracking && options.trackingError) || (!claim && !tracking && options.releaseError)) {
            return { data: null, error: { message: "Database unavailable" } };
          }
          if (options.changed || !filters.every(([field, value]) => booking[field as keyof DropoffSmsBooking] === value)) {
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
}

function request(authorized = true) {
  return new Request("http://localhost/api/cron/dropoff-sms", {
    headers: authorized ? { authorization: ["Bearer", "test-cron-secret"].join(" ") } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.stubEnv("CRON_SECRET", "test-cron-secret");
  booking = {
    id: "booking-1", mobile: "0400000000", status: "confirmed",
    dropoff_date: "2026-11-10", dropoff_time: "18:00:00",
    dropoff_sms_sent_at: null, dropoff_sms_claimed_at: null,
  };
  mocks.send.mockResolvedValue({ id: "sms-1" });
  configure();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("drop-off SMS cron", () => {
  it("requires authorization", async () => {
    expect((await GET(request(false))).status).toBe(401);
    expect(mocks.admin).not.toHaveBeenCalled();
  });

  it("sends once, records delivery tracking and does not send pickup SMS", async () => {
    expect(await (await GET(request())).json()).toEqual({ selected: 1, sent: 1, failures: [] });
    expect(booking.dropoff_sms_sent_at).toBe(now.toISOString());
    expect(booking.dropoff_sms_claimed_at).toBeNull();
    await GET(request());
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.pickup).not.toHaveBeenCalled();
  });

  it("prevents concurrent duplicates", async () => {
    await Promise.all([GET(request()), GET(request())]);
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it("skips a live claim and recovers an abandoned claim", async () => {
    booking.dropoff_sms_claimed_at = now.toISOString();
    await GET(request());
    expect(mocks.send).not.toHaveBeenCalled();
    booking.dropoff_sms_claimed_at = new Date(now.getTime() - 16 * 60000).toISOString();
    await GET(request());
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it("sends an early return reminder the previous evening", async () => {
    booking.dropoff_time = "08:00";
    vi.setSystemTime(new Date("2026-11-09T19:00:00+11:00"));
    expect((await GET(request())).status).toBe(200);
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it.each(["submitted", "cancelled", "completed"])("skips %s bookings", async status => {
    booking.status = status;
    await GET(request());
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("does not send at or after the scheduled return", async () => {
    booking.dropoff_time = "08:00";
    await GET(request());
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("does not send when the booking changed before the claim", async () => {
    configure({ changed: true });
    await GET(request());
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("surfaces a query failure without sending", async () => {
    configure({ queryError: true });
    expect((await GET(request())).status).toBe(500);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it.each(["claimError", "trackingError", "releaseError"] as const)("surfaces %s", async failure => {
    configure({ [failure]: true });
    if (failure === "releaseError") mocks.send.mockRejectedValueOnce(new Error("Provider unavailable"));
    const response = await GET(request());
    expect(response.status).toBe(502);
    expect((await response.json()).failures.length).toBeGreaterThan(0);
  });

  it("releases a failed send claim and retries", async () => {
    mocks.send.mockRejectedValueOnce(new Error("Provider unavailable"));
    expect((await GET(request())).status).toBe(502);
    expect(booking.dropoff_sms_claimed_at).toBeNull();
    expect(booking.dropoff_sms_sent_at).toBeNull();
    expect((await GET(request())).status).toBe(200);
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });
});
