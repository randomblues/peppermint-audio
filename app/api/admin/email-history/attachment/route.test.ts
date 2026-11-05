import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  download: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/supabase", () => ({ EMAIL_ATTACHMENT_BUCKET: "booking-email-attachments" }));

import { GET } from "./route";

const request = (url: string) => new Request(`http://localhost${url}`);

function adminSession(data: unknown = {
  attachments: [{ filename: "invoice.pdf", storage_path: "email-1/0-invoice.pdf", content_type: "application/pdf" }],
}) {
  return {
    admin: {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
      }),
      storage: {
        from: vi.fn().mockReturnValue({ download: mocks.download }),
      },
    },
  };
}

describe("GET /api/admin/email-history/attachment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue(adminSession());
    mocks.download.mockResolvedValue({ data: new Uint8Array(Buffer.from("pdf content")), error: null });
  });

  it("requires authentication and valid attachment parameters", async () => {
    mocks.requireAdmin.mockResolvedValueOnce(null);
    expect((await GET(request("/api/admin/email-history/attachment?id=email-1&index=0"))).status).toBe(401);
    expect((await GET(request("/api/admin/email-history/attachment?id=email-1"))).status).toBe(400);
  });

  it("returns an attachment only to authenticated admins", async () => {
    const response = await GET(request("/api/admin/email-history/attachment?id=email-1&index=0"));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("pdf content");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.download).toHaveBeenCalledWith("email-1/0-invoice.pdf");
  });

  it("serves supported files inline and rejects unsafe preview types", async () => {
    const inline = await GET(request("/api/admin/email-history/attachment?id=email-1&index=0&inline=true"));
    expect(inline.headers.get("content-disposition")).toContain("inline");
    expect(inline.headers.get("content-type")).toBe("application/pdf");

    mocks.requireAdmin.mockResolvedValueOnce(adminSession({
      attachments: [{ filename: "document.docx", storage_path: "email-1/0-document.docx", content_type: "application/octet-stream" }],
    }));
    const rejected = await GET(request("/api/admin/email-history/attachment?id=email-1&index=0&inline=true"));
    expect(rejected.status).toBe(415);
  });

  it("reports missing attachments and storage failures", async () => {
    mocks.requireAdmin.mockResolvedValueOnce(adminSession({ attachments: [] }));
    expect((await GET(request("/api/admin/email-history/attachment?id=email-1&index=0"))).status).toBe(404);

    mocks.download.mockResolvedValueOnce({ data: null, error: { message: "storage unavailable" } });
    const response = await GET(request("/api/admin/email-history/attachment?id=email-1&index=0"));
    expect(response.status).toBe(502);
  });
});
