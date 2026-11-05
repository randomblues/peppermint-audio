import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  purgeExpiredCustomerEmailHistory: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/email-log", () => ({ purgeExpiredCustomerEmailHistory: mocks.purgeExpiredCustomerEmailHistory }));

import { GET } from "./route";

function request(authorization?: string) {
  return new Request("http://localhost/api/cron/email-history-cleanup", {
    headers: authorization ? { authorization } : {},
  });
}

describe("GET /api/cron/email-history-cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-secret");
    mocks.createAdminClient.mockReturnValue({});
    mocks.purgeExpiredCustomerEmailHistory.mockResolvedValue(0);
  });

  it("only allows requests with the configured cron secret", async () => {
    const response = await GET(request("Bearer wrong-secret"));
    expect(response.status).toBe(401);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("purges expired email history and reports the count", async () => {
    mocks.purgeExpiredCustomerEmailHistory.mockResolvedValue(3);
    const response = await GET(request("Bearer test-secret"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: 3 });
    expect(mocks.purgeExpiredCustomerEmailHistory).toHaveBeenCalledWith({});
  });

  it("surfaces cleanup failures", async () => {
    mocks.purgeExpiredCustomerEmailHistory.mockRejectedValue(new Error("storage unavailable"));
    const response = await GET(request("Bearer test-secret"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Email history cleanup failed. Check server logs." });
  });
});
