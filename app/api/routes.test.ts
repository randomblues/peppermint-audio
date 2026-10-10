import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const send = vi.fn();
  return {
    requireAdmin: vi.fn(),
    createAuthClient: vi.fn(),
    exchangeGoogleCalendarCode: vi.fn(),
    getGoogleCalendarAuthorizationUrl: vi.fn(),
    zipFile: vi.fn(),
    zipGenerate: vi.fn(),
    send,
    sendBookingConfirmationEmail: vi.fn(),
    recordCustomerEmail: vi.fn(),
    releaseCancelledDeferredDeposit: vi.fn(),
    Resend: vi.fn(() => ({ emails: { send } })),
  };
});

vi.mock("@/lib/admin-auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/supabase", () => ({
  PHOTO_ID_BUCKET: "photo-id",
  createAuthClient: mocks.createAuthClient,
}));
vi.mock("@/lib/google-calendar", () => ({
  exchangeGoogleCalendarCode: mocks.exchangeGoogleCalendarCode,
  getGoogleCalendarAuthorizationUrl: mocks.getGoogleCalendarAuthorizationUrl,
}));
vi.mock("jszip", () => ({
  default: class MockJSZip {
    file = mocks.zipFile;
    generateAsync = mocks.zipGenerate;
  },
}));
vi.mock("resend", () => ({ Resend: mocks.Resend }));
vi.mock("@/lib/send-booking-confirmation", () => ({
  sendBookingConfirmationEmail: mocks.sendBookingConfirmationEmail,
}));
vi.mock("@/lib/email-log", () => ({
  recordCustomerEmail: mocks.recordCustomerEmail,
}));
vi.mock("@/lib/deferred-deposits", () => ({ releaseCancelledDeferredDeposit: mocks.releaseCancelledDeferredDeposit }));

import { GET as getBookings, PATCH as patchBooking, DELETE as deleteBooking } from "./admin/bookings/route";
import { POST as exportBookings } from "./admin/export/route";
import { POST as login } from "./admin/login/route";
import { POST as logout } from "./admin/logout/route";
import { GET as photoLink } from "./admin/photo-link/route";
import { POST as sendConfirmation } from "./admin/send-confirmation/route";
import { POST as sendCustomEmail } from "./admin/send-custom-email/route";
import { GET as connectCalendar } from "./google-calendar/connect/route";
import { GET as calendarCallback } from "./google-calendar/callback/route";

