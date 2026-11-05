import { createAdminClient, EMAIL_ATTACHMENT_BUCKET } from "@/lib/supabase";

export const customerEmailTypes = [
  "booking_request",
  "confirmation",
  "pickup_reminder",
  "custom",
  "invoice",
  "payment_receipt",
  "deposit_authorisation",
  "deposit_release",
  "deposit_capture",
  "enquiry",
] as const;

export type CustomerEmailType = (typeof customerEmailTypes)[number];
type AdminClient = ReturnType<typeof createAdminClient>;

export type CustomerEmailAttachment = {
  filename: string;
  content: Uint8Array;
};

type StoredCustomerEmailAttachment = {
  filename: string;
  storage_path: string;
  content_type: string;
  size: number;
};

function attachmentContentType(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();
  return ({
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
  } as Record<string, string>)[extension ?? ""] ?? "application/octet-stream";
}

function safeAttachmentFilename(filename: string) {
  return filename.replace(/[\\/]/g, "_").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 150) || "attachment";
}

async function removeStoredAttachments(admin: AdminClient, paths: string[]) {
  for (let offset = 0; offset < paths.length; offset += 100) {
    const result = await admin.storage.from(EMAIL_ATTACHMENT_BUCKET).remove(paths.slice(offset, offset + 100));
    if (result.error) throw new Error(`Customer email attachment cleanup failed: ${result.error.message}`);
  }
}

export async function recordCustomerEmail(
  admin: AdminClient,
  input: {
    bookingId?: string | null;
    recipientEmail: string;
    emailType: CustomerEmailType;
    providerMessageId?: string | null;
    attachments?: CustomerEmailAttachment[];
  },
) {
  const id = crypto.randomUUID();
  const result = await admin.from("booking_email_log").insert({
    id,
    booking_id: input.bookingId ?? null,
    recipient_email: input.recipientEmail,
    email_type: input.emailType,
    provider_message_id: input.providerMessageId ?? null,
    attachments_archived: !input.attachments?.length,
  });
  if (result.error) {
    throw new Error(`Customer email log persistence failed: ${result.error.message}`);
  }

  if (!input.attachments?.length) return;

  const stored: StoredCustomerEmailAttachment[] = [];
  for (const [index, attachment] of input.attachments.entries()) {
    const filename = safeAttachmentFilename(attachment.filename);
    const path = `${id}/${index}-${filename}`;
    const upload = await admin.storage.from(EMAIL_ATTACHMENT_BUCKET).upload(path, attachment.content, {
      contentType: attachmentContentType(filename),
      upsert: false,
    });
    if (upload.error) {
      await removeStoredAttachments(admin, stored.map((item) => item.storage_path));
      throw new Error(`Customer email attachment persistence failed: ${upload.error.message}`);
    }
    stored.push({
      filename: attachment.filename,
      storage_path: path,
      content_type: attachmentContentType(filename),
      size: attachment.content.byteLength,
    });
  }

  const saved = await admin.from("booking_email_log")
    .update({ attachments: stored, attachments_archived: true })
    .eq("id", id);
  if (saved.error) {
    await removeStoredAttachments(admin, stored.map((item) => item.storage_path));
    throw new Error(`Customer email attachment metadata persistence failed: ${saved.error.message}`);
  }
}

export async function removeCustomerEmailAttachments(admin: AdminClient, bookingId: string) {
  const result = await admin.from("booking_email_log").select("attachments").eq("booking_id", bookingId);
  if (result.error) throw new Error(`Customer email attachment lookup failed: ${result.error.message}`);
  const paths = (result.data ?? []).flatMap((log) => Array.isArray(log.attachments)
    ? log.attachments.flatMap((attachment: { storage_path?: unknown }) =>
      typeof attachment?.storage_path === "string" ? [attachment.storage_path] : [])
    : []);
  await removeStoredAttachments(admin, paths);
}

export async function purgeExpiredCustomerEmailHistory(admin: AdminClient, now = new Date()) {
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let deleted = 0;
  while (true) {
    const result = await admin.from("booking_email_log")
      .select("id,attachments")
      .lt("sent_at", cutoff)
      .order("sent_at", { ascending: true })
      .range(0, 499);
    if (result.error) throw new Error(`Expired email history lookup failed: ${result.error.message}`);
    const logs = result.data ?? [];
    if (!logs.length) break;

    const paths = logs.flatMap((log) => Array.isArray(log.attachments)
      ? log.attachments.flatMap((attachment: { storage_path?: unknown }) =>
        typeof attachment?.storage_path === "string" ? [attachment.storage_path] : [])
      : []);
    await removeStoredAttachments(admin, paths);

    const removal = await admin.from("booking_email_log").delete().in("id", logs.map((log) => log.id));
    if (removal.error) throw new Error(`Expired email history deletion failed: ${removal.error.message}`);
    deleted += logs.length;
    if (logs.length < 500) break;
  }
  return deleted;
}
