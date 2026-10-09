# Stripe integration

This document describes the Stripe payment integration used by Peppermint Audio. It is intended for project maintenance, deployment, and admin operations.

## Business model

Peppermint Audio collects:

1. The equipment-hire amount, which is charged immediately once the customer completes payment.
2. A refundable security deposit, which is authorised on the customer's card but not captured immediately.

The customer experiences this as one payment page. Hire and deposit use separate Stripe PaymentIntents, but their timing depends on the pickup date:

| PaymentIntent | Amount | Capture behavior | Purpose |
| --- | --- | --- | --- |
| Hire | Hire total | Automatic capture | Pays for the equipment hire |
| Deposit | Security-deposit amount | Manual capture | Holds funds in case of loss or damage |

The deposit is not implemented as a captured charge followed by a refund. When the equipment is returned without a claim, the uncaptured PaymentIntent is cancelled. This releases the authorisation without creating an unnecessary captured-charge refund workflow. Stripe/card-network authorization behavior and fees can vary, so this implementation should not be described as a guarantee that no fee will ever apply.

## Rental-length rule

Stripe card authorisations are used only for hires of three nights or less.

- `1–3` hire nights: Stripe card payment plus deposit authorisation is available.
- Four or more hire nights: bank transfer or cash on pickup.

The rule is defined in [`lib/payment-flow.ts`](../lib/payment-flow.ts) as `MAX_STRIPE_HIRE_DAYS = 3`. Nights are the date difference between pickup and return, with a one-night minimum for same-day hire. It is enforced again by the server when an admin creates or updates a payment request; changing only the admin UI is not sufficient.

The three-night limit leaves time for return and check-in within the actual card-hold expiry. Bank transfer avoids depending on an authorisation remaining valid throughout a longer hire.

## Customer payment flow

### 1. Admin creates a payment request

An admin configures the booking in the admin payment panel:

- hire line items and hire amount;
- security-deposit amount;
- GST-inclusive setting;
- customer billing name and email.

For an eligible short hire, the server:

1. Validates the booking and amounts.
2. Creates or recovers the Stripe Customer.
3. Cancels any still-pending PaymentIntents from a previous payment request.
4. Creates the hire PaymentIntent with automatic capture.
5. For pickup today or tomorrow in Melbourne, creates the deposit PaymentIntent with `capture_method: "manual"` when the deposit is greater than zero. For later pickup, configures the hire intent to save the card for off-session use and schedules the deposit hold for the day before pickup instead of creating it immediately.
6. Stores the Stripe IDs and payment state in Supabase.
7. Generates a random payment token valid for at least 30 days and through return plus three days.
8. Sends the customer a secure payment link.

The implementation is in [`app/api/admin/payments/create-checkout/route.ts`](../app/api/admin/payments/create-checkout/route.ts).

Payment links are token-based and are not Stripe-hosted Checkout Sessions. The token resolves to Peppermint Audio's payment page at `/pay/[token]`; the browser then uses Stripe.js and the PaymentIntent client secrets.

### 2. Customer opens the payment page

The customer opens `/pay/[token]`. The server:

- verifies the token exists and has not expired;
- confirms the booking is configured for Stripe card-hold payment;
- retrieves both PaymentIntents from Stripe;
- verifies their `bookingId` metadata matches the booking;
- returns only the client secrets and customer-safe payment data needed by the browser.

The lookup route is [`app/api/payment/[token]/route.ts`](../app/api/payment/[token]/route.ts). Secret keys, server credentials, and private storage values must never be returned to the browser.

### 3. Customer submits one card form

[`components/payment-checkout.tsx`](../components/payment-checkout.tsx) renders one Stripe Elements card form. It records the applicable deposit consent before confirming:

- the hire PaymentIntent;
- the deposit PaymentIntent immediately for pickup today or tomorrow, if a deposit exists.

Immediate checkout creates a fresh Stripe PaymentMethod from the same card entry for each intent. A method consumed by a hire intent without future-use setup must not be reused for the deposit. If the deposit fails after the hire succeeds, retry only confirms the deposit; it does not charge hire again.

For advance bookings, checkout charges only hire and saves the card with consent. The due hold is attempted by the daily deposit cron or hire-payment webhook. A successful hire payment does not mean that a scheduled deposit is already authorised. The actual hold expiry must cover return plus the check-in margin.

The customer sees hire plus deposit due during immediate checkout, or hire only for advance checkout. A configured zero deposit creates no hold and does not show deposit instructions. Paid hire and authorised deposits are removed from the remaining total. Stripe Elements stays mounted while confirmation and verification run, then unmounts on success; checkout does not call `clear()` immediately before destroying the Element.

Successful checkout replaces the payment form with a distinct **Payment received** screen on the same payment-link URL. It shows the appropriate security-deposit outcome and a collapsed hire summary, without card entry or a payment button. The summary shows the hire payment received rather than a zero remaining-balance total. Reopening a completed payment link shows this screen directly. A failed or unverified immediate deposit keeps the retry form visible. Payment receipt is separate from booking confirmation and does not change the booking status.

