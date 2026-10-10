import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { afterCallback, calendar, createAdminClient, send, Resend } = vi.hoisted(() => {
  process.env.RESEND_API_KEY = "re_test";
  process.env.ENQUIRY_FROM_EMAIL = "Peppermint Audio <from@example.com>";
  process.env.ENQUIRY_TO_EMAIL = "to@example.com";
  const send = vi.fn();
  return {
    afterCallback: vi.fn(),
    calendar: vi.fn(),
    createAdminClient: vi.fn(),
    send,
    Resend: vi.fn(() => ({ emails: { send } })),
  };
});

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: afterCallback };
});
vi.mock("resend", () => ({ Resend }));
vi.mock("@/lib/google-calendar", () => ({ createBookingCalendarEvent: calendar }));
vi.mock("@/lib/email-log", () => ({ recordCustomerEmail: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  PHOTO_ID_BUCKET: "booking-photo-ids",
  createAdminClient,
}));

import { POST } from "./route";
import { bookingReferenceForId } from "@/lib/booking-reference";

const validFields = {
  email: "alex@example.com",
  firstName: "Alex",
  lastName: "Example",
  mobile: "0412345678",
  eventType: "Wedding",
  eventAddress: "10 Example Street, Melbourne",
  pickupDate: "2026-10-09",
  dropoffDate: "2026-10-11",
  pickupTime: "10:00",
  dropoffTime: "17:00",
  hireLineItems: JSON.stringify([{
    id: "package:standard-party-events",
    kind: "package",
    catalogKey: "package:standard-party-events",
    name: "Standard Party & Events Package",
    quantity: 1,
    unitPriceCents: 16000,
  }, {
    id: "addon:wireless-microphones",
    kind: "equipment",
    catalogKey: "addon:wireless-microphones",
    name: "Wireless Microphone",
    option: "Single item",
    quantity: 1,
    unitPriceCents: 2500,
  }]),
  additionalDetails: "Please include setup guidance.",
  termsAccepted: "accepted",
};

let insertMock: ReturnType<typeof vi.fn>;

function bookingRequest(fields = validFields, files = [
  testFile("front", "front.jpg"),
  testFile("back", "back.jpg"),
]) {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.set(key, value));
  files.forEach((file) => form.append("idFiles", file));
  return { formData: async () => form } as unknown as Request;
}

function testFile(contents: string, name: string) {
  const file = new File([contents], name, { type: "image/jpeg" });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => new TextEncoder().encode(contents).buffer,
  });
  return file;
}

function configureAdmin({ insertError = null, uploadError = null, updateError = null } = {}) {
  const update = vi.fn().mockResolvedValue({ error: updateError });
  const insert = vi.fn().mockResolvedValue({ error: insertError });
  const upload = vi.fn().mockResolvedValue({ error: uploadError });
  const remove = vi.fn().mockResolvedValue({ error: null });
  createAdminClient.mockReturnValue({
    storage: { from: vi.fn(() => ({ upload, remove })) },
    from: vi.fn((table: string) => table === "bookings"
      ? { insert, update: vi.fn(() => ({ eq: update })) }
      : {}),
  });
  insertMock = insert;
  return { insert, upload, remove, update };
}

