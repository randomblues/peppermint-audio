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
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase public anon key
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase service role key

## Booking management

Run `supabase/001_booking_management.sql` in the Supabase SQL editor, then create administrator users under Supabase Authentication > Users. Bookings are submitted at `/booking` and managed at `/admin`; photo IDs remain in the private `booking-photo-ids` bucket and are only available through short-lived signed links.

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