## Deposit lifecycle

The deposit status is stored in `bookings.deposit_payment_status`.

### Release the deposit

For a clean return:

1. The admin selects **Release deposit**.
2. The server calls `stripe.paymentIntents.cancel(...)`.
3. The booking is updated to `deposit_payment_status = "released"`.
4. `deposit_released_at` is recorded.
5. A deposit-release billing document/email is generated.

This path is implemented in [`app/api/admin/payments/manage-deposit/route.ts`](../app/api/admin/payments/manage-deposit/route.ts).

### Capture all or part of the deposit

For an approved damage/loss claim:

1. The admin selects **Capture deposit**.
2. The server validates that the amount is greater than zero and no more than the authorised deposit.
3. Stripe captures the requested amount from the manual-capture PaymentIntent.
4. The booking stores `deposit_payment_status = "captured"`.
5. `deposit_captured_cents` and `deposit_captured_at` are recorded.
6. A deposit-capture billing document/email is generated.

Partial capture is supported. The capture is final: Stripe releases the remaining uncaptured amount, and the application records the captured amount. Capture is rejected after the recorded hold expiry.

## Bank-transfer flow for long hires

For a hire longer than three nights, the admin uses bank transfer or cash on pickup. Bank transfer is also available for short hires. The server rejects attempts to create a Stripe card authorisation for an ineligible rental.

The bank-transfer flow:

1. Admin selects PayID, bank account, or both.
2. The server creates an invoice without exposing Stripe payment secrets.
3. The customer pays outside Stripe.
4. Admin marks the hire payment as received.
5. Admin later marks the physical security deposit as refunded.

Bank-transfer deposit actions are deliberately separate from Stripe actions. The server will not mark a bank-transfer deposit refunded until the bank-transfer payment has first been marked received.

Relevant routes:

- [`app/api/admin/payments/bank-transfer/route.ts`](../app/api/admin/payments/bank-transfer/route.ts)
- [`app/api/admin/payments/manage-deposit/route.ts`](../app/api/admin/payments/manage-deposit/route.ts)
- [`app/api/admin/payments/send-invoice/route.ts`](../app/api/admin/payments/send-invoice/route.ts)

Cash-on-pickup remains a separate payment method for bookings where the admin chooses it. It does not use Stripe.

## Internal invoicing and receipt system

Stripe is the payment processor, not the application's document system. Peppermint Audio maintains its own invoicing, receipt, and billing-document workflow so the same branded records can be produced consistently for Stripe, bank-transfer, and cash-on-pickup bookings.

The internal billing system is responsible for:

- Generating branded invoice and receipt PDFs.
- Selecting the appropriate document variant:
  - Tax Invoice
  - Invoice
  - Payment receipt
  - Deposit authorisation
  - Deposit release
  - Deposit capture
- Assigning stable booking references and invoice numbers.
- Presenting GST-inclusive or non-GST totals according to the booking configuration.
- Recording invoice status and payment timestamps.
- Sending billing documents through the configured email provider.
- Keeping billing-document history associated with the booking.

Stripe identifiers and statuses are stored alongside, but are not a replacement for, the application's invoice and billing records. A successful Stripe event can update the booking and invoice state, but document generation and delivery remain application responsibilities.

The main implementation surfaces are:

- [`lib/invoice-pdf.ts`](../lib/invoice-pdf.ts) — branded PDF generation and document variants.
- [`lib/invoice-service.ts`](../lib/invoice-service.ts) — invoice creation, billing-document state, payment status, and delivery orchestration.
- [`supabase/001_booking_management.sql`](../supabase/001_booking_management.sql) — `invoices`, `billing_documents`, and booking payment fields.
- [`lib/email-log.ts`](../lib/email-log.ts) — records outbound billing and customer email history.

### Document lifecycle

1. The admin configures the booking amount, deposit, GST setting, and payment method.
2. The application creates or updates the internal invoice record.
3. The customer receives an invoice or secure payment request.
4. Stripe webhooks or admin bank-transfer actions update the payment state.
5. The application generates the relevant receipt or deposit document.
6. The document is emailed and recorded against the booking.

The internal records are important even when Stripe is involved: Stripe confirms payment activity, while Peppermint Audio's system provides the customer-facing accounting documents and the operational history used by the admin console.

## Webhooks

Stripe sends events to:

```text
POST /api/stripe/webhook
```

The handler verifies the `stripe-signature` header with `STRIPE_WEBHOOK_SECRET` before processing events. It uses PaymentIntent metadata to associate events with a booking:

- `bookingId`
- `invoiceNumber`
- `paymentType` (`hire` or `deposit`)

Handled event categories include:

