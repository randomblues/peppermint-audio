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

The homepage leads with "Good sound. Less stress.", a real stage photograph shown only at desktop widths (1024px and above), and direct paths to packages and individual gear. Mobile and portrait-tablet layouts keep the introduction focused on text and hire options without reserving space for the photo. Its introductory strip highlights hire options, Abbotsford pickup, and the included setup walkthrough. It keeps the existing package/cart interactions and customer reviews, with a three-step hire overview from `homeHireSteps` in `lib/site-content.ts`. Booking requests still require availability review before confirmation.

The locally served homepage photo, `public/home-live-sound.jpg`, is [A Stage with Microphones and a Bar Stool by Caio](https://www.pexels.com/photo/a-stage-with-microphones-and-a-bar-stool-13061474/), used under the [Pexels License](https://www.pexels.com/license/). It is stock photography, not a photograph of Peppermint Audio's own inventory or an event serviced by the business.

The FAQ leads with five conversational questions about choosing a package, booking ahead, self-setup, specific requirements, and individual equipment hire. Multi-night pricing, pickup/delivery, and booking steps sit in a collapsed "A few practical bits" section. All answers and their contextual links live in `lib/site-content.ts`; FAQ structured data uses the same answers.

Administrative routes are under `/admin`; they require a Supabase session and an explicit admin role or email in `ADMIN_EMAILS`.

Public browsing pages include a fixed **Check availability** contact prompt. On mobile it uses a dark two-line button with a stronger border, with footer clearance to keep the enquiry link accessible; at tablet/desktop widths it retains the original dark floating treatment. The calendar icon uses the same translucent mint background, mint outline, and staggered pulse animation at every width; the pulse respects reduced-motion preferences. It opens WhatsApp, phone, and email options, and stays hidden during booking, payment, and admin flows.

## Setup

### Local-only database, authentication and storage

Local development uses Supabase **on your own machine**, not the hosted project.
Install Docker (with its CLI available on PATH), then run:

```bash
npm install
npm run db:local:start
npm run db:local:seed
npm run dev
```

For normal startup, just run `npm run dev` (or `npm start` for an existing build).
Both launchers, including `npm run dev:resend`, reuse any responding configured
Docker engine. If no engine responds on macOS, they launch an already installed
Docker Desktop from `/Applications` or `~/Applications`. Engine readiness is
bounded to 120 seconds: one initial probe and at most 24 retries, with up to five
seconds between attempts and a five-second timeout per probe. On other platforms,
or without Docker Desktop, start your configured engine manually and retry.
The launchers never install software, switch Docker contexts, stop running
containers, or reset/delete local data. They start this checkout's absent/stopped
Supabase stack once (bounded to ten minutes), streaming Supabase progress with
credentials redacted and printing a heartbeat when it is quiet. If a container
stays in Docker's `Created` state for 45 seconds, startup stops early with a
Docker diagnosis: the engine is answering but not starting containers, so
restart Docker Desktop (or update it if the fault persists) and check that
`docker run --rm hello-world` completes. If an earlier start was interrupted
and left this checkout's database container in `Created`, the launcher first
clears only this checkout's never-started containers (`supabase stop`; data
volumes are kept). It then waits up to 90 seconds for the database health check
(Docker restarts an existing stack on its own when the engine launches), validates
the local status and applies the canonical
migration transaction before starting Next.js. Unexpected status errors are
reported rather than triggering a blind restart.

`db:local:start` starts PostgreSQL, Auth, private Storage, Studio and a local Auth
email inbox. It applies the canonical `supabase/001_booking_management.sql` inside
a transaction. Run it again after schema changes; it does not reset existing
local data. First startup downloads Docker images and can take several minutes.

`db:local:seed` creates three disposable bookings and a local administrator with
the admin role. Its generated login is stored in the ignored, owner-readable
`.local-supabase/admin-login.json`; use that account at `/admin/login`. Repeated
seeding preserves existing fixture bookings and never copies production data.

