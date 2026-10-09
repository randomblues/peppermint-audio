# Peppermint Audio Website

Marketing website for a Melbourne PA equipment hire business, built with:

- Next.js (App Router)
- Tailwind CSS
- shadcn/ui (CLI-initialized)
- React Hook Form + Zod
- Resend for enquiry and booking emails
- Supabase for booking storage, authentication, and private photo-ID files
- Stripe for customer payment links and deposit authorisations

## Public routes

- `/` Home
- `/packages`
- `/equipment`
- `/how-it-works`
- `/faq`
- `/contact` (enquiry form)
- `/get-started`
- `/cart` (hire selection)
- `/booking` (booking request form)
- `/pay/[token]` (time-limited customer payment link)

Administrative routes are under `/admin`; they require a Supabase session and an explicit admin role or email in `ADMIN_EMAILS`.

Public browsing pages include a fixed **Check availability** contact prompt. On mobile it uses a dark two-line button with a stronger border, with footer clearance to keep the enquiry link accessible; at tablet/desktop widths it retains the original dark floating treatment. The calendar icon uses the same translucent mint background, mint outline, and staggered pulse animation at every width; the pulse respects reduced-motion preferences. It opens WhatsApp, phone, and email options, and stays hidden during booking, payment, and admin flows.

## Setup

1. Install dependencies.
2. Copy `.env.example` to `.env.local`.
3. Fill in a real Resend API key and destination email. Placeholder values do not send mail.
4. For local confirmation-email testing, use a verified sender domain in `ENQUIRY_FROM_EMAIL`. Resend's `onboarding@resend.dev` sender is restricted to the Resend account email until a domain is verified.

## Environment Variables

- `RESEND_API_KEY`: API key from Resend
- `ENQUIRY_FROM_EMAIL`: verified sender (or Resend onboarding address during setup)
- `ENQUIRY_TO_EMAIL`: inbox for customer enquiries
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase publishable/anon key
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase service role key
- `ADMIN_EMAILS`: comma-separated server-side allowlist for administrator email addresses
- `CRON_SECRET`: server-only random secret used to authorize the pickup reminder cron route
- `GOOGLE_CALENDAR_ENABLED`: optional calendar feature flag; local development is disabled by default, while production remains enabled unless this is set to `false`
- `STRIPE_SECRET_KEY`: server-only Stripe secret key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Stripe publishable key used by the customer payment page
- `STRIPE_WEBHOOK_SECRET`: server-only Stripe webhook signature secret
- `NEXT_PUBLIC_SITE_URL`: public site URL used to generate customer payment links

## Booking and payment management

Run `supabase/001_booking_management.sql` in the Supabase SQL editor, then create administrator users under Supabase Authentication > Users. Rerun the migration after schema changes so existing databases receive the pickup/drop-off time columns and email-history table. Customer hire selections are built in the cart and carried into the booking request form at `/booking`; requests are managed at `/admin` and changed to `confirmed` only after availability is reviewed. The customer automatically receives a confirmation email when the request is confirmed. Customer-facing email delivery metadata appears in each admin booking's **Email history** card and is automatically deleted after 30 days by the Supabase `pg_cron` job. Photo IDs remain in the private `booking-photo-ids` bucket and are only available through short-lived signed links.

The admin bookings view includes a **Send Email** menu with booking confirmation, pickup reminder, custom email, and invoice options. Stripe payment links expire after 30 days. Bank-transfer and cash-on-pickup invoices do not expose customer payment secrets.

## Hire pricing

Catalogue prices are first-night rates. Packages and individual equipment cost the full rate for the first night and 50% of that rate for each additional night (not a compounding discount). Nights are the calendar-date difference between pickup and return, with a one-night minimum for same-day hires; agreed pickup/return times do not change that count.

The cart collects the event start/end dates and shows the complete hire total as dates or quantities change. In the start-date calendar, customers select the start date and then the end date in the same calendar; completing the range automatically fills the end-date field. Selecting an earlier second date restarts the range, and selecting the start date again completes a same-day hire. The end-date calendar remains available for separate adjustments. These dates are stored with the hire selection and used as the pickup/drop-off dates in the booking request; the booking form only asks for the times, not the dates again. Customers can return to the cart to change their dates. Both dates are required before continuing, and same-day hire uses the one-night rate. The same calculation is used by booking persistence, admin item editing, Stripe, bank-transfer/cash requests, and invoice/receipt line items. Security deposits and admin-added custom line items remain separate flat charges. Per-unit hire totals are rounded to the nearest cent before multiplying by quantity.

The rule and public explanation live in `lib/site-content.ts`; shared calculations live in `lib/booking-line-items.ts`. No database schema change or legacy pricing mode is required.

## Pickup reminders

`/api/cron/pickup-reminders` runs once daily through Vercel Cron and emails customers with a pickup scheduled for the next day in Melbourne. Set `CRON_SECRET` to a long random value in Vercel project environment variables; Vercel sends it as a Bearer token. The route uses the server-only Supabase service role and Resend credentials. Apply the booking migration before enabling the cron.

## Run

```bash
npm run dev
```

## Browser testing

Use the local development server for browser checks of uncommitted changes:

```bash
npm run dev
```

The deployed preview at `https://peppermint-audio.vercel.app/` may be used for separate post-deployment checks. Do not use the production custom domain from this environment because Netskope can interfere with it.

## Verify

```bash
npm run lint
npm run build
npm test
npm run test:coverage
npm run test:e2e
```

## Notes

- Package/pricing content lives in `lib/site-content.ts`.
- Contact form validation schema is in `lib/validation/enquiry.ts`.
- API email sending endpoint is `app/api/enquiry/route.ts`.
- Project documentation lives in [`README/`](./README/), including the [Stripe integration guide](./README/STRIPE-INTEGRATION.md).
