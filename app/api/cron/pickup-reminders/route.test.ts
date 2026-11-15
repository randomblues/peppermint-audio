import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildPickupReminderEmail, createAdminClient, getMelbourneTomorrow, recordCustomerEmail, sendPickupReminderSms, send, Resend } = vi.hoisted(() => {
  const send = vi.fn();
  return {
    buildPickupReminderEmail: vi.fn(() => ({ subject: "Pickup reminder", text: "Reminder text", html: "<p>Reminder</p>" })),
    createAdminClient: vi.fn(),
    getMelbourneTomorrow: vi.fn(() => "2026-09-29"),
    recordCustomerEmail: vi.fn(),
    sendPickupReminderSms: vi.fn(),
    send,
    Resend: vi.fn(() => ({ emails: { send } })),
  };
});

vi.mock("resend", () => ({ Resend }));
vi.mock("@/lib/pickup-reminders", () => ({ buildPickupReminderEmail, getMelbourneTomorrow }));
vi.mock("@/lib/supabase", () => ({ createAdminClient }));
vi.mock("@/lib/email-log", () => ({ recordCustomerEmail }));
vi.mock("@/lib/send-booking-sms", () => ({ sendPickupReminderSms }));

import { GET, isCronAuthorized } from "./route";

const bookings = [
  {
    id: "booking-1",
    status: "confirmed",
    email: "one@example.com",
    mobile: "0412345678",
    first_name: "One",
    last_name: "Customer",
    event_type: "Party",
    pickup_date: "2026-09-29",
    hire_line_items: [],
    additional_details: null,
    pickup_sms_sent_at: null,
  },
  {
    id: "booking-2",
    status: "confirmed",
    email: "two@example.com",
    mobile: "0412345679",
    first_name: "Two",
    last_name: "Customer",
    event_type: "Wedding",
    pickup_date: "2026-09-29",
    hire_line_items: [],
    additional_details: "Details",
    pickup_sms_sent_at: null,
  },
];

function request(authorization = "Bearer cron-secret") {
  return new Request("http://localhost/api/cron/pickup-reminders", { headers: { authorization } });
}

function configureAdmin(data: unknown[] = bookings, queryError: unknown = null, updateErrors: unknown[] = []) {
  let updateIndex = 0;
  const update = vi.fn(() => ({
    eq: vi.fn(() => ({
      is: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: "marked" }, error: updateErrors[updateIndex++] ?? null }),
        })),
      })),
    })),
  }));
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    neq: vi.fn(() => query),
    or: vi.fn().mockResolvedValue({ data, error: queryError }),
    is: vi.fn().mockResolvedValue({ data, error: queryError }),
  };
  createAdminClient.mockReturnValue({
    from: vi.fn()
      .mockReturnValueOnce(query)
      .mockReturnValue({ update }),
  });
  return { query, update };
}

describe("pickup reminder cron authorization", () => {
  it("requires the configured bearer secret", () => {
    expect(isCronAuthorized(new Request("http://localhost"), "secret")).toBe(false);
    expect(isCronAuthorized(new Request("http://localhost", { headers: { authorization: "Bearer wrong" } }), "secret")).toBe(false);
    expect(isCronAuthorized(new Request("http://localhost", { headers: { authorization: "Bearer secret" } }), "secret")).toBe(true);
  });
});

