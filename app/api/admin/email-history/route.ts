import { NextResponse } from "next/server";
import { Resend } from "resend";

import { requireAdmin } from "@/lib/admin-auth";
import { emailConfiguration } from "@/lib/email-transport";

type StoredAttachment = {
  filename?: unknown;
  content_type?: unknown;
  size?: unknown;
  storage_path?: unknown;
};

function archivedAttachments(emailId: string, value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((attachment: StoredAttachment, index: number) =>
      typeof attachment.filename === "string" && typeof attachment.content_type === "string"
        && typeof attachment.size === "number" && typeof attachment.storage_path === "string"
        ? [{
          filename: attachment.filename,
          content_type: attachment.content_type,
          size: attachment.size,
          url: `/api/admin/email-history/attachment?id=${encodeURIComponent(emailId)}&index=${index}`,
        }]
        : [])
    : [];
}

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "An email history ID is required." }, { status: 400 });

  const log = await session.admin.from("booking_email_log")
    .select("provider_message_id,recipient_email,attachments,attachments_archived")
    .eq("id", id)
    .maybeSingle();
  if (log.error) return NextResponse.json({ error: "Email history could not be loaded." }, { status: 500 });
  if (!log.data) return NextResponse.json({ error: "Email history could not be found." }, { status: 404 });
  if (!log.data.provider_message_id) {
    return NextResponse.json({ error: "This email has no provider message ID to retrieve." }, { status: 404 });
  }

  const attachments = archivedAttachments(id, log.data.attachments);
  if (process.env.SUPABASE_TARGET === "local" && (process.env.LOCAL_EMAIL_MODE || "capture") === "capture") {
    const recipientEmail = typeof log.data.recipient_email === "string" ? log.data.recipient_email.trim() : "";
    const separator = recipientEmail.lastIndexOf("@");
    const mailbox = separator > 0 && separator < recipientEmail.length - 1
      ? recipientEmail.slice(0, separator)
      : "";
    if (!mailbox) {
      return NextResponse.json({ error: "The locally captured email has no valid recipient mailbox." }, { status: 500 });
    }

    let inboxUrl: URL;
    try {
      inboxUrl = new URL(process.env.LOCAL_EMAIL_INBOX_URL || "http://127.0.0.1:30074");
    } catch {
      return NextResponse.json({ error: "The local email inbox URL is invalid." }, { status: 500 });
    }
    if (inboxUrl.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(inboxUrl.hostname)
      || inboxUrl.username || inboxUrl.password) {
      return NextResponse.json({ error: "The local email inbox must use loopback HTTP." }, { status: 500 });
    }

    try {
      const messageUrl = new URL(
        `/api/v1/message/${encodeURIComponent(log.data.provider_message_id)}`,
        inboxUrl,
      );
      const response = await fetch(messageUrl, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        if (response.status !== 404) console.error("Local email preview retrieval failed:", response.status);
        return NextResponse.json({
          error: response.status === 404
            ? "This locally captured email could not be found in the local inbox."
            : "The locally captured email could not be retrieved from the local inbox.",
        }, { status: response.status === 404 ? 404 : 502 });
      }

      const message = await response.json() as {
        ID?: string;
        Subject?: string;
        From?: { Name?: string; Address?: string };
        Created?: string;
        HTML?: string;
        Text?: string;
      };
      return NextResponse.json(
        { email: {
          id: message.ID ?? log.data.provider_message_id,
          subject: message.Subject ?? "",
          from: message.From?.Name ? `${message.From.Name} <${message.From.Address ?? ""}>` : message.From?.Address ?? "",
          to: [recipientEmail],
          created_at: message.Created ?? "",
          html: message.HTML ?? null,
          text: message.Text ?? null,
          attachments,
          attachmentsArchived: log.data.attachments_archived,
        } },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      console.error("Local email preview retrieval failed:", error);
      return NextResponse.json({ error: "The locally captured email could not be retrieved from the local inbox." }, { status: 502 });
    }
  }

  if (process.env.SUPABASE_TARGET === "local" && !process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Email preview service is not configured." }, { status: 503 });
  }

  const { apiKey } = emailConfiguration();
  if (!apiKey) {
    return NextResponse.json({ error: "Email preview service is not configured." }, { status: 500 });
  }

  try {
    const result = await new Resend(apiKey).emails.get(log.data.provider_message_id);
    if (result.error || !result.data) {
      console.error("Email preview retrieval failed:", result.error);
      return NextResponse.json({ error: "The sent email could not be retrieved from the email provider." }, { status: 502 });
    }

    const { id: messageId, subject, from, to, created_at, html, text } = result.data;
    return NextResponse.json(
      { email: {
        id: messageId,
        subject,
        from,
        to,
        created_at,
        html,
        text,
        attachments,
        attachmentsArchived: log.data.attachments_archived,
      } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Email preview retrieval failed:", error);
    return NextResponse.json({ error: "The sent email could not be retrieved from the email provider." }, { status: 502 });
  }
}
