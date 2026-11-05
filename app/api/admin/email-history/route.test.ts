import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  get: vi.fn(),
  Resend: vi.fn(() => ({ emails: { get: mocks.get } })),
}));

vi.mock("@/lib/admin-auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/email-transport", () => ({
  emailConfiguration: () => ({ apiKey: "resend-test-key" }),
}));
vi.mock("resend", () => ({ Resend: mocks.Resend }));

import { GET } from "./route";

const request = (url: string) => new Request(`http://localhost${url}`);
const fetchMock = vi.fn();

function adminSession(data: unknown = { provider_message_id: "provider-1" }) {
  return {
    admin: {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
      }),
    },
  };
}

describe("GET /api/admin/email-history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SUPABASE_TARGET", "hosted");
    vi.stubEnv("LOCAL_EMAIL_MODE", "");
    vi.stubEnv("LOCAL_EMAIL_INBOX_URL", "");
    vi.stubEnv("RESEND_API_KEY", "");
    mocks.requireAdmin.mockResolvedValue(adminSession());
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("requires an admin session and an email history ID", async () => {
    mocks.requireAdmin.mockResolvedValueOnce(null);
    expect((await GET(request("/api/admin/email-history?id=email-1"))).status).toBe(401);
    expect((await GET(request("/api/admin/email-history"))).status).toBe(400);
  });

  it("returns not found when the log has no provider message ID", async () => {
    mocks.requireAdmin.mockResolvedValueOnce(adminSession({ provider_message_id: null }));
    const response = await GET(request("/api/admin/email-history?id=email-1"));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "This email has no provider message ID to retrieve." });
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("retrieves the original rendered message using the stored provider ID", async () => {
    const attachment = {
      filename: "invoice.pdf",
      content_type: "application/pdf",
      size: 1024,
      storage_path: "private/provider-one/0-invoice.pdf",
    };
    const session = adminSession({ provider_message_id: "provider-1", attachments: [attachment], attachments_archived: true });
    mocks.requireAdmin.mockResolvedValueOnce(session);
    mocks.get.mockResolvedValue({
      data: {
        id: "provider-1", subject: "Booking confirmed", from: "team@example.com",
        to: ["alex@example.com"], created_at: "2026-10-03T00:00:00Z",
        html: "<h1>Confirmed</h1>", text: "Confirmed",
      },
      error: null,
    });
    const response = await GET(request("/api/admin/email-history?id=email-1"));
    expect(response.status).toBe(200);
    expect(mocks.get).toHaveBeenCalledWith("provider-1");
    expect(await response.json()).toEqual({
      email: {
        id: "provider-1", subject: "Booking confirmed", from: "team@example.com",
        to: ["alex@example.com"], created_at: "2026-10-03T00:00:00Z",
        html: "<h1>Confirmed</h1>", text: "Confirmed",
        attachments: [{
          filename: "invoice.pdf",
          content_type: "application/pdf",
          size: 1024,
          url: "/api/admin/email-history/attachment?id=email-1&index=0",
        }],
        attachmentsArchived: true,
      },
    });
  });

  it("retrieves locally captured email from the local inbox even if Resend is configured", async () => {
    vi.stubEnv("SUPABASE_TARGET", "local");
    vi.stubEnv("LOCAL_EMAIL_MODE", "capture");
    vi.stubEnv("LOCAL_EMAIL_INBOX_URL", "http://127.0.0.1:54324");
    vi.stubEnv("RESEND_API_KEY", "resend-configured");
    vi.stubGlobal("fetch", fetchMock);
    mocks.requireAdmin.mockResolvedValueOnce(adminSession({
      provider_message_id: "capture-1",
      recipient_email: "qa-special@example.invalid",
      attachments: [],
      attachments_archived: true,
    }));
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ID: "capture-1",
        Subject: "Booking confirmed",
        From: { Name: "Peppermint Audio", Address: "team@peppermint.local" },
        Created: "2026-10-03T00:00:00Z",
        HTML: "<h1>Confirmed</h1>",
        Text: "Confirmed",
      }),
    });

    const response = await GET(request("/api/admin/email-history?id=email-1"));

    expect(response.status).toBe(200);
    expect(String(fetchMock.mock.calls[0][0])).toBe("http://127.0.0.1:54324/api/v1/message/capture-1");
    expect(mocks.get).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      email: {
        id: "capture-1",
        subject: "Booking confirmed",
        from: "Peppermint Audio <team@peppermint.local>",
        to: ["qa-special@example.invalid"],
        created_at: "2026-10-03T00:00:00Z",
        html: "<h1>Confirmed</h1>",
        text: "Confirmed",
      },
    });
  });

  it("rejects a non-loopback local inbox URL", async () => {
    vi.stubEnv("SUPABASE_TARGET", "local");
    vi.stubEnv("LOCAL_EMAIL_MODE", "capture");
    vi.stubEnv("LOCAL_EMAIL_INBOX_URL", "http://email-host.example");
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request("/api/admin/email-history?id=email-1"));

    expect(response.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports provider retrieval failures", async () => {
    mocks.get.mockResolvedValue({ data: null, error: { message: "provider unavailable" } });
    const response = await GET(request("/api/admin/email-history?id=email-1"));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "The sent email could not be retrieved from the email provider." });
  });
});