describe("POST /api/booking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("ENQUIRY_FROM_EMAIL", "Peppermint Audio <from@example.com>");
    vi.stubEnv("ENQUIRY_TO_EMAIL", "to@example.com");
    calendar.mockResolvedValue("https://calendar.google.com/event");
    send.mockResolvedValue({ data: { id: "email-id" }, error: null });
    configureAdmin();
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("captures both booking emails locally without provider credentials", async () => {
    vi.stubEnv("SUPABASE_TARGET", "local");
    vi.stubEnv("LOCAL_EMAIL_MODE", "capture");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("ENQUIRY_FROM_EMAIL", "");
    vi.stubEnv("ENQUIRY_TO_EMAIL", "");
    const capture = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ ID: "local-id" })));
    vi.stubGlobal("fetch", capture);
    const response = await POST(bookingRequest());
    expect(response.status).toBe(200);
    await afterCallback.mock.calls[0][0]();
    expect(send).not.toHaveBeenCalled();
    expect(capture).toHaveBeenCalledTimes(2);
    const messages = capture.mock.calls.map(([, request]) => JSON.parse(request.body));
    expect(messages[0].To).toEqual([{ Email: "team@peppermint.local" }]);
    expect(messages[0].Attachments).toHaveLength(2);
    expect(messages[1].To).toEqual([{ Email: validFields.email }]);
  });

  it("rejects missing or invalid booking details and ID files", async () => {
    const response = await POST(bookingRequest({ ...validFields, termsAccepted: "no" }, [
      testFile("front", "front.jpg"),
    ]));

    expect(response.status).toBe(400);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("persists canonical multi-night totals regardless of submitted catalogue prices", async () => {
    const response = await POST(bookingRequest({
      ...validFields,
      pickupDate: "2099-10-09",
      dropoffDate: "2099-10-12",
      hireLineItems: JSON.stringify([{
        id: "package:standard-party-events", kind: "package", catalogKey: "package:standard-party-events",
        name: "Standard package", quantity: 2, unitPriceCents: 1,
      }]),
    }));
    expect(response.status).toBe(200);
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ hire_amount_cents: 64000 }));
    await afterCallback.mock.calls[0][0]();
    const customerEmail = send.mock.calls.find(([email]) => email.to?.includes(validFields.email))?.[0];
    expect(customerEmail.html).toContain("$640.00");
    expect(customerEmail.html).toContain("Estimated hire total");
  });

  it("returns a configuration error before touching Supabase", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.resetModules();
    const { POST: post } = await import("./route");

    const response = await post(bookingRequest());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Email service is not configured yet." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects invalid canonical hire items", async () => {
    const response = await POST(bookingRequest({ ...validFields, hireLineItems: JSON.stringify([{
      id: "package:missing",
      kind: "package",
      catalogKey: "package:missing",
      name: "Missing package",
      quantity: 1,
      unitPriceCents: 1,
    }]) }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "A selected package or product is no longer available." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("persists a booking, schedules deferred processing, and sends both emails", async () => {
    const response = await POST(bookingRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, bookingId: expect.any(String) });
    expect(body.bookingReference).toBe(bookingReferenceForId(body.bookingId));
    expect(afterCallback).toHaveBeenCalledOnce();
    expect(createAdminClient).toHaveBeenCalledOnce();
    expect(insertMock).toHaveBeenCalledOnce();

    await afterCallback.mock.calls[0][0]();

    const insertedBooking = insertMock.mock.calls[0]?.[0];
    expect(insertedBooking?.status).toBe("submitted");
    expect(insertedBooking).toMatchObject({ pickup_time: "10:00", dropoff_time: "17:00" });
    expect(calendar).toHaveBeenCalledWith(expect.objectContaining({
      hireLineItems: expect.arrayContaining([expect.objectContaining({ name: "Wireless Microphone" })]),
    }));
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: ["to@example.com"], attachments: expect.any(Array) }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      to: ["alex@example.com"],
      subject: "Your booking request has been received",
      text: expect.stringContaining("Your request is not confirmed yet"),
    }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      to: ["alex@example.com"],
      text: expect.stringContaining(`Booking Reference: ${body.bookingReference}`),
    }));
  });

  it("persists cart equipment alongside a custom selection", async () => {
    const response = await POST(bookingRequest({
      ...validFields,
      hireLineItems: JSON.stringify([{
        id: "equipment:shure-sm58:Single microphone",
        kind: "equipment",
        catalogKey: "equipment:shure-sm58:Single microphone",
        name: "Shure SM58",
        option: "Single microphone",
        quantity: 2,
        unitPriceCents: 1500,
      }, {
        id: "equipment:yamaha-dxr15:Pair (2 speakers)",
        kind: "equipment",
        catalogKey: "equipment:yamaha-dxr15:Pair (2 speakers)",
        name: "Yamaha DXR15 PA Speaker",
        option: "Pair (2 speakers)",
        quantity: 1,
        unitPriceCents: 13500,
      }]),
    }));

    expect(response.status).toBe(200);
    const insertedBooking = insertMock.mock.calls[0]?.[0];
    expect(insertedBooking?.hire_line_items).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: expect.stringContaining("Shure SM58") }),
    ]));
    expect(insertedBooking?.hire_line_items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: expect.stringContaining("legacy text") }),
    ]));
    expect(insertedBooking?.additional_details).not.toContain("Selected hire items:");
    await afterCallback.mock.calls[0][0]();
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      to: ["alex@example.com"],
      text: expect.stringContaining("Hire items: 2 × Shure SM58"),
    }));
  });

  it("returns a persistence error when an ID upload fails", async () => {
    const { remove, upload } = configureAdmin();
    upload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "storage down" } });

    const response = await POST(bookingRequest());

    expect(response.status).toBe(500);
    expect((await response.json()).error).toContain("Photo ID upload failed: storage down");
    expect(remove).toHaveBeenCalledOnce();
  });

  it("records calendar failures and still sends email", async () => {
    calendar.mockRejectedValue(new Error("calendar down"));

    const response = await POST(bookingRequest());
    await afterCallback.mock.calls[0][0]();

    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(2);
    expect(calendar).toHaveBeenCalledOnce();
  });

  it("records email failures and rejects deferred processing", async () => {
    send.mockRejectedValue(new Error("mail down"));

    const response = await POST(bookingRequest());

    await expect(afterCallback.mock.calls[0][0]()).rejects.toThrow("Booking email failed: mail down");
    expect(response.status).toBe(200);
  });
});