| Event | Booking effect |
| --- | --- |
| `checkout.session.completed` / `checkout.session.async_payment_succeeded` | Records hire payment or deposit authorisation when applicable |
| `payment_intent.amount_capturable_updated` | Marks a deposit as authorised and sends the authorisation document |
| `payment_intent.succeeded` | Marks hire payment or deposit capture as complete |
| `payment_intent.canceled` | Marks the deposit as released |
| `payment_intent.payment_failed` | Marks the relevant payment as failed |

The handler is [`app/api/stripe/webhook/route.ts`](../app/api/stripe/webhook/route.ts). Stripe webhook delivery should be configured in the Stripe Dashboard for the deployed application URL. Do not put a webhook signing secret in source control.

## Environment variables

The following values are required for Stripe operation:

```text
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_SITE_URL
```

Where they are used:

- `STRIPE_SECRET_KEY`: server-only Stripe SDK operations.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: loads Stripe.js in the customer payment page; it is publishable, but must still be configured through the environment.
- `STRIPE_WEBHOOK_SECRET`: verifies incoming webhook signatures.
- `NEXT_PUBLIC_SITE_URL`: builds customer payment links and branded URLs. The request origin is used as a fallback.

Never expose `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` to client components, browser responses, logs, screenshots, tests with real values, or documentation.

## Database fields

The canonical schema is [`supabase/001_booking_management.sql`](../supabase/001_booking_management.sql).

Important booking fields:

- `payment_method`
- `hire_amount_cents`
- `security_deposit_cents`
- `hire_payment_status`
- `deposit_payment_status`
- `stripe_customer_id`
- `stripe_hire_payment_intent_id`
- `stripe_deposit_payment_intent_id`
- `payment_token`
- `payment_token_expires_at`
- `deposit_captured_cents`
- `deposit_captured_at`
- `deposit_released_at`
- `payment_received_at`
- `bank_transfer_refunded_at`

Amounts are stored as integer cents. The application formats them as Australian dollars for customer and admin-facing output.

## Admin API surface

All admin payment routes require an authenticated admin session:

- `POST /api/admin/payments/create-checkout` — create or replace a Stripe payment request.
- `POST /api/admin/payments/bank-transfer` — create a bank-transfer invoice.
- `POST /api/admin/payments/update-booking` — save payment method, amounts, and booking payment configuration.
- `POST /api/admin/payments/manage-deposit` — release/capture a Stripe deposit or record bank-transfer receipt/refund.
- `POST /api/admin/payments/send-invoice` — send or resend the relevant invoice.

The admin UI is implemented in [`components/admin-payment-panel.tsx`](../components/admin-payment-panel.tsx).

## Operational rules

- Review availability before requesting payment.
- Confirm the hire line items and amount before creating a payment request.
- Do not create Stripe payment requests for hires longer than three nights.
- Do not manually refund a deposit that is still an uncaptured Stripe authorisation; release it by cancelling the PaymentIntent.
- Capture only the amount justified by the approved claim, and never above the authorised amount.
- Respect the stored payment-link expiry (at least 30 days and through return plus three days), and issue a new link when it expires.
- Do not silently replace a bank-transfer invoice when its amounts differ; resolve the booking configuration explicitly.
- If Stripe succeeds but database persistence or billing-email delivery fails, inspect the admin record and Stripe Dashboard before retrying.
- Apply the Supabase migration before using newly added payment, invoice, or billing-document fields in production.

## Testing

Stripe behavior is covered by focused tests including:

- [`lib/payment-flow.test.ts`](../lib/payment-flow.test.ts)
- [`components/payment-checkout.test.tsx`](../components/payment-checkout.test.tsx)
- [`components/admin-payment-panel.test.tsx`](../components/admin-payment-panel.test.tsx)
- [`app/api/admin/payments/route.test.ts`](../app/api/admin/payments/route.test.ts)
- [`app/api/stripe/webhook/route.test.ts`](../app/api/stripe/webhook/route.test.ts)
- [`app/api/payment/[token]/route.test.ts`](../app/api/payment/%5Btoken%5D/route.test.ts)

Use Stripe test-mode keys and test cards for local validation. Never use real customer payment details in tests or committed fixtures.

Recommended verification commands:

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```

## Troubleshooting

### “Payments are not configured yet”

Check that `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is available to the Next.js client build and that the application has been restarted after environment changes.

### “Stripe is not configured”

The server cannot find `STRIPE_SECRET_KEY`. Check the server environment only; do not place the key in a client component.

### A webhook returns 400

Check that Stripe is sending the raw request body, the `stripe-signature` header is present, and `STRIPE_WEBHOOK_SECRET` matches the endpoint. Do not parse and re-serialize the body before signature verification.

### A payment link is expired

Payment tokens remain valid for at least 30 days and through return plus three days. If the stored expiry has passed, have an admin create a new payment request rather than extending a token manually.

### A deposit should be returned

Check the booking's payment method and deposit status. Stripe deposits in `authorized` state should be released by cancelling the PaymentIntent. Bank-transfer deposits require the bank-transfer receipt/refund actions instead.
