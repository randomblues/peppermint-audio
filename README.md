# Peppermint Audio Website

Marketing website for a Melbourne PA equipment hire business, built with:

- Next.js (App Router)
- Tailwind CSS
- shadcn/ui (CLI-initialized)
- React Hook Form + Zod
- Resend for enquiry emails

## Pages

- `/` Home
- `/packages`
- `/how-it-works`
- `/faq`
- `/contact` (enquiry form)

## Setup

1. Install dependencies.
2. Copy `.env.example` to `.env.local`.
3. Fill in your Resend API key and destination email.

## Environment Variables

- `RESEND_API_KEY`: API key from Resend
- `ENQUIRY_FROM_EMAIL`: verified sender (or Resend onboarding address during setup)
- `ENQUIRY_TO_EMAIL`: inbox for customer enquiries
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase publishable/anon key
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase service role key
- `CRON_SECRET`: server-only random secret used to authorize the pickup reminder cron route

## Booking management

Run `supabase/001_booking_management.sql` in the Supabase SQL editor, then create administrator users under Supabase Authentication > Users. Bookings are submitted at `/booking` with `submitted` status and managed at `/admin`; change a request to `confirmed` only after availability is reviewed. The customer automatically receives a confirmation email when the request is confirmed. Photo IDs remain in the private `booking-photo-ids` bucket and are only available through short-lived signed links.

The admin bookings view includes a **Send Email** menu with booking confirmation, pickup reminder, and custom email options. The confirmation option is available for confirmed bookings and can be used to resend the confirmation email.

## Pickup reminders

`/api/cron/pickup-reminders` runs once daily through Vercel Cron and emails customers with a pickup scheduled for the next day in Melbourne. Set `CRON_SECRET` to a long random value in Vercel project environment variables; Vercel sends it as a Bearer token. The route uses the server-only Supabase service role and Resend credentials. Apply the booking migration before enabling the cron.

## Run

```bash
npm run dev
```

## Verify

```bash
npm run lint
npm run build
```

## Notes

- Package/pricing content lives in `lib/site-content.ts`.
- Contact form validation schema is in `lib/validation/enquiry.ts`.
- API email sending endpoint is `app/api/enquiry/route.ts`.
