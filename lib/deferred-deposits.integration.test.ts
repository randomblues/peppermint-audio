// @vitest-environment node
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({
  Resend: class {
    constructor() { throw new Error("External email is blocked during deposit integration tests."); }
  },
}));

import { attemptDeferredDeposit, readDepositBooking, releaseCancelledDeferredDeposit } from "./deferred-deposits";
import { depositHoldDate } from "./payment-flow";
import { getMelbourneTomorrow } from "./pickup-reminders";

describe.skipIf(process.env.RUN_STRIPE_DEPOSIT_INTEGRATION !== "1")("local Stripe deferred-deposit integration", () => {
  it("charges hire once, saves the card, waits for the due day, authorises and releases the deposit", async () => {
    if (!/^sk_test_|^rk_test_/.test(process.env.STRIPE_SECRET_KEY ?? "")) {
      throw new Error("This integration check requires a Stripe test-mode secret key.");
    }
    const status = JSON.parse(execFileSync(path.resolve("node_modules/.bin/supabase"), [
      "status", "-o", "json", "--workdir", path.resolve(".local-supabase"),
    ], { encoding: "utf8", timeout: 30_000, stdio: ["ignore", "pipe", "pipe"] }));
    if (new URL(status.API_URL).hostname !== "127.0.0.1") throw new Error("Only local Supabase is permitted.");
    const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { timeout: 20_000, maxNetworkRetries: 1 });
    const bookingId = randomUUID();
    const customer = await stripe.customers.create({ metadata: { localDepositIntegration: bookingId } });
    let hire: Stripe.PaymentIntent | undefined;
    let depositId: string | null = null;
    try {
      const pickup = getMelbourneTomorrow();
      const dropoff = new Date(Date.parse(`${pickup}T00:00:00Z`) + 3 * 86_400_000).toISOString().slice(0, 10);
      const pendingHire = await stripe.paymentIntents.create({
        amount: 10000, currency: "aud", customer: customer.id,
        allowed_payment_method_types: ["card"], setup_future_usage: "off_session",
        metadata: { bookingId, paymentType: "hire", depositSchedule: "deferred" },
      });
      hire = pendingHire;
      const created = await admin.from("bookings").insert({
        id: bookingId, email: "deposit-integration@example.invalid",
        first_name: "Disposable", last_name: "Deposit Integration", mobile: "0400000000",
        event_type: "Local integration test", event_address: "Local only",
        pickup_date: pickup, dropoff_date: dropoff, dropoff_time: "10:00",
        payment_method: "stripe_card_hold", hire_amount_cents: 10000, security_deposit_cents: 10000,
        hire_payment_status: "pending", deposit_payment_status: "scheduled",
        deposit_hold_date: depositHoldDate(pickup), deposit_consent_at: new Date().toISOString(),
        stripe_customer_id: customer.id, stripe_hire_payment_intent_id: hire.id,
      });
      if (created.error) throw created.error;
      await attemptDeferredDeposit(admin, bookingId);
      expect((await readDepositBooking(admin, bookingId))?.stripe_deposit_payment_intent_id).toBeNull();

      hire = await stripe.paymentIntents.confirm(hire.id, { payment_method: "pm_card_visa" });
      expect(hire.status).toBe("succeeded");
      const paid = await admin.from("bookings").update({ hire_payment_status: "paid" }).eq("id", bookingId);
      if (paid.error) throw paid.error;

      const beforeSchedule = new Date(Date.parse(`${pickup}T00:00:00Z`) - 3 * 86_400_000);
      await attemptDeferredDeposit(admin, bookingId, beforeSchedule);
      expect((await readDepositBooking(admin, bookingId))?.stripe_deposit_payment_intent_id).toBeNull();

      expect(await attemptDeferredDeposit(admin, bookingId)).toBe("authorized");
      const secured = await readDepositBooking(admin, bookingId);
      depositId = secured?.stripe_deposit_payment_intent_id ?? null;
      expect(depositId).toBeTruthy();
      expect(secured?.deposit_capture_before).toBeTruthy();
      const intent = await stripe.paymentIntents.retrieve(depositId!);
      expect(intent.status).toBe("requires_capture");
      expect(intent.amount_received).toBe(0);
      await attemptDeferredDeposit(admin, bookingId);
      expect((await readDepositBooking(admin, bookingId))?.stripe_deposit_payment_intent_id).toBe(depositId);
      expect((await stripe.paymentIntents.retrieve(hire.id)).amount_received).toBe(10000);

      const cancelled = await admin.from("bookings").update({ status: "cancelled" }).eq("id", bookingId);
      if (cancelled.error) throw cancelled.error;
      await releaseCancelledDeferredDeposit(admin, bookingId);
      expect((await stripe.paymentIntents.retrieve(depositId!)).status).toBe("canceled");
      expect((await readDepositBooking(admin, bookingId))?.deposit_payment_status).toBe("released");
    } finally {
      const booking = await readDepositBooking(admin, bookingId);
      depositId ??= booking?.stripe_deposit_payment_intent_id ?? null;
      if (depositId) {
        const intent = await stripe.paymentIntents.retrieve(depositId);
        if (!["canceled", "succeeded"].includes(intent.status)) await stripe.paymentIntents.cancel(depositId);
      }
      if (hire) {
        const intent = await stripe.paymentIntents.retrieve(hire.id);
        if (intent.status === "succeeded") await stripe.refunds.create({ payment_intent: hire.id });
        else if (intent.status !== "canceled") await stripe.paymentIntents.cancel(hire.id);
      }
      const deleted = await admin.from("bookings").delete().eq("id", bookingId);
      if (deleted.error) throw deleted.error;
      await stripe.customers.del(customer.id);
    }
  }, 120_000);
});
