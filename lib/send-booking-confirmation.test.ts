import { beforeEach, describe, expect, it, vi } from "vitest";

const { send } = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("resend", () => ({ Resend: vi.fn(() => ({ emails: { send } })) }));

import { sendBookingConfirmationEmail, type BookingConfirmationRecord } from "./send-booking-confirmation";

const booking: BookingConfirmationRecord = {
  id: "12345678-90ab-cdef-1234-567890abcdef",
  email: "customer@example.com",
  first_name: "Alex",
  event_type: "Wedding",
  pickup_date: "2026-10-09",
  dropoff_date: "2026-10-11",
  hire_line_items: [{
    id: "package:standard-party-events",
    kind: "package",
    name: "Standard Party & Events Package",
    quantity: 1,
    unitPriceCents: 16000,
  }],
};

describe("sendBookingConfirmationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RESEND_API_KEY", "key");
    vi.stubEnv("ENQUIRY_FROM_EMAIL", "Peppermint Audio <from@example.com>");
  });

  it("sends the confirmation template to the booking email", async () => {
    send.mockResolvedValue({ data: { id: "email-1" }, error: null });

    await expect(sendBookingConfirmationEmail(booking)).resolves.toBe("email-1");
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      from: "Peppermint Audio <from@example.com>",
      to: ["customer@example.com"],
      subject: "Your booking with Peppermint Audio has been confirmed.",
      text: expect.not.stringContaining("Same-day pickup details:"),
    }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining("Booking reference: PA-1234567890AB"),
    }));
  });

  it("adds pickup reminder instructions only when the booking was made on pickup day", async () => {
    send.mockResolvedValue({ data: { id: "email-1" }, error: null });

    await sendBookingConfirmationEmail({
      ...booking,
      pickup_date: "2026-10-03",
      created_at: "2026-10-03T10:00:00+11:00",
      additional_details: "Please call on arrival.",
    });

    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining("Same-day pickup details:"),
    }));
  });

  it("surfaces missing configuration and provider failures", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(sendBookingConfirmationEmail(booking)).rejects.toThrow("Email service is not configured.");

    vi.stubEnv("RESEND_API_KEY", "key");
    send.mockResolvedValue({ data: null, error: { message: "provider down" } });
    await expect(sendBookingConfirmationEmail(booking)).rejects.toThrow("Booking confirmation email could not be sent: provider down");
  });
});