const request = (url: string, init?: RequestInit) => new Request(`http://localhost${url}`, init);
const jsonRequest = (url: string, body: unknown) => request(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
const responseJson = async (response: Response) => await response.json() as Record<string, unknown>;

function adminSession(overrides: Record<string, unknown> = {}) {
  return { user: { id: "admin-1" }, admin: overrides };
}

describe("admin booking routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(adminSession());
    mocks.sendBookingConfirmationEmail.mockResolvedValue("email-1");
    mocks.send.mockResolvedValue({ data: { id: "custom-1" }, error: null });
  });

  it("lists bookings and applies valid filters", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({ data: [{ id: "b1" }], error: null }),
    };
    mocks.requireAdmin.mockResolvedValue(adminSession({ from: vi.fn().mockReturnValue(query) }));

    const response = await getBookings(request("/api/admin/bookings?search=Jane&status=confirmed"));

    expect(response.status).toBe(200);
    expect(await responseJson(response)).toEqual({ bookings: [{ id: "b1", email_logs: [] }] });
    expect(query.eq).toHaveBeenCalledWith("status", "confirmed");
    expect(query.or).toHaveBeenCalledWith("email.ilike.%Jane%,first_name.ilike.%Jane%,last_name.ilike.%Jane%,event_type.ilike.%Jane%");
  });

  it("escapes PostgREST filter characters in searches", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mocks.requireAdmin.mockResolvedValue(adminSession({ from: vi.fn().mockReturnValue(query) }));
    await getBookings(request("/api/admin/bookings?search=Jane%2C_%25"));
    expect(query.or).toHaveBeenCalledWith("email.ilike.%Jane\\,\\_\\%%,first_name.ilike.%Jane\\,\\_\\%%,last_name.ilike.%Jane\\,\\_\\%%,event_type.ilike.%Jane\\,\\_\\%%");
  });

  it("rejects unauthorised and reports list failures", async () => {
    mocks.requireAdmin.mockResolvedValueOnce(null);
    expect((await getBookings(request("/api/admin/bookings"))).status).toBe(401);
    const query = { select: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: null, error: { message: "database down" } }) };
    mocks.requireAdmin.mockResolvedValueOnce(adminSession({ from: vi.fn().mockReturnValue(query) }));
    const response = await getBookings(request("/api/admin/bookings"));
    expect(response.status).toBe(500);
    expect(await responseJson(response)).toEqual({ error: "database down" });
  });

  it("updates bookings and validates PATCH bodies", async () => {
    const updateQuery = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    mocks.requireAdmin.mockResolvedValue(adminSession({ from: vi.fn().mockReturnValue(updateQuery) }));
    expect(await responseJson(await patchBooking(jsonRequest("/api/admin/bookings", { id: "b1", status: "submitted", internal_notes: "Call" })))).toEqual({ ok: true });
    expect(updateQuery.update).toHaveBeenCalledWith(expect.objectContaining({ status: "submitted", internal_notes: "Call", updated_at: expect.any(String) }));

    expect((await patchBooking(request("/api/admin/bookings", { method: "PATCH", body: "not-json" }))).status).toBe(400);
    expect((await patchBooking(jsonRequest("/api/admin/bookings", { id: "b1", status: "invalid" }))).status).toBe(400);
    updateQuery.eq.mockResolvedValueOnce({ error: { message: "write failed" } });
    expect((await patchBooking(jsonRequest("/api/admin/bookings", { id: "b1" }))).status).toBe(500);
  });

  it("recalculates saved hire items using the booking nights", async () => {
    const read = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {
        pickup_date: "2026-10-20", dropoff_date: "2026-10-23",
        payment_method: null, hire_payment_status: "unpaid", deposit_payment_status: "not_required",
      }, error: null }),
    };
    const write = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    mocks.requireAdmin.mockResolvedValue(adminSession({ from: vi.fn().mockReturnValueOnce(read).mockReturnValueOnce(write) }));
    const response = await patchBooking(jsonRequest("/api/admin/bookings", {
      id: "pricing-test", hire_line_items: [{
        id: "package:standard-party-events", kind: "package", catalogKey: "package:standard-party-events",
        name: "Standard package", quantity: 2, unitPriceCents: 1,
      }],
    }));
    expect(response.status).toBe(200);
    expect(write.update).toHaveBeenCalledWith(expect.objectContaining({ hire_amount_cents: 64000 }));
  });

  it("sends a confirmation email when an unconfirmed request is approved", async () => {
    const read = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          email: "customer@example.com",
          first_name: "Alex",
          event_type: "Wedding",
          pickup_date: "2026-10-09",
          dropoff_date: "2026-10-11",
          hire_line_items: [],
          confirmation_email_sent: false,
          hire_payment_status: "paid",
        },
        error: null,
      }),
    };
    const update = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    mocks.requireAdmin.mockResolvedValue(adminSession({ from: vi.fn().mockReturnValueOnce(read).mockReturnValueOnce(update) }));
    vi.stubEnv("RESEND_API_KEY", "key");
    vi.stubEnv("ENQUIRY_FROM_EMAIL", "Peppermint Audio <from@example.com>");

    const response = await patchBooking(jsonRequest("/api/admin/bookings", { id: "b1", status: "confirmed" }));

    expect(response.status).toBe(200);
    expect(mocks.sendBookingConfirmationEmail).toHaveBeenCalledWith(expect.objectContaining({
      email: "customer@example.com",
      first_name: "Alex",
    }));
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({
      status: "confirmed",
      confirmation_email_sent: true,
    }));
  });

  it("blocks confirmation until the hire payment is paid", async () => {
    const read = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          email: "customer@example.com",
          first_name: "Alex",
          confirmation_email_sent: false,
          hire_payment_status: "bank_transfer_pending",
        },
        error: null,
      }),
    };
    mocks.requireAdmin.mockResolvedValue(adminSession({ from: vi.fn().mockReturnValue(read) }));

    const response = await patchBooking(jsonRequest("/api/admin/bookings", { id: "b1", status: "confirmed" }));

    expect(response.status).toBe(409);
    expect(await responseJson(response)).toEqual({ error: "Mark the hire payment as paid before confirming this booking." });
    expect(mocks.sendBookingConfirmationEmail).not.toHaveBeenCalled();
  });

  it("allows confirmation for cash-on-pickup bookings with payment still due", async () => {
    const read = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          email: "customer@example.com",
          first_name: "Alex",
          event_type: "Wedding",
          pickup_date: "2026-10-09",
          dropoff_date: "2026-10-11",
          hire_line_items: [],
          confirmation_email_sent: false,
          hire_payment_status: "cash_due",
          payment_method: "cash_on_pickup",
        },
        error: null,
      }),
    };
    const update = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    mocks.requireAdmin.mockResolvedValue(adminSession({ from: vi.fn().mockReturnValueOnce(read).mockReturnValueOnce(update) }));
    vi.stubEnv("RESEND_API_KEY", "key");
    vi.stubEnv("ENQUIRY_FROM_EMAIL", "Peppermint Audio <from@example.com>");

    const response = await patchBooking(jsonRequest("/api/admin/bookings", { id: "b1", status: "confirmed" }));

    expect(response.status).toBe(200);
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ status: "confirmed" }));
  });

  it("can resend confirmation email for an already confirmed booking", async () => {
    const read = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          email: "customer@example.com",
          first_name: "Alex",
          event_type: "Wedding",
          pickup_date: "2026-10-09",
          dropoff_date: "2026-10-11",
          hire_line_items: [],
          status: "confirmed",
        },
        error: null,
      }),
    };
    const update = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    mocks.requireAdmin.mockResolvedValue(adminSession({ from: vi.fn().mockReturnValueOnce(read).mockReturnValueOnce(update) }));

    const response = await sendConfirmation(jsonRequest("/api/admin/send-confirmation", { bookingId: "b1" }));

    expect(response.status).toBe(200);
    expect(await responseJson(response)).toEqual({ ok: true, id: "email-1" });
    expect(mocks.sendBookingConfirmationEmail).toHaveBeenCalledOnce();
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ confirmation_email_sent: true }));
  });

  it("sends a custom email to a booking contact", async () => {
    const read = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { email: "customer@example.com" }, error: null }),
    };
    mocks.requireAdmin.mockResolvedValue(adminSession({ from: vi.fn().mockReturnValue(read) }));
    vi.stubEnv("RESEND_API_KEY", "key");
    vi.stubEnv("ENQUIRY_FROM_EMAIL", "Peppermint Audio <from@example.com>");

    const response = await sendCustomEmail(jsonRequest("/api/admin/send-custom-email", {
      bookingId: "b1",
      subject: "A quick update",
      message: "Please call us when you can.",
    }));

    expect(response.status).toBe(200);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
      to: ["customer@example.com"],
      subject: "A quick update",
      text: expect.stringContaining("Please call us when you can.\n\nKind regards,\nPeppermint Audio"),
      html: expect.stringContaining("Please call us when you can."),
    }));
  });

  it("sends a custom email with an optional attachment", async () => {
    const read = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { email: "customer@example.com" }, error: null }),
    };
    mocks.requireAdmin.mockResolvedValue(adminSession({ from: vi.fn().mockReturnValue(read) }));
    vi.stubEnv("RESEND_API_KEY", "key");
    vi.stubEnv("ENQUIRY_FROM_EMAIL", "Peppermint Audio <from@example.com>");
    const form = new Map<string, unknown>([
      ["bookingId", "b1"],
      ["subject", "Your documents"],
      ["message", "Please find the document attached."],
      ["attachment", {
        name: "details.pdf",
        size: 15,
        arrayBuffer: async () => new TextEncoder().encode("document contents").buffer,
      }],
    ]) as unknown as FormData;

    const response = await sendCustomEmail({
      headers: new Headers({ "content-type": "multipart/form-data; boundary=test" }),
      formData: async () => form,
    } as Request);

    expect(response.status).toBe(200);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
      subject: "Your documents",
      attachments: [{ filename: "details.pdf", content: Buffer.from("document contents").toString("base64") }],
    }));
  });

  it("rejects unauthorised and malformed PATCH requests", async () => {
    mocks.requireAdmin.mockResolvedValueOnce(null);
    expect((await patchBooking(jsonRequest("/api/admin/bookings", { id: "b1" }))).status).toBe(401);
    expect((await patchBooking(jsonRequest("/api/admin/bookings", {}))).status).toBe(400);
  });

  it("deletes bookings, including stored photo IDs", async () => {
    const remove = vi.fn().mockResolvedValue({ error: null });
    const read = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { photo_id_paths: ["a/id.jpg", "b/id.png"] }, error: null }) };
    const deletion = { delete: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
    const from = vi.fn().mockReturnValueOnce(read).mockReturnValueOnce(deletion);
    mocks.requireAdmin.mockResolvedValue(adminSession({ from, storage: { from: vi.fn().mockReturnValue({ remove }) } }));
    expect(await responseJson(await deleteBooking(jsonRequest("/api/admin/bookings", { id: "b1", confirm: true })))).toEqual({ ok: true });
    expect(remove).toHaveBeenCalledWith(["a/id.jpg", "b/id.png"]);
    expect(deletion.delete).toHaveBeenCalled();

    expect((await deleteBooking(jsonRequest("/api/admin/bookings", { id: "b1", confirm: false }))).status).toBe(400);
    from.mockReturnValueOnce(read);
    read.single.mockResolvedValueOnce({ data: null, error: { message: "read failed" } });
    expect((await deleteBooking(jsonRequest("/api/admin/bookings", { id: "b1", confirm: true }))).status).toBe(500);
  });

  it("handles delete validation, malformed JSON, empty photo paths, and delete failures", async () => {
    expect((await deleteBooking(request("/api/admin/bookings", { method: "DELETE", body: "not-json" }))).status).toBe(400);
    expect((await deleteBooking(jsonRequest("/api/admin/bookings", {}))).status).toBe(400);

    const read = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { photo_id_paths: null }, error: null }),
    };
    const deletion = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: { message: "delete failed" } }),
    };
    mocks.requireAdmin.mockResolvedValue(adminSession({
      from: vi.fn().mockReturnValueOnce(read).mockReturnValueOnce(deletion),
      storage: { from: vi.fn() },
    }));
    const response = await deleteBooking(jsonRequest("/api/admin/bookings", { id: "b1", confirm: true }));
    expect(response.status).toBe(500);
    expect(await responseJson(response)).toEqual({ error: "delete failed" });
  });

  it("does not delete a booking when private photo ID removal fails", async () => {
    const read = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { photo_id_paths: ["private/front.jpg"] }, error: null }),
    };
    const deletion = { delete: vi.fn().mockReturnThis(), eq: vi.fn() };
    const remove = vi.fn().mockResolvedValue({ error: { message: "storage unavailable" } });
    mocks.requireAdmin.mockResolvedValue(adminSession({
      from: vi.fn().mockReturnValueOnce(read).mockReturnValueOnce(deletion),
      storage: { from: vi.fn().mockReturnValue({ remove }) },
    }));

    const response = await deleteBooking(jsonRequest("/api/admin/bookings", { id: "b1", confirm: true }));

    expect(response.status).toBe(502);
    expect(await responseJson(response)).toEqual({ error: "Private photo ID deletion failed: storage unavailable" });
    expect(deletion.delete).not.toHaveBeenCalled();
  });
});

