import { beforeEach, describe, expect, it, vi } from "vitest";

const { send, recordCustomerEmail, Resend } = vi.hoisted(() => {
  process.env.RESEND_API_KEY = "re_test";
  process.env.ENQUIRY_FROM_EMAIL = "Peppermint Audio <from@example.com>";
  process.env.ENQUIRY_TO_EMAIL = "to@example.com";
  const send = vi.fn();
  return { send, recordCustomerEmail: vi.fn(), Resend: vi.fn(() => ({ emails: { send } })) };
});

vi.mock("resend", () => ({ Resend }));
vi.mock("@/lib/email-log", () => ({ recordCustomerEmail }));
vi.mock("@/lib/supabase", () => ({ createAdminClient: vi.fn() }));

import { POST } from "./route";

const validPayload = {
  name: "Alex Example",
  email: "alex@example.com",
  phone: "0412345678",
  eventDate: "2026-10-10",
  eventType: "Wedding",
  packageInterest: "Party Package",
  guestCount: "80",
  message: "We are planning a wedding and need sound for the reception.",
};

function request(body: unknown) {
  return new Request("http://localhost/api/enquiry", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/enquiry", () => {
  beforeEach(() => {
    send.mockReset();
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("ENQUIRY_FROM_EMAIL", "Peppermint Audio <from@example.com>");
    vi.stubEnv("ENQUIRY_TO_EMAIL", "to@example.com");
  });

  it("rejects invalid form details without sending email", async () => {
    const response = await POST(request({ ...validPayload, email: "not-an-email" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Please check the form details and try again." });
    expect(send).not.toHaveBeenCalled();
  });

  it("returns a configuration error when the email service is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.resetModules();
    const { POST: post } = await import("./route");

    const response = await post(request(validPayload));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error:
        "Email service is not configured yet. Please add RESEND_API_KEY, ENQUIRY_FROM_EMAIL, and ENQUIRY_TO_EMAIL.",
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("sends a validated enquiry", async () => {
    send.mockResolvedValue({ data: { id: "email-id" }, error: null });

    const response = await POST(request(validPayload));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(send).toHaveBeenCalledWith({
      from: "Peppermint Audio <from@example.com>",
      to: ["to@example.com"],
      replyTo: "alex@example.com",
      subject: "New enquiry: Wedding on 2026-10-10",
      text: expect.stringContaining("Estimated guests: 80"),
    });
  });

  it("returns an error when Resend rejects", async () => {
    send.mockRejectedValue(new Error("Resend unavailable"));

    const response = await POST(request(validPayload));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Something went wrong while sending your enquiry." });
  });

  it("rejects the honeypot without sending email", async () => {
    const response = await POST(request({ ...validPayload, website: "https://spam.example" }));

    expect(response.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects obvious supplier spam without sending email", async () => {
    const response = await POST(request({
      ...validPayload,
      eventType: "Bluetooth speaker manufacturer",
      message: "We are a supplier with best-selling models. Would you like us to send you prices?",
    }));

    expect(response.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("includes Google Ads attribution in the notification", async () => {
    send.mockResolvedValue({ data: { id: "email-id" }, error: null });

    await POST(request({
      ...validPayload,
      attribution: {
        gclid: "test-click-id",
        utmSource: "google",
        utmCampaign: "melbourne-pa",
      },
    }));

    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining("Google click ID: test-click-id"),
    }));
  });
});
