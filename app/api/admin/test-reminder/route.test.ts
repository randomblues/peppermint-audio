import { describe, expect, it, vi } from "vitest";

const { requireAdmin, send } = vi.hoisted(() => ({ requireAdmin: vi.fn(), send: vi.fn() }));

vi.mock("@/lib/admin-auth", () => ({ requireAdmin }));
vi.mock("resend", () => ({ Resend: vi.fn(() => ({ emails: { send } })) }));
vi.mock("@/lib/pickup-reminders", () => ({
  buildPickupReminderEmail: vi.fn(() => ({ subject: "Pickup reminder", text: "text", html: "<p>html</p>" })),
  getMelbourneTomorrow: vi.fn(() => "2026-09-29"),
}));

import { POST } from "./route";

describe("POST /api/admin/test-reminder", () => {
  it("requires an admin session", async () => {
    requireAdmin.mockResolvedValue(null);
    const response = await POST(new Request("http://localhost/api/admin/test-reminder", { method: "POST", body: JSON.stringify({ email: "test@example.com" }) }));
    expect(response.status).toBe(401);
  });

  it("sends the current reminder template to the requested recipient", async () => {
    requireAdmin.mockResolvedValue({});
    send.mockResolvedValue({ data: { id: "email-id" }, error: null });
    vi.stubEnv("RESEND_API_KEY", "key");
    vi.stubEnv("ENQUIRY_FROM_EMAIL", "Peppermint Audio <test@example.com>");
    const response = await POST(new Request("http://localhost/api/admin/test-reminder", { method: "POST", body: JSON.stringify({ email: "recipient@example.com" }) }));
    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: ["recipient@example.com"], subject: "Pickup reminder" }));
  });
});
