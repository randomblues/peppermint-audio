import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSmsProvider } from "./sms-provider";
import { MobileMessageSmsProvider } from "./mobilemessage-sms-provider";

const fetchMock = vi.fn();
const message = { to: "+61412345678", body: "Peppermint Audio: Your code is 123456." };
const success = () => new Response(JSON.stringify({
  status: "complete",
  total_cost: 1,
  results: [{ status: "success", message_id: "message-id", cost: 1 }],
}), { status: 200 });

function productionEnvironment(overrides: Readonly<Record<string, string | undefined>> = {}) {
  return {
    NODE_ENV: "production",
    SMS_PROVIDER: "mobilemessage",
    MOBILEMESSAGE_API_USERNAME: "api-user",
    MOBILEMESSAGE_API_PASSWORD: "api-password",
    MOBILEMESSAGE_SENDER_ID: "61412345678",
    ...overrides,
  };
}

describe("Mobile Message SMS adapter", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => success());
  });

  it("allows the explicitly approved three-part pickup message without changing other sends", async () => {
    const provider = createSmsProvider(productionEnvironment());
    await provider.send({ ...message, maxParts: 3 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).max_parts).toBe(3);
    await provider.send(message);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).max_parts).toBe(1);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends a single one-part message with idempotency and returns its provider ID", async () => {
    const provider = createSmsProvider(productionEnvironment());

    await expect(provider.send(message, { idempotencyKey: "otp-challenge-1" }))
      .resolves.toEqual({ id: "message-id" });

    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.mobilemessage.com.au/v1/messages");
    expect(request.method).toBe("POST");
    expect(request.headers.Authorization).toBe(`Basic ${Buffer.from("api-user:api-password").toString("base64")}`);
    expect(request.headers["Idempotency-Key"]).toBe("otp-challenge-1");
    expect(request.redirect).toBe("error");
    expect(JSON.parse(request.body)).toEqual({
      messages: [{
        to: "61412345678",
        message: message.body,
        sender: "61412345678",
      }],
      max_parts: 1,
      enable_unicode: false,
    });
  });

  it("redirects explicit local sends to the configured test number", async () => {
    const provider = createSmsProvider({
      ...productionEnvironment(),
      NODE_ENV: "development",
      SUPABASE_TARGET: "local",
      IS_LOCAL_SMS_ENABLED: "true",
      LOCAL_SMS_TEST_RECIPIENT: "0400000000",
    });

    await provider.send(message);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].to).toBe("61400000000");
  });

  it.each([undefined, "", "false", "0", "1", "yes", "TRUE", "mobilemessage"])("keeps local sends disabled for flag value %s", (flag) => {
    expect(() => createSmsProvider({
      ...productionEnvironment(),
      NODE_ENV: "development",
      SUPABASE_TARGET: "local",
      IS_LOCAL_SMS_ENABLED: flag,
    })).toThrow("IS_LOCAL_SMS_ENABLED=true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported providers, missing credentials, and invalid local recipients", () => {
    const local = {
      ...productionEnvironment(),
      NODE_ENV: "development",
      SUPABASE_TARGET: "local",
      IS_LOCAL_SMS_ENABLED: "true",
      LOCAL_SMS_TEST_RECIPIENT: "not-a-number",
    };

    expect(() => createSmsProvider(productionEnvironment({ SMS_PROVIDER: "other" })))
      .toThrow("SMS_PROVIDER must be set to a supported provider.");
    expect(() => createSmsProvider(local))
      .toThrow("Local SMS requires one valid LOCAL_SMS_TEST_RECIPIENT.");
    expect(() => createSmsProvider(productionEnvironment({ MOBILEMESSAGE_API_PASSWORD: "" })))
      .toThrow("SMS requires MOBILEMESSAGE_API_USERNAME, MOBILEMESSAGE_API_PASSWORD, and MOBILEMESSAGE_SENDER_ID.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores the local enable flag and test recipient in production", async () => {
    const provider = createSmsProvider(productionEnvironment({
      IS_LOCAL_SMS_ENABLED: "false",
      LOCAL_SMS_TEST_RECIPIENT: "0400000000",
    }));
    await provider.send(message);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].to).toBe("61412345678");
  });

  it("requires the local enable flag even for a production build targeting local Supabase", () => {
    expect(() => createSmsProvider(productionEnvironment({ SUPABASE_TARGET: "local" })))
      .toThrow("IS_LOCAL_SMS_ENABLED=true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid recipient and empty content before sending", async () => {
    const provider = new MobileMessageSmsProvider({
      username: "api-user", password: "api-password", senderId: "61412345678",
    }, fetchMock);

    await expect(provider.send({ to: "123", body: "Test" })).rejects.toThrow("Australian mobile number");
    await expect(provider.send({ to: "0412345678", body: " " })).rejects.toThrow("must not be empty");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects blocked, failed, malformed, and network outcomes", async () => {
    const provider = createSmsProvider(productionEnvironment());

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ status: "blocked" }] })));
    await expect(provider.send(message)).rejects.toThrow("recipient has opted out");

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ status: "error" }] })));
    await expect(provider.send(message)).rejects.toThrow("did not accept");

    fetchMock.mockResolvedValueOnce(new Response("{}"));
    await expect(provider.send(message)).rejects.toThrow("invalid response");

    fetchMock.mockResolvedValueOnce(new Response("null"));
    await expect(provider.send(message)).rejects.toThrow("invalid response");

    fetchMock.mockResolvedValueOnce(new Response("", { status: 403 }));
    await expect(provider.send(message)).rejects.toThrow("rejected the request (403)");

    fetchMock.mockRejectedValueOnce(new Error("network failure"));
    await expect(provider.send(message)).rejects.toThrow("network failure");
  });
});
