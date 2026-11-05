import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-auth";
import { EMAIL_ATTACHMENT_BUCKET } from "@/lib/supabase";

const previewableTypes = new Set([
  "application/pdf",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim();
  const rawIndex = url.searchParams.get("index");
  const index = rawIndex === null ? Number.NaN : Number(rawIndex);
  if (!id || !Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: "A valid email history ID and attachment index are required." }, { status: 400 });
  }

  const log = await session.admin.from("booking_email_log")
    .select("attachments")
    .eq("id", id)
    .maybeSingle();
  if (log.error) return NextResponse.json({ error: "Email attachment could not be loaded." }, { status: 500 });
  if (!log.data || !Array.isArray(log.data.attachments)) {
    return NextResponse.json({ error: "Email attachment could not be found." }, { status: 404 });
  }

  const attachment = log.data.attachments[index] as {
    filename?: unknown;
    storage_path?: unknown;
    content_type?: unknown;
  } | undefined;
  if (!attachment || typeof attachment.filename !== "string"
    || typeof attachment.storage_path !== "string" || typeof attachment.content_type !== "string") {
    return NextResponse.json({ error: "Email attachment could not be found." }, { status: 404 });
  }

  const inline = url.searchParams.get("inline") === "true";
  if (inline && !previewableTypes.has(attachment.content_type)) {
    return NextResponse.json({ error: "This attachment type can only be downloaded." }, { status: 415 });
  }

  const file = await session.admin.storage.from(EMAIL_ATTACHMENT_BUCKET).download(attachment.storage_path);
  if (file.error || !file.data) {
    console.error("Email attachment retrieval failed:", file.error);
    return NextResponse.json({ error: "Email attachment could not be retrieved." }, { status: 502 });
  }

  const filename = attachment.filename.replace(/[\r\n"]/g, "_");
  const asciiFilename = filename.replace(/[^\x20-\x7e]/g, "_");
  return new Response(file.data, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'self'",
      "Content-Type": inline ? attachment.content_type : "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
