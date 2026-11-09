import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase";
import { buildPhoneVerificationSms } from "@/lib/sms-messages";
import { createPhoneVerification, phoneVerificationCodeHash, phoneVerificationIpHash, phoneVerificationTokenHash } from "@/lib/phone-verification";
import { normalizeAustralianMobileNumber } from "@/lib/sms-mobile-number";
import { createSmsProvider } from "@/lib/sms-provider";
import { SmsTransport } from "@/lib/sms-transport";

export const runtime = "nodejs";

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("send"), mobile: z.string().min(1).max(40) }),
  z.object({
    action: z.literal("verify"),
    mobile: z.string().min(1).max(40),
    challengeToken: z.string().min(40).max(100),
    code: z.string().regex(/^\d{6}$/),
  }),
]);

function requestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",").map((value) => value.trim()).filter(Boolean).at(-1)
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please submit a valid verification request." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter a valid mobile number and verification details." }, { status: 400 });
  }
  const phone = normalizeAustralianMobileNumber(parsed.data.mobile);
  if (!phone) {
    return NextResponse.json({ error: "Please enter a valid Australian mobile number." }, { status: 400 });
  }

  const secret = process.env.SMS_OTP_HASH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Phone verification is not configured." }, { status: 500 });
  }

  const admin = createAdminClient();
  if (parsed.data.action === "verify") {
    const result = await admin.rpc("check_booking_phone_verification", {
      p_token_hash: phoneVerificationTokenHash(secret, parsed.data.challengeToken),
      p_code_hash: phoneVerificationCodeHash(secret, parsed.data.challengeToken, phone, parsed.data.code),
    });
    if (result.error) {
      console.error("Phone verification check failed:", result.error);
      return NextResponse.json({ error: "Phone verification could not be checked. Please try again." }, { status: 500 });
    }
    if (result.data !== "verified") {
      const error = result.data === "expired"
        ? "That code has expired. Request a new code."
        : result.data === "attempt_limit"
          ? "Too many incorrect attempts. Request a new code."
          : "That code is incorrect. Check it and try again.";
      return NextResponse.json({ error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, verified: true });
  }

  let provider: SmsTransport;
  try {
    provider = new SmsTransport(createSmsProvider());
  } catch (error) {
    console.error("SMS verification configuration error:", error);
    return NextResponse.json({ error: "SMS verification is not available right now." }, { status: 503 });
  }

  const challenge = createPhoneVerification(secret, phone);
  const rateLimit = await admin.rpc("issue_booking_phone_verification", {
    p_phone: phone,
    p_token_hash: challenge.tokenHash,
    p_code_hash: challenge.codeHash,
    p_ip_hash: phoneVerificationIpHash(secret, requestIp(request)),
    p_expires_at: challenge.expiresAt,
  });
  if (rateLimit.error) {
    console.error("Phone verification challenge could not be created:", rateLimit.error);
    return NextResponse.json({ error: "A verification code could not be sent. Please try again." }, { status: 500 });
  }
  if (!rateLimit.data) {
    return NextResponse.json({ error: "Too many code requests. Please wait before trying again." }, { status: 429 });
  }

  try {
    await provider.send(
      { to: `+${phone}`, body: buildPhoneVerificationSms(challenge.code) },
      { idempotencyKey: `phone-verification-${challenge.tokenHash.slice(0, 40)}` },
    );
  } catch (error) {
    console.error("Phone verification SMS delivery failed:", error);
    return NextResponse.json({ error: "We could not send a code to that number. Please try again shortly." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, challengeToken: challenge.token });
}
