import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdmin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin-auth", () => ({ requireAdmin }));

import { requireAdminJson } from "@/lib/admin-request";

const jsonRequest = (body: string) => new Request("http://localhost/api", { method: "POST", body });

describe("requireAdminJson", () => {
  beforeEach(() => requireAdmin.mockReset());

  it("returns 401 without reading the body when the caller is not an admin", async () => {
    requireAdmin.mockResolvedValue(null);
    const request = jsonRequest("{}");
    const result = await requireAdminJson(request);
    expect("response" in result && result.response.status).toBe(401);
    expect("response" in result && await result.response.json()).toEqual({ error: "Unauthorized" });
    expect(request.bodyUsed).toBe(false);
  });

  it("returns 400 for malformed JSON", async () => {
    requireAdmin.mockResolvedValue({ admin: {} });
    const result = await requireAdminJson(jsonRequest("{"));
    expect("response" in result && result.response.status).toBe(400);
    expect("response" in result && await result.response.json()).toEqual({ error: "Invalid JSON body." });
  });

  it("returns the admin session and parsed body", async () => {
    const session = { admin: {}, user: { id: "u1" } };
    requireAdmin.mockResolvedValue(session);
    const result = await requireAdminJson<{ bookingId: string }>(jsonRequest(JSON.stringify({ bookingId: "b1" })));
    expect(result).toEqual({ session, body: { bookingId: "b1" } });
  });
});