describe("GET /api/cron/pickup-reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(new Date("2026-11-08T01:00:00Z")); // Noon in Melbourne during daylight saving.
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("RESEND_API_KEY", "resend-key");
    vi.stubEnv("ENQUIRY_FROM_EMAIL", "Peppermint Audio <from@example.com>");
    send.mockResolvedValue({ data: { id: "email-id" }, error: null });
    sendPickupReminderSms.mockResolvedValue({ id: "sms-id" });
    configureAdmin();
  });

  it("rejects unauthorized requests before checking email configuration", async () => {
    vi.stubEnv("RESEND_API_KEY", "");

    const response = await GET(request("Bearer wrong"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns a configuration error before querying bookings", async () => {
    vi.stubEnv("RESEND_API_KEY", "");

    const response = await GET(request());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Email service is not configured." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("runs the single UTC trigger at 11am Melbourne time during standard time", async () => {
    vi.setSystemTime(new Date("2026-05-08T01:00:00Z"));
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ pickupDate: "2026-09-29", sent: 2 });
    expect(createAdminClient).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("queries only tomorrow's confirmed, unreminded bookings", async () => {
    configureAdmin([]);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(getMelbourneTomorrow).toHaveBeenCalledOnce();
    const query = createAdminClient.mock.results[0].value.from.mock.results[0].value;
    expect(query.select).toHaveBeenCalledWith("id,email,first_name,last_name,status,event_type,pickup_date,pickup_time,hire_line_items,additional_details,reminder_sent_at");
    expect(query.eq).toHaveBeenCalledWith("pickup_date", "2026-09-29");
    expect(query.eq).toHaveBeenCalledWith("status", "confirmed");
    expect(query.is).toHaveBeenCalledWith("reminder_sent_at", null);
  });

  it("returns a query failure without sending reminders", async () => {
    configureAdmin([], { message: "database unavailable" });

    const response = await GET(request());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Booking query failed" });
    expect(send).not.toHaveBeenCalled();
  });

  it("sends and marks every selected booking", async () => {
    const { update } = configureAdmin(bookings);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ pickupDate: "2026-09-29", selected: 2, sent: 2, failures: [] });
    expect(buildPickupReminderEmail).toHaveBeenCalledTimes(2);
    expect(recordCustomerEmail).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledTimes(2);
    expect(sendPickupReminderSms).not.toHaveBeenCalled();
    expect(send).toHaveBeenNthCalledWith(1, expect.objectContaining({ from: "Peppermint Audio <from@example.com>", to: ["one@example.com"] }), {
      idempotencyKey: "pickup-reminder-booking-1-2026-09-29",
    });
    expect(send).toHaveBeenNthCalledWith(2, expect.objectContaining({ to: ["two@example.com"] }), {
      idempotencyKey: "pickup-reminder-booking-2-2026-09-29",
    });
    expect(update).toHaveBeenCalledTimes(2);
  });

  it.each(["submitted", "cancelled", "completed"])("does not email or mark a %s booking", async (status) => {
    const { update } = configureAdmin([{ ...bookings[0], status, reminder_sent_at: null }]);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ pickupDate: "2026-09-29", selected: 1, sent: 0, failures: [] });
    expect(buildPickupReminderEmail).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(recordCustomerEmail).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("leaves a submitted booking eligible for a later run after confirmation", async () => {
    configureAdmin([{ ...bookings[0], status: "submitted", reminder_sent_at: null }]);
    await GET(request());
    expect(send).not.toHaveBeenCalled();

    const { update } = configureAdmin([{ ...bookings[0], status: "confirmed", reminder_sent_at: null }]);
    const response = await GET(request());

    expect(await response.json()).toEqual({ pickupDate: "2026-09-29", selected: 1, sent: 1, failures: [] });
    expect(send).toHaveBeenCalledOnce();
    expect(recordCustomerEmail).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
  });

  it("continues after send, response, or update failures and reports each booking", async () => {
    const { update } = configureAdmin([
      { ...bookings[0], pickup_sms_sent_at: "already-sent" },
      bookings[1],
    ], null, [{ message: "mark failed" }]);
    send.mockResolvedValueOnce({ error: { message: "provider rejected" } }).mockResolvedValueOnce({ data: { id: "email-id" }, error: null });

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      pickupDate: "2026-09-29",
      selected: 2,
      sent: 0,
      failures: [
        { id: "booking-1", error: "provider rejected" },
        { id: "booking-2", error: "Reminder sent but could not be marked: mark failed" },
      ],
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(sendPickupReminderSms).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("does not send pickup SMS from the day-before email job", async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      sent: 2,
      failures: [],
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(sendPickupReminderSms).not.toHaveBeenCalled();
  });

  it("does not resend an already tracked email or send a pickup SMS", async () => {
    configureAdmin([{ ...bookings[0], reminder_sent_at: "2026-09-28T00:00:00Z" }]);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ selected: 1, sent: 0, failures: [] });
    expect(send).not.toHaveBeenCalled();
    expect(sendPickupReminderSms).not.toHaveBeenCalled();
  });
});
