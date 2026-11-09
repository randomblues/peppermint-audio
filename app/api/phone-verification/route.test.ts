import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createSmsProvider: vi.fn(),
  send: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/sms-provider", () => ({ createSmsProvider: mocks.createSmsProvider }));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/phone-verification", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.1" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/phone-verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SMS_OTP_HASH_SECRET", "test-secret");
    mocks.createSmsProvider.mockReturnValue({ send: mocks.send });
    mocks.send.mockResolvedValue({ id: "provider-id" });
    mocks.createAdminClient.mockReturnValue({
      rpc: vi.fn().mockImplementation((name: string) => Promise.resolve({
        data: name === "issue_booking_phone_verification" ? true : "verified",
        error: null,
      })),
    });
  });

  it("creates a rate-limited challenge and sends the code to a normalized Australian mobile", async () => {
    const response = await POST(request({ action: "send", mobile: "0412 345 678" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true });
    expect(payload.challengeToken).toHaveLength(43);
    const admin = mocks.createAdminClient.mock.results[0].value;
    expect(admin.rpc).toHaveBeenCalledWith("issue_booking_phone_verification", expect.objectContaining({
      p_phone: "61412345678",
      p_ip_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_code_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_expires_at: expect.any(String),
    }));
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+61412345678",
        body: expect.stringMatching(/Peppermint Audio booking code: \d{6}/),
      }),
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );
    expect(mocks.send.mock.calls[0][0].body).not.toMatch(/optout|Opt out|Reply Stop/);
  });

  it("checks a submitted code against the challenge and returns verified state", async () => {
    const sendResponse = await POST(request({ action: "send", mobile: "0412345678" }));
    const { challengeToken } = await sendResponse.json();
    const sentBody = mocks.send.mock.calls[0][0].body as string;
    const code = sentBody.match(/\b(\d{6})\b/)?.[1];

    const response = await POST(request({ action: "verify", mobile: "0412 345 678", challengeToken, code }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, verified: true });
    const admin = mocks.createAdminClient.mock.results[0].value;
    expect(admin.rpc).toHaveBeenLastCalledWith("check_booking_phone_verification", {
      p_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_code_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("does not send if the challenge rate limit is reached", async () => {
    mocks.createAdminClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    });

    const response = await POST(request({ action: "send", mobile: "0412345678" }));

    expect(response.status).toBe(429);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("rejects malformed or non-Australian mobile numbers before creating a challenge", async () => {
    const response = await POST(request({ action: "send", mobile: "+1 415 555 0100" }));

    expect(response.status).toBe(400);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("does not send when SMS delivery fails", async () => {
    mocks.send.mockRejectedValueOnce(new Error("provider unavailable"));

    const response = await POST(request({ action: "send", mobile: "0412345678" }));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "We could not send a code to that number. Please try again shortly.",
    });
  });

  it("surfaces invalid and expired code outcomes", async () => {
    const admin = { rpc: vi.fn().mockResolvedValue({ data: "expired", error: null }) };
    mocks.createAdminClient.mockReturnValue(admin);

    const response = await POST(request({
      action: "verify",
      mobile: "0412345678",
      challengeToken: "a".repeat(43),
      code: "123456",
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "That code has expired. Request a new code." });
  });
});