Future agent sessions are instructed in `AGENTS.md` to sign in themselves using
the local test admin, not ask you to fill the form or use the real account.
`POST /api/dev/admin-login` reads the ignored credentials on the server and signs
in through local Supabase, setting the normal HTTP-only session cookies. Agents
call it from the same-origin localhost browser tab, then navigate to `/admin`.
Terminal-run Playwright checks use the same browser context's request API with
an `Origin` header matching the localhost app URL.

This helper is disabled outside development, on Vercel, and for non-loopback or
cross-origin requests; production-built local servers use normal login or
direct test-account authentication instead. Credentials and session cookies must
never be printed or committed. The normal login form remains unchanged.

`npm run dev` and `npm start` inject this worktree's local credentials into Next.js without
editing `.env.local`. Both server database clients and admin session refresh use
the same target. Development rejects hosted connections and never falls back to
production when Docker is stopped. `npm start` serves an existing `npm run build`
against the same local stack. A direct `next dev` invocation also requires
`LOCAL_SUPABASE_URL`, `LOCAL_SUPABASE_ANON_KEY` and
`LOCAL_SUPABASE_SERVICE_ROLE_KEY`; prefer `npm run dev`.

Each checkout/worktree has a distinct Docker project, persistent data volumes and
deterministic port range. Run these commands separately inside each agent's
worktree. Port conflicts fail explicitly rather than selecting another database.
Moving a checkout changes its project identity; stop its stack before moving it.

```bash
npm run db:local:status   # Prints local URLs, not keys
npm run db:local:verify   # Real local Auth/database/private-storage integration check
npm run db:local:stop     # Stops only this worktree's stack; retains data
```

Studio can create/edit/delete disposable records and manage local files.
No reset/delete command is provided automatically. Production still uses the
existing `SUPABASE_*` deployment variables on Vercel. Outside Vercel, database
clients default to local even in production-mode server runs (unit tests retain
their mocked hosted configuration). A non-Vercel production deployment must
explicitly set `SUPABASE_TARGET=hosted` and use its normal Next.js hosting entry
point rather than the local npm launcher. Local mode is rejected on Vercel.

### Safe local email

Both `npm run dev` and `npm start` default application emails to **capture**
when `SUPABASE_TARGET=local`, regardless of `NODE_ENV`. Enquiries, booking
acknowledgements, confirmations, reminders, custom emails, billing PDFs and
deposit notifications go to this worktree's Supabase Mailpit inbox, alongside
Auth emails. No Resend credentials are needed. Missing sender/internal recipient
settings default to `hello@peppermint.local` / `team@peppermint.local`.

Run `npm run db:local:status` and open the printed **Local Auth mail** URL
(this checkout: `http://127.0.0.1:30074`). Inspect recipients, message bodies and
PDF attachments there. Capture uses the loopback-only Mailpit HTTP API; inbox
errors fail delivery, never fall back to an external provider.
Both `npm run dev` and `npm run start` print the email mode at startup. Capture
mode also prints this worktree's inbox URL; Resend mode warns about quota usage.

For deliberately controlled Resend testing, set `LOCAL_EMAIL_MODE=resend`,
`LOCAL_EMAIL_TEST_RECIPIENT` to one plain email address, and configure
`RESEND_API_KEY` and a verified `ENQUIRY_FROM_EMAIL` through your secure local
environment. Restart the local app after changing configuration.
Alternatively, stop the running app and use the hands-free shortcut below:

```bash
npm run dev:resend
```

The shortcut defaults all recipients to `shanedsouza6823@gmail.com`. An optional
override is `npm run dev:resend -- you@example.com`; empty, invalid or multiple
addresses are rejected. It enables Resend only for that run and uses your
Resend quota. Stop it and run `npm run dev` to return to
capture (unless you separately configured Resend mode in your environment).

**Every application email is redirected to that one inbox**: original `to`
recipients are replaced; `cc`, `bcc`, `replyTo` and custom headers are removed.
PDF attachments are preserved. Missing/invalid recipients, missing provider
credentials or unknown modes reject delivery without an external send.
Never enter credentials in command arguments or commit them.

