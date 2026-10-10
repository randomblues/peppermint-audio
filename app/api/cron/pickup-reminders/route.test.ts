import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildPickupReminderEmail, createAdminClient, getMelbourneTomorrow, recordCustomerEmail, send, Resend } = vi.hoisted(() => {
  const send = vi.fn();
  return {
    buildPickupReminderEmail: vi.fn(() => ({ subject: "Pickup reminder", text: "Reminder text", html: "<p>Reminder</p>" })),
    createAdminClient: vi.fn(),
    getMelbourneTomorrow: vi.fn(() => "2026-09-29"),
    recordCustomerEmail: vi.fn(),
    send,
    Resend: vi.fn(() => ({ emails: { send } })),
  };
});

vi.mock("resend", () => ({ Resend }));
vi.mock("@/lib/pickup-reminders", () => ({ buildPickupReminderEmail, getMelbourneTomorrow }));
vi.mock("@/lib/supabase", () => ({ createAdminClient }));
vi.mock("@/lib/email-log", () => ({ recordCustomerEmail }));

import { GET, isCronAuthorized } from "./route";

const bookings = [
  {
    id: "booking-1",
    email: "one@example.com",
    first_name: "One",
    last_name: "Customer",
    event_type: "Party",
    pickup_date: "2026-09-29",
    hire_line_items: [],
    additional_details: null,
  },
  {
    id: "booking-2",
    email: "two@example.com",
    first_name: "Two",
    last_name: "Customer",
    event_type: "Wedding",
    pickup_date: "2026-09-29",
    hire_line_items: [],
    additional_details: "Details",
  },
];

function request(authorization = "Bearer cron-secret") {
  return new Request("http://localhost/api/cron/pickup-reminders", { headers: { authorization } });
}

function configureAdmin(data: unknown[] = bookings, queryError: unknown = null, updateErrors: unknown[] = []) {
  let updateIndex = 0;
  const update = vi.fn(() => ({
    eq: vi.fn(() => ({
      is: vi.fn().mockResolvedValue({ error: updateErrors[updateIndex++] ?? null }),
    })),
  }));
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    neq: vi.fn(() => query),
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
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("RESEND_API_KEY", "resend-key");
    vi.stubEnv("ENQUIRY_FROM_EMAIL", "Peppermint Audio <from@example.com>");
    send.mockResolvedValue({ data: { id: "email-id" }, error: null });
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

  it("queries tomorrow's non-cancelled, unreminded bookings", async () => {
    configureAdmin([]);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(getMelbourneTomorrow).toHaveBeenCalledOnce();
    const query = createAdminClient.mock.results[0].value.from.mock.results[0].value;
    expect(query.select).toHaveBeenCalledWith("id,email,first_name,last_name,event_type,pickup_date,pickup_time,hire_line_items,additional_details");
    expect(query.eq).toHaveBeenCalledWith("pickup_date", "2026-09-29");
    expect(query.neq).toHaveBeenCalledWith("status", "cancelled");
    expect(query.neq).toHaveBeenCalledWith("status", "completed");
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
    expect(send).toHaveBeenNthCalledWith(1, expect.objectContaining({ from: "Peppermint Audio <from@example.com>", to: ["one@example.com"] }));
    expect(send).toHaveBeenNthCalledWith(2, expect.objectContaining({ to: ["two@example.com"] }));
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("continues after send, response, or update failures and reports each booking", async () => {
    const { update } = configureAdmin(bookings, null, [{ message: "mark failed" }]);
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
    expect(update).toHaveBeenCalledTimes(1);
  });
});
