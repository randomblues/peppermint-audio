import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateEmailOptions } from "resend";

const { send, constructor } = vi.hoisted(() => ({ send: vi.fn(), constructor: vi.fn() }));
vi.mock("resend", () => ({
  Resend: vi.fn(function (key: string) { constructor(key); return { emails: { send } }; }),
}));

import { EmailTransport, emailConfiguration } from "./email-transport";

const message: CreateEmailOptions = {
  from: "Peppermint Audio <from@example.com>", to: ["customer@example.com", "billing@example.com"],
  cc: ["copy@example.com"], bcc: "hidden@example.com", replyTo: "reply@example.com",
  headers: { "Reply-To": "unsafe@example.com", Bcc: "unsafe@example.com" },
  subject: "Test invoice", text: "Test body", html: "<p>Test body</p>",
};
const fetchMock = vi.fn();
const transport = () => new EmailTransport(emailConfiguration().apiKey!);

describe("safe email transport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("SUPABASE_TARGET", "local");
    for (const name of ["LOCAL_EMAIL_MODE", "LOCAL_EMAIL_TEST_RECIPIENT", "LOCAL_EMAIL_INBOX_URL",
      "RESEND_API_KEY", "ENQUIRY_FROM_EMAIL", "ENQUIRY_TO_EMAIL"]) vi.stubEnv(name, "");
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ID: "local-id" }), { status: 200 }));
    send.mockResolvedValue({ data: { id: "provider-id" }, error: null });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it.each(["development", "production"])("captures without provider configuration in %s", async (nodeEnv) => {
    vi.stubEnv("NODE_ENV", nodeEnv);
    expect(emailConfiguration()).toEqual({
      apiKey: "local-capture", from: "Peppermint Audio <hello@peppermint.local>", to: "team@peppermint.local",
    });
    expect(await transport().emails.send(message)).toMatchObject({ data: { id: "local-id" }, error: null });
    expect(constructor).not.toHaveBeenCalled();
    const [url, request] = fetchMock.mock.calls[0];
    expect(url.href).toBe("http://127.0.0.1:30074/api/v1/send");
    expect(request.redirect).toBe("error");
    expect(JSON.parse(request.body)).toMatchObject({
      From: { Name: "Peppermint Audio", Email: "from@example.com" },
      To: [{ Email: "customer@example.com" }, { Email: "billing@example.com" }],
      Cc: [{ Email: "copy@example.com" }], Bcc: ["hidden@example.com"],
      ReplyTo: [{ Email: "reply@example.com" }], Text: "Test body", HTML: "<p>Test body</p>",
    });
  });

  it("captures PDF attachments as base64 and never fetches attachment URLs", async () => {
    await transport().emails.send({ ...message, attachments: [
      { filename: "invoice.pdf", content: Buffer.from("test pdf"), contentType: "application/pdf" },
      { filename: "receipt.pdf", content: "cGRm" },
    ] });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).Attachments).toEqual([
      { Filename: "invoice.pdf", Content: Buffer.from("test pdf").toString("base64"), ContentType: "application/pdf" },
      { Filename: "receipt.pdf", Content: "cGRm" },
    ]);
    fetchMock.mockClear();
    expect(await transport().emails.send({ ...message, attachments: [{ path: "https://example.com/private.pdf", filename: "invoice.pdf" }] }))
      .toMatchObject({ data: null, error: { message: "Local inbox delivery failed." } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still captures when provider credentials and external recipients are configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("ENQUIRY_FROM_EMAIL", "verified@example.com");
    vi.stubEnv("ENQUIRY_TO_EMAIL", "external@example.com");
    await transport().emails.send(message);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(constructor).not.toHaveBeenCalled();
  });

  it("redirects all recipients, strips reply and header recipients, and preserves attachments/options", async () => {
    vi.stubEnv("LOCAL_EMAIL_MODE", "resend");
    vi.stubEnv("LOCAL_EMAIL_TEST_RECIPIENT", "test-inbox@example.com");
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("ENQUIRY_FROM_EMAIL", "verified@example.com");
    const attachments = [{ filename: "invoice.pdf", content: "cGRm" }];
    const options = { idempotencyKey: "test-id" };
    await transport().emails.send({ ...message, attachments }, options);
    expect(send).toHaveBeenCalledWith({
      from: message.from, to: ["test-inbox@example.com"], subject: message.subject,
      text: message.text, html: message.html, attachments,
    }, options);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["", "a@example.com,b@example.com", "Name <a@example.com>", "a@example.com\nBcc: b@example.com", "a..b@example.com", "invalid"])(
    "rejects unsafe Resend recipient %j before constructing a provider", async (recipient) => {
      vi.stubEnv("LOCAL_EMAIL_MODE", "resend");
      vi.stubEnv("LOCAL_EMAIL_TEST_RECIPIENT", recipient);
      vi.stubEnv("RESEND_API_KEY", "test-key");
      vi.stubEnv("ENQUIRY_FROM_EMAIL", "verified@example.com");
      expect((await transport().emails.send(message)).error).not.toBeNull();
      expect(constructor).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each(["RESEND_API_KEY", "ENQUIRY_FROM_EMAIL"])("requires explicit %s in controlled Resend mode", async (missing) => {
    vi.stubEnv("LOCAL_EMAIL_MODE", "resend");
    vi.stubEnv("LOCAL_EMAIL_TEST_RECIPIENT", "test-inbox@example.com");
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("ENQUIRY_FROM_EMAIL", "verified@example.com");
    vi.stubEnv(missing, "");
    expect((await transport().emails.send(message)).error).not.toBeNull();
    expect(constructor).not.toHaveBeenCalled();
  });

  it("preserves controlled Resend provider rejection and network errors without capture fallback", async () => {
    vi.stubEnv("LOCAL_EMAIL_MODE", "resend");
    vi.stubEnv("LOCAL_EMAIL_TEST_RECIPIENT", "test-inbox@example.com");
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("ENQUIRY_FROM_EMAIL", "verified@example.com");
    const response = { data: null, error: { message: "Rejected" } };
    send.mockResolvedValueOnce(response);
    expect(await transport().emails.send(message)).toBe(response);
    send.mockRejectedValueOnce(new Error("network failure"));
    await expect(transport().emails.send(message)).rejects.toThrow("network failure");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an unknown mode without delivery or fallback", async () => {
    vi.stubEnv("LOCAL_EMAIL_MODE", "smtp");
    expect((await transport().emails.send(message)).error?.message).toBe("Invalid local email mode.");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(constructor).not.toHaveBeenCalled();
  });

  it.each(["https://example.com", "http://example.com", "http://user:password@localhost:30074"])(
    "rejects unsafe capture endpoint %s", async (url) => {
      vi.stubEnv("LOCAL_EMAIL_INBOX_URL", url);
      expect((await transport().emails.send(message)).error).not.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("surfaces inbox HTTP, malformed receipt and network errors without provider fallback", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 503 }));
    expect((await transport().emails.send(message)).error?.message).toContain("503");
    fetchMock.mockResolvedValueOnce(new Response("{}"));
    expect((await transport().emails.send(message)).error?.message).toContain("invalid message receipt");
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect((await transport().emails.send(message)).error?.message).toBe("Local inbox delivery failed.");
    expect(constructor).not.toHaveBeenCalled();
  });

  it("preserves nonlocal payload, options, provider errors and missing configuration", async () => {
    vi.stubEnv("SUPABASE_TARGET", "");
    vi.stubEnv("LOCAL_EMAIL_MODE", "invalid");
    expect(emailConfiguration()).toEqual({ apiKey: undefined, from: undefined, to: undefined });
    vi.stubEnv("RESEND_API_KEY", "production-key");
    const response = { data: null, error: { message: "Provider rejected" } };
    send.mockResolvedValueOnce(response);
    expect(await transport().emails.send(message)).toBe(response);
    expect(send).toHaveBeenCalledWith(message);
    const options = { idempotencyKey: "production-id" };
    await transport().emails.send(message, options);
    expect(send).toHaveBeenLastCalledWith(message, options);
    send.mockRejectedValueOnce(new Error("provider network failure"));
    await expect(transport().emails.send(message)).rejects.toThrow("provider network failure");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
