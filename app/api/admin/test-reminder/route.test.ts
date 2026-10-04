import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdmin, buildPickupReminderEmail, getMelbourneTomorrow, send, Resend } = vi.hoisted(() => {
  const send = vi.fn();
  return {
    requireAdmin: vi.fn(),
    buildPickupReminderEmail: vi.fn(() => ({ subject: "Pickup reminder", text: "text", html: "<p>html</p>" })),
    getMelbourneTomorrow: vi.fn(() => "2026-09-29"),
    send,
    Resend: vi.fn(() => ({ emails: { send } })),
  };
});

vi.mock("@/lib/admin-auth", () => ({ requireAdmin }));
vi.mock("resend", () => ({ Resend }));
vi.mock("@/lib/pickup-reminders", () => ({ buildPickupReminderEmail, getMelbourneTomorrow }));

import { POST } from "./route";

const booking = {
  email: "booked@example.com",
  first_name: "Booked",
  last_name: "Customer",
  event_type: "Wedding",
  pickup_date: "2026-09-29",
  hire_line_items: [],
  additional_details: "Needs a cable",
};

function request(body: unknown) {
  return new Request("http://localhost/api/admin/test-reminder", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function configureLookup(result: { data: unknown; error: unknown } = { data: booking, error: null }) {
  const single = vi.fn().mockResolvedValue(result);
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => ({ single })),
  };
  const admin = { from: vi.fn(() => query) };
  requireAdmin.mockResolvedValue({ admin });
  return { admin, query, single };
}

describe("POST /api/admin/test-reminder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RESEND_API_KEY", "resend-key");
    vi.stubEnv("ENQUIRY_FROM_EMAIL", "Peppermint Audio <from@example.com>");
    send.mockResolvedValue({ data: { id: "email-id" }, error: null });
    requireAdmin.mockResolvedValue({ admin: { from: vi.fn() } });
  });

  it("requires an admin session", async () => {
    requireAdmin.mockResolvedValue(null);

    const response = await POST(request({ email: "test@example.com" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorised" });
  });

  it("rejects invalid JSON and invalid recipient input", async () => {
    const invalidJson = await POST(request("{"));
    expect(invalidJson.status).toBe(400);
    expect(await invalidJson.json()).toEqual({ error: "Invalid JSON body." });

    const invalidEmail = await POST(request({ email: "not-an-email" }));
    expect(invalidEmail.status).toBe(400);
    expect(await invalidEmail.json()).toEqual({ error: "A valid recipient email address is required." });
  });

  it("looks up a booking and sends its reminder", async () => {
    const { query } = configureLookup();

    const response = await POST(request({ bookingId: "booking-1", email: "ignored@example.com" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, id: "email-id" });
    expect(query.select).toHaveBeenCalledWith("email,first_name,last_name,event_type,pickup_date,pickup_time,hire_line_items,additional_details");
    expect(query.eq).toHaveBeenCalledWith("id", "booking-1");
    expect(buildPickupReminderEmail).toHaveBeenCalledWith(booking);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: ["booked@example.com"] }));
  });

  it("returns not found when a booking lookup succeeds without data", async () => {
    configureLookup({ data: null, error: null });

    const response = await POST(request({ bookingId: "missing-booking" }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Booking could not be found." });
    expect(send).not.toHaveBeenCalled();
  });

  it("returns a lookup error when Supabase cannot find the booking", async () => {
    configureLookup({ data: null, error: { message: "column missing" } });

    const response = await POST(request({ bookingId: "booking-1" }));

    expect(response.status).toBe(500);
    expect((await response.json()).error).toContain("Booking lookup failed");
    expect(send).not.toHaveBeenCalled();
  });

  it("returns a configuration error before constructing the email client", async () => {
    vi.stubEnv("RESEND_API_KEY", "");

    const response = await POST(request({ email: "recipient@example.com" }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Email service is not configured." });
    expect(Resend).not.toHaveBeenCalled();
  });

  it("reports provider failures", async () => {
    send.mockResolvedValue({ error: { message: "provider rejected" } });

    const response = await POST(request({ email: "recipient@example.com" }));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "The test email could not be sent." });
  });
});
