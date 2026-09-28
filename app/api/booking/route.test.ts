import { beforeEach, describe, expect, it, vi } from "vitest";

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
vi.mock("@/lib/supabase", () => ({
  PHOTO_ID_BUCKET: "booking-photo-ids",
  createAdminClient,
}));

import { POST } from "./route";

const validFields = {
  email: "alex@example.com",
  firstName: "Alex",
  lastName: "Example",
  mobile: "0412345678",
  eventType: "Wedding",
  eventAddress: "10 Example Street, Melbourne",
  pickupDate: "2026-10-09",
  dropoffDate: "2026-10-11",
  packageInterest: "Standard Party & Events Package",
  addOns: "wireless-microphones",
  guestCount: "80",
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
  createAdminClient.mockReturnValue({
    storage: { from: vi.fn(() => ({ upload })) },
    from: vi.fn((table: string) => table === "bookings"
      ? { insert, update: vi.fn(() => ({ eq: update })) }
      : {}),
  });
  insertMock = insert;
  return { insert, upload, update };
}

describe("POST /api/booking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("ENQUIRY_FROM_EMAIL", "Peppermint Audio <from@example.com>");
    vi.stubEnv("ENQUIRY_TO_EMAIL", "to@example.com");
    calendar.mockResolvedValue("https://calendar.google.com/event");
    send.mockResolvedValue({ data: { id: "email-id" }, error: null });
    configureAdmin();
  });

  it("rejects missing or invalid booking details and ID files", async () => {
    const response = await POST(bookingRequest({ ...validFields, termsAccepted: "no" }, [
      testFile("front", "front.jpg"),
    ]));

    expect(response.status).toBe(400);
    expect(createAdminClient).not.toHaveBeenCalled();
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

  it("rejects add-ons that are not available for the selected package", async () => {
    const response = await POST(bookingRequest({ ...validFields, addOns: "not-real" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Please choose add-ons from the selected package." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("persists a booking, schedules deferred processing, and sends both emails", async () => {
    const response = await POST(bookingRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, bookingId: expect.any(String) });
    expect(afterCallback).toHaveBeenCalledOnce();
    expect(createAdminClient).toHaveBeenCalledOnce();
    expect(insertMock).toHaveBeenCalledOnce();

    await afterCallback.mock.calls[0][0]();

    const insertedBooking = insertMock.mock.calls[0]?.[0];
    expect(insertedBooking?.status).toBe("submitted");
    expect(calendar).toHaveBeenCalledWith(expect.objectContaining({ addOns: ["Wireless Microphone Upgrade"] }));
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: ["to@example.com"], attachments: expect.any(Array) }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      to: ["alex@example.com"],
      subject: "Your booking request has been received",
      text: expect.stringContaining("Your request is not confirmed yet"),
    }));
  });

  it("returns a persistence error when an ID upload fails", async () => {
    configureAdmin({ uploadError: { message: "storage down" } });

    const response = await POST(bookingRequest());

    expect(response.status).toBe(500);
    expect((await response.json()).error).toContain("Photo ID upload failed: storage down");
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