Return to `LOCAL_EMAIL_MODE=capture` (or unset it) and restart to restore the
pretend inbox. The launcher injects `LOCAL_EMAIL_INBOX_URL` for its own stack.
For direct local launches it defaults to `http://127.0.0.1:30074`; overrides must
be loopback HTTP URLs. Hosted production keeps its existing Resend behavior;
local email settings do not redirect hosted deployments.

**Other external services remain separate:** local Supabase does not sandbox
Stripe or Google Calendar. Do not use real customer information or live payment
keys in local tests. Use Stripe test-mode keys and keep calendar disabled.

1. Install dependencies.
2. Copy `.env.example` to `.env.local`.
3. Local email capture needs no Resend key; follow **Safe local email** above.
4. For production or controlled Resend mode, configure a verified sender. Resend's `onboarding@resend.dev` sender is restricted to the Resend account email until a domain is verified.

## Environment Variables

- `RESEND_API_KEY`: API key from Resend
- `ENQUIRY_FROM_EMAIL`: verified sender (or Resend onboarding address during setup)
- `ENQUIRY_TO_EMAIL`: inbox for customer enquiries
- `LOCAL_EMAIL_MODE`: local-only `capture` (default) or explicit `resend`
- `LOCAL_EMAIL_TEST_RECIPIENT`: single designated recipient required for local Resend mode
- `LOCAL_EMAIL_INBOX_URL`: loopback HTTP Mailpit URL (injected by the local launcher)
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase publishable/anon key
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase service role key
- `ADMIN_EMAILS`: comma-separated server-side allowlist for administrator email addresses
- `CRON_SECRET`: server-only random secret used to authorize the pickup reminder cron route
- `GOOGLE_CALENDAR_ENABLED`: optional calendar feature flag; local development is disabled by default, while production remains enabled unless this is set to `false`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALENDAR_REDIRECT_URI`: Google Calendar OAuth client (secret is server-only)
- `GOOGLE_CALENDAR_REFRESH_TOKEN`: server-only refresh token; keep it a clean single-line value (no CR/LF)
- `GOOGLE_CALENDAR_ID`: optional calendar ID; defaults to `primary`
- `STRIPE_SECRET_KEY`: server-only Stripe secret key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Stripe publishable key used by the customer payment page
- `STRIPE_WEBHOOK_SECRET`: server-only Stripe webhook signature secret
- `BANK_TRANSFER_ACCOUNT_NAME`, `BANK_TRANSFER_BSB`, `BANK_TRANSFER_ACCOUNT_NUMBER`, `BANK_TRANSFER_PAYID`: bank-transfer payment details shown on invoices
- `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID` and `NEXT_PUBLIC_GOOGLE_ADS_*_CONVERSION_LABEL` (`CONVERSION_LABEL`, `BOOKING_`, `PHONE_`, `WHATSAPP_`): optional Google Ads conversion tracking
- `NEXT_PUBLIC_SITE_URL`: public site URL used to generate customer payment links
- `SUPABASE_TARGET`: `hosted` for a non-Vercel production deployment (see local database notes above)

## Booking and payment management

Run `supabase/001_booking_management.sql` in the Supabase SQL editor, then create administrator users under Supabase Authentication > Users. Rerun the migration after schema changes so existing databases receive the pickup/drop-off time columns and email-history table. Customer hire selections are built in the cart and carried into the booking request form at `/booking`; requests are managed at `/admin` and changed to `confirmed` only after availability is reviewed. The customer automatically receives a confirmation email when the request is confirmed. Customer-facing email delivery metadata appears in each admin booking's **Email history** card and is automatically deleted after 30 days by the Supabase `pg_cron` job. Photo IDs remain in the private `booking-photo-ids` bucket and are only available through short-lived signed links.

The admin bookings view includes a **Send Email** menu with booking confirmation, pickup reminder, custom email, and invoice options. New Stripe payment links remain valid for at least 30 days and through return plus three days. Bank-transfer and cash-on-pickup invoices do not expose customer payment secrets.

## Hire pricing

Catalogue prices are first-night rates. Packages and individual equipment cost the full rate for the first night and 50% of that rate for each additional night (not a compounding discount). Nights are the calendar-date difference between pickup and return, with a one-night minimum for same-day hires; agreed pickup/return times do not change that count.

For multi-night hires, the cart and booking form highlight the amount saved against the standard nightly total, cross out that standard total, and show the first-night and discounted extra-night subtotals. One-night and same-day hires do not show a saving.

The cart collects the event start/end dates and shows the complete hire total as dates or quantities change. In the start-date calendar, customers select the start date and then the end date in the same calendar; completing the range automatically fills the end-date field. Selecting an earlier second date restarts the range, and selecting the start date again completes a same-day hire. The end-date calendar remains available for separate adjustments. These dates are stored with the hire selection and used as the pickup/drop-off dates in the booking request; the booking form only asks for the times, not the dates again. Customers can return to the cart to change their dates. Both dates are required before continuing, and same-day hire uses the one-night rate. The same calculation is used by booking persistence, admin item editing, Stripe, bank-transfer/cash requests, and invoice/receipt line items. Security deposits and admin-added custom line items remain separate flat charges. Per-unit hire totals are rounded to the nearest cent before multiplying by quantity.

The rule and public explanation live in `lib/site-content.ts`; shared calculations live in `lib/booking-line-items.ts`. No database schema change or legacy pricing mode is required.

## Deferred security-deposit holds

For Stripe hires of up to **three nights**, the customer pays the hire now.
For pickup today or tomorrow in Melbourne, checkout also places the temporary
deposit hold, using a separate payment method for each PaymentIntent so a
single-use card method is not reused. For later pickup, the customer explicitly
consents to saving their card with Stripe; the deposit hold is attempted on the
calendar day before pickup. The hire-payment webhook also resumes due holds.
Four-night and longer hires use bank transfer or cash on pickup.
An explicitly configured zero deposit creates no hold and shows no deposit-hold
instructions. A failed deposit can be retried without charging the paid hire again.

`/api/cron/deposit-holds` runs daily at 20:00 UTC (06:00/07:00 Melbourne), protected
by `CRON_SECRET`. It resumes saved intents rather than creating duplicate holds,
checks the actual card `capture_before` against return plus check-in time, and
sends customer/admin attention emails on decline, required authentication, or an
insufficient/expired hold. An insufficient hold is cancelled; arrange an
alternative deposit before handing over equipment. A paid hire or a confirmed
booking must not be treated as proof that the deposit is secured.

**Before deployment:** apply `supabase/001_booking_management.sql` to add the
deposit schedule, consent, expiry, error, and notification fields. Configure
Stripe webhook delivery for PaymentIntent success, failure, cancellation,
authentication, and capturable-amount updates, and ensure `CRON_SECRET`,
`RESEND_API_KEY`, `ENQUIRY_FROM_EMAIL`, and `ENQUIRY_TO_EMAIL` are configured.
Payment links stay valid for at least 30 days and through return plus three days.
Existing immediate-hold payment requests remain legacy requests; review them
manually for expiry rather than silently rescheduling already-authorised holds.

To verify the real delayed-hold service against local Supabase and Stripe test
mode, run `npm run test:deposit:integration` (Node 20.6+). It requires a running
local stack and test-mode Stripe credentials in `.env.local`; it rejects live
keys and blocks application email delivery. It charges a disposable test hire,
checks that unpaid/not-yet-due bookings cannot create a hold, saves the card,
authorises the due deposit, and verifies retries do not duplicate it. Separate
cases exercise release on cancellation, partial capture, and full capture.
Cleanup refunds test hire and captured-deposit charges, releases active holds,
and removes each local booking and Stripe customer. Normal unit runs skip this
external check.

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