describe("admin export, authentication, and photo routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(adminSession());
  });

  it("exports booking data and downloadable attachments as a zip", async () => {
    const download = vi.fn().mockResolvedValue({ data: { arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(5)) }, error: null });
    const rows = [{ id: "b1", email: "a@b.test", first_name: "A", photo_id_paths: ["folder/id.jpg"] }];
    const query = { select: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), lte: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: rows, error: null }) };
    mocks.requireAdmin.mockResolvedValue(adminSession({ from: vi.fn().mockReturnValue(query), storage: { from: vi.fn().mockReturnValue({ download }) } }));
    mocks.zipGenerate.mockResolvedValue(new Uint8Array([1, 2, 3]));
    const response = await exportBookings(jsonRequest("/api/admin/export", { from: "2026-10-01", to: "2026-10-02", confirm: true }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/zip");
    expect(response.headers.get("content-disposition")).toContain("2026-10-01-to-2026-10-02");
    expect(mocks.zipFile).toHaveBeenCalledWith("bookings.csv", expect.stringContaining('"a@b.test"'));
    expect(mocks.zipFile).toHaveBeenCalledWith("attachments/b1/id.jpg", expect.any(ArrayBuffer));

    expect((await exportBookings(jsonRequest("/api/admin/export", { from: "2026-10-02", to: "2026-10-01", confirm: true }))).status).toBe(400);
    const failedQuery = { select: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), lte: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: null, error: { message: "query failed" } }) };
    mocks.requireAdmin.mockResolvedValue(adminSession({ from: vi.fn().mockReturnValue(failedQuery) }));
    expect((await exportBookings(jsonRequest("/api/admin/export", { from: "2026-10-01", to: "2026-10-02", confirm: true }))).status).toBe(500);
  });

  it("logs in with valid credentials and rejects invalid credentials", async () => {
    mocks.createAuthClient.mockReturnValue({ auth: { signInWithPassword: vi.fn().mockResolvedValue({ data: { session: { access_token: "access", refresh_token: "refresh", expires_in: 3600 } }, error: null }) } });
    const response = await login(jsonRequest("/api/admin/login", { email: "admin@example.com", password: "secret" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("supabase-access-token=access");
    expect(response.headers.get("set-cookie")).toContain("supabase-refresh-token=refresh");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=2592000");
    expect((await login(jsonRequest("/api/admin/login", { email: "", password: "secret" }))).status).toBe(400);
    mocks.createAuthClient.mockReturnValue({ auth: { signInWithPassword: vi.fn().mockResolvedValue({ data: { session: null }, error: { message: "bad" } }) } });
    expect((await login(jsonRequest("/api/admin/login", { email: "admin@example.com", password: "bad" }))).status).toBe(401);
  });

  it("returns JSON when login configuration is unavailable", async () => {
    mocks.createAuthClient.mockImplementation(() => {
      throw new Error("Supabase auth is not configured.");
    });
    const response = await login(jsonRequest("/api/admin/login", { email: "admin@example.com", password: "secret" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Admin login is not configured on this server." });
  });

  it("clears auth cookies on logout", async () => {
    const response = await logout();
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("supabase-access-token=");
    expect(response.headers.get("set-cookie")).toContain("supabase-refresh-token=");
  });

  it("creates signed photo links and handles missing paths and storage errors", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.test" }, error: null });
    mocks.requireAdmin.mockResolvedValue(adminSession({ storage: { from: vi.fn().mockReturnValue({ createSignedUrl }) } }));
    expect(await responseJson(await photoLink(request("/api/admin/photo-link?path=folder%2Fid.jpg")))).toEqual({ url: "https://signed.test" });
    expect(createSignedUrl).toHaveBeenCalledWith("folder/id.jpg", 300);
    expect((await photoLink(request("/api/admin/photo-link"))).status).toBe(400);
    createSignedUrl.mockResolvedValueOnce({ data: null, error: { message: "storage failed" } });
    expect((await photoLink(request("/api/admin/photo-link?path=id.jpg"))).status).toBe(500);
    mocks.requireAdmin.mockResolvedValueOnce(null);
    expect((await photoLink(request("/api/admin/photo-link?path=id.jpg"))).status).toBe(401);
  });
});

describe("Google Calendar routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects to Google authorization and reports configuration errors", async () => {
    mocks.getGoogleCalendarAuthorizationUrl.mockReturnValue("https://accounts.google.com/oauth");
    const response = await connectCalendar();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://accounts.google.com/oauth");
    mocks.getGoogleCalendarAuthorizationUrl.mockImplementationOnce(() => { throw new Error("not configured"); });
    expect((await connectCalendar()).status).toBe(500);
  });

  it("handles callback code validation, token exchange, and failures", async () => {
    expect((await calendarCallback(request("/api/google-calendar/callback"))).status).toBe(400);
    mocks.exchangeGoogleCalendarCode.mockResolvedValue("refresh-token");
    const response = await calendarCallback(request("/api/google-calendar/callback?code=abc"));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("refresh-token");
    expect(mocks.exchangeGoogleCalendarCode).toHaveBeenCalledWith("abc");
    mocks.exchangeGoogleCalendarCode.mockResolvedValueOnce(undefined);
    expect((await calendarCallback(request("/api/google-calendar/callback?code=abc"))).status).toBe(400);
    mocks.exchangeGoogleCalendarCode.mockRejectedValueOnce(new Error("oauth failed"));
    expect((await calendarCallback(request("/api/google-calendar/callback?code=abc"))).status).toBe(500);
  });
});
