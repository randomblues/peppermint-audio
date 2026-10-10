import { Resend, type CreateEmailOptions, type CreateEmailRequestOptions } from "resend";
import { z } from "zod";

const singleAddress = z.email();

export function emailConfiguration() {
  const local = process.env.SUPABASE_TARGET === "local";
  return {
    apiKey: process.env.RESEND_API_KEY || (local ? "local-capture" : undefined),
    from: process.env.ENQUIRY_FROM_EMAIL || (local ? "Peppermint Audio <hello@peppermint.local>" : undefined),
    to: process.env.ENQUIRY_TO_EMAIL || (local ? "team@peppermint.local" : undefined),
  };
}

function addresses(value: string | string[] | undefined) {
  return (value ? Array.isArray(value) ? value : [value] : []).map((address) => {
    const match = address.match(/^(.*?)\s*<([^<>]+)>$/);
    return match ? { Name: match[1].trim(), Email: match[2] } : { Email: address };
  });
}

// Keep the provider's response contract so every existing caller handles failures normally.
export class EmailTransport {
  constructor(private readonly apiKey: string) {}

  emails = {
    send: async (message: CreateEmailOptions, options?: CreateEmailRequestOptions) => {
      if (process.env.SUPABASE_TARGET !== "local") {
        const provider = new Resend(this.apiKey);
        return options ? provider.emails.send(message, options) : provider.emails.send(message);
      }
      const failure = (message: string) => ({
        data: null, error: { name: "validation_error" as const, message }, headers: null,
      });
      const mode = process.env.LOCAL_EMAIL_MODE || "capture";
      if (mode === "resend") {
        const recipient = process.env.LOCAL_EMAIL_TEST_RECIPIENT?.trim();
        if (!recipient || !singleAddress.safeParse(recipient).success || !process.env.RESEND_API_KEY || !process.env.ENQUIRY_FROM_EMAIL) {
          return failure("Local Resend requires a single valid test recipient, API key and sender.");
        }
        const { cc: _cc, bcc: _bcc, replyTo: _replyTo, headers: _headers, ...safe } = message;
        void _cc; void _bcc; void _replyTo; void _headers;
        const provider = new Resend(process.env.RESEND_API_KEY);
        const redirected = { ...safe, to: [recipient] };
        return options ? provider.emails.send(redirected, options) : provider.emails.send(redirected);
      }
      if (mode !== "capture") return failure("Invalid local email mode.");
      try {
        const endpoint = new URL(process.env.LOCAL_EMAIL_INBOX_URL || "http://127.0.0.1:30074");
        if (endpoint.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname)
          || endpoint.username || endpoint.password) return failure("Local inbox must use a loopback HTTP URL.");
        const attachments = message.attachments?.map((attachment) => {
          if (attachment.path || !attachment.content) throw new Error("Local attachments require inline content.");
          return {
            Filename: attachment.filename,
            Content: typeof attachment.content === "string" ? attachment.content : Buffer.from(attachment.content).toString("base64"),
            ContentType: attachment.contentType,
            ContentID: attachment.contentId,
          };
        });
        const response = await fetch(new URL("/api/v1/send", endpoint), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          redirect: "error",
          signal: AbortSignal.timeout(10_000),
          body: JSON.stringify({
            From: addresses(message.from)[0], To: addresses(message.to),
            Cc: addresses(message.cc), Bcc: addresses(message.bcc).map(({ Email }) => Email),
            ReplyTo: addresses(message.replyTo), Subject: message.subject,
            Text: message.text, HTML: message.html, Attachments: attachments,
          }),
        });
        if (!response.ok) return failure(`Local inbox rejected email (${response.status}).`);
        const result = await response.json() as { ID?: string };
        if (!result.ID) return failure("Local inbox returned an invalid message receipt.");
        return { data: { id: result.ID }, error: null, headers: null };
      } catch {
        return failure("Local inbox delivery failed.");
      }
    },
  };
}
