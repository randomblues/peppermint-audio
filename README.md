# Peppermint Audio Website

Marketing website for a Melbourne PA equipment hire business, built with:

- Next.js (App Router)
- Tailwind CSS
- shadcn/ui (CLI-initialized)
- React Hook Form + Zod
- Resend for enquiry and booking emails
- Supabase for booking storage, authentication, and private photo-ID files
- Stripe for customer payment links and deposit authorisations

For parallel agent work, see the [isolated worktree and browser workflow](./README/AGENT-WORKTREES.md).

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

The homepage leads with "Good sound. Less stress." and a real stage photograph shown only at desktop widths (1024px and above). Mobile and portrait-tablet layouts keep the introduction focused on text and hire options without reserving space for the photo. The hero flows directly into the packages section without an introductory information strip. It keeps the existing package/cart interactions and customer reviews, with a three-step hire overview from `homeHireSteps` in `lib/site-content.ts`. Booking requests still require availability review before confirmation.

The hero uses a quiet, separated event-type list and a Melbourne hire description, followed by View packages and the tracked phone-call button. The hero phone button uses flat styling without changing the shared phone button's default appearance elsewhere. The former individual/custom-hire promotional panels and their replacement compact panel have been removed; the catalogue remains available through site navigation.

The locally served homepage photo, `public/home-live-sound.jpg`, is [A Stage with Microphones and a Bar Stool by Caio](https://www.pexels.com/photo/a-stage-with-microphones-and-a-bar-stool-13061474/), used under the [Pexels License](https://www.pexels.com/license/). It is stock photography, not a photograph of Peppermint Audio's own inventory or an event serviced by the business.

The FAQ leads with five conversational questions about choosing a package, booking ahead, self-setup, specific requirements, and individual equipment hire. Multi-night pricing, pickup/delivery, and booking steps sit in a collapsed "A few practical bits" section. All answers and their contextual links live in `lib/site-content.ts`; FAQ structured data uses the same answers.

The individual equipment catalogue supports instant search across product names, categories, descriptions, features, and hire options, a category dropdown, and sorting by starting nightly price or name. Filters use the `q`, `category`, and `sort` URL parameters so filtered views can be shared and restored with browser navigation. The same compact category dropdown is used on desktop and mobile; prices and cart selections remain unchanged. Popular badges come from the catalogue data, appear on cards and detail pages, and can be found with a "popular" search without changing the catalogue order.

Administrative routes are under `/admin`; they require a Supabase session and an explicit admin role or email in `ADMIN_EMAILS`.

Public browsing pages include a fixed **Check availability** contact prompt. On mobile it uses a dark two-line button with a stronger border, with footer clearance to keep the enquiry link accessible; at tablet/desktop widths it retains the original dark floating treatment. The calendar icon uses the same translucent mint background, mint outline, and staggered pulse animation at every width; the pulse respects reduced-motion preferences. It opens WhatsApp, phone, and email options, and stays hidden during booking, payment, and admin flows.

## Setup

### Local development environment

Local development uses Supabase **on your own machine**, not the hosted project.
Install Docker (with its CLI available on PATH), then run:

```bash
npm install
scripts/dev-detached.sh
```

The detached launcher returns immediately and writes startup output to
`/tmp/dev-3000.log` by default. Set `PORT` to choose another port. Check whether
that port is already in use before starting; inspect the matching log file to
check startup and run `scripts/dev-stop.sh <port>` to stop the server. The
underlying `npm run dev` launcher automatically starts or reuses the local
services, applies the canonical database migration, and starts Next.js.
For an existing build, use the appropriate production-serving workflow.

For local Stripe webhook testing, install and authenticate the Stripe CLI once
with `stripe login`, then run `scripts/dev-stripe-detached.sh`. It starts the
app and Stripe's test-mode listener together, forwards supported payment events
to the local webhook route, and supplies the listener's signing secret to the
app without writing it to a file. The combined output is in
`/tmp/dev-3000.log`; use `PORT` to select a different port. Leave Stripe
forwarding disabled by using `scripts/dev-detached.sh` when it is not needed.

With Stripe test-mode keys configured, enter `4242 4242 4242 4242`, a future
expiry and any three-digit CVC in the customer payment UI. This US test card
requires a five-digit ZIP such as `90210` when postal-code entry appears.
Chrome's HTTP-localhost warning disables saved-card autofill, not manual
test-card entry. Never use real card details for local testing.

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

The local stack starts without sample bookings or an administrator account.
Admin-console testing requires a separately provisioned disposable local admin;
never use production credentials or customer data for local testing.

For automated browser checks, `POST /api/dev/admin-login` signs in the disposable
`admin@peppermint.local` account from the owner-only ignored
`.local-supabase/admin-login.json` file. It requires development mode, local
Supabase, and a same-origin loopback request; it is unavailable on Vercel and in
production. It issues the normal HTTP-only auth cookies without returning login
credentials. The regular admin login form is unchanged.

`npm run dev` and `npm start` inject this worktree's local credentials into Next.js without
editing `.env.local`. Both server database clients and admin session refresh use
the same target. Development rejects hosted connections and never falls back to
production when Docker is stopped. `npm start` serves an existing `npm run build`
against the same local stack. A direct `next dev` invocation also requires
`LOCAL_SUPABASE_URL`, `LOCAL_SUPABASE_ANON_KEY` and
`LOCAL_SUPABASE_SERVICE_ROLE_KEY`; prefer `npm run dev`.

Each checkout/worktree has a distinct Docker project, persistent data volumes and
deterministic port range. Port conflicts fail explicitly rather than selecting
another database. The app launcher prints the local Auth mail inbox URL at startup.
Studio can manage local database records and files.
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

Open the printed **Local Auth mail** URL from the `npm run dev` output. Inspect recipients, message bodies and
PDF attachments there. Capture uses the loopback-only Mailpit HTTP API; inbox
errors fail delivery, never fall back to an external provider.
Both `npm run dev` and `npm run start` print the email mode at startup. Capture
mode also prints this worktree's inbox URL; Resend mode warns about quota usage.

For deliberately controlled Resend testing, set `LOCAL_EMAIL_MODE=resend`,
`LOCAL_EMAIL_TEST_RECIPIENT` to one plain email address, and configure
`RESEND_API_KEY` and a verified `ENQUIRY_FROM_EMAIL` through your secure local
environment. Stop the running server with `scripts/dev-stop.sh <port>`, then
restart it with `scripts/dev-detached.sh` so the selected mode is applied. This
uses Resend quota; stop it and restart with the default environment to return to
capture mode.

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

## SMS transport

The provider-neutral message contract is in `lib/sms-provider-types.ts`, and
`lib/sms-transport.ts` validates and delegates messages to an injected provider.
Mobile Message is the current adapter. The booking form verifies the entered
Australian mobile number before submission. Customer SMS is limited to booking
confirmation, pickup/drop-off reminders, and security-deposit alerts when a hold fails,
requires bank verification, expires, or cannot cover the hire. Deposit SMS uses
safe, specific bank reasons when recorded (for example insufficient funds or an
expired card), otherwise generic wording. It asks customers to check their
recovery email before pickup or reply for help, without card details or raw
provider diagnostics. Email and SMS delivery
are tracked separately, so a failed SMS can be retried without resending the
emails. Transactional SMS does not include opt-out wording. OTP and deposit
messages stay within one part. Confirmation SMS is capped at two parts and includes
a private calendar link; detailed pickup SMS is capped at three
parts (up to three credits), including the requested pickup slot, address,
transport reminder and instructions to message or call upon arrival or if
running late or changing the scheduled pickup time. It says "today" or "tomorrow" using Melbourne time,
or gives the date without the weekday for other days to keep within the segment
limit. The private-residence note follows the pickup
email. SMS uses AM/PM pickup times and does not request 30-minute advance notice;
the email is unchanged.
The photo-ID reminder remains in email only, not SMS.

Confirmed-booking SMS links to `/calendar/<token>` on this website. The token is
128 random bits encoded as 22 URL-safe characters (66 characters for the full
production URL), persisted server-side so retries reuse the same link. The page
offers separate pickup and drop-off events for Google Calendar and Apple/Outlook
(`.ics`). Downloads and dates use Melbourne time, including daylight saving.
Bookings without an agreed time are explicitly labelled and saved as all-day
reminders, not invented appointment times. These are saved copies, not calendar
subscriptions; customers must update saved events if hire times change.
Links expose only the booking reference, dates, times and business address,
are not indexed or cached, and stop working for cancelled/completed bookings
or more than 30 days after return. Apply the migration's `calendar_token` column
and unique index before deployment. Google Ads scripts do not load on the private
calendar page, and external calendar links use a no-referrer policy.

The business Google Calendar integration remains separate from customer calendar
links. Request submission does not create an event. Confirmation saves the
full-hire event (pickup through drop-off) for both admin and automatic Stripe confirmations.
Existing tracked events are not duplicated. New events use a deterministic booking
ID so an accepted event can be recovered after a tracking failure. Calendar errors
are recorded and surfaced to the admin/webhook without preventing customer
notifications. Enabled integration without a refresh token fails explicitly;
reconnect Google if its authorisation has expired. Local calendar delivery remains
disabled by default.
Incoming replies are handled in the Mobile Message account; they are not yet
shown in the admin dashboard.
Outgoing booking SMS is recorded in the admin Communications trail alongside
emails, including the submitted text, recipient, time, provider message ID,
and acceptance or send failure. Provider acceptance does not prove handset
delivery. Retries reuse one record per logical message; a failed retry cannot
overwrite an accepted record. OTP codes are not recorded in this trail.
SMS history is retained for 30 days and deleted with its booking. This requires
the `booking_sms_log` table, access policy, and cleanup job in the canonical
Supabase migration before deployment. Existing messages are not backfilled.

Local SMS is disabled by default. Deliberate local sends require
`IS_LOCAL_SMS_ENABLED=true` and a single `LOCAL_SMS_TEST_RECIPIENT`; every
local send is redirected to that number. Local OTP tests exercise the flow but
do not prove ownership of the number entered in the form. The verification code
expires after five minutes; a successfully verified
number can be used to submit its booking for 30 minutes. Challenges and codes
are stored only as keyed hashes and rate-limited per number, source IP, and globally. The canonical Supabase
migration must be applied before deploying phone verification or SMS tracking.
The deposit alerts also require the `deposit_attention_sms_sent_at` booking
column from that migration before deployment.
The reminder schedulers also require the `pickup_sms_claimed_at`,
`dropoff_sms_sent_at`, and `dropoff_sms_claimed_at` booking columns and the
updated `booking_sms_log` message-type constraint.
Configure SMS credentials as server-only Vercel environment variables; never
enter them in command arguments or commit them. No live SMS is sent by unit
tests.

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
- `SMS_PROVIDER`: production SMS provider (`mobilemessage`)
- `MOBILEMESSAGE_API_USERNAME`, `MOBILEMESSAGE_API_PASSWORD`: server-only Mobile Message API credentials
- `MOBILEMESSAGE_SENDER_ID`: approved Mobile Message sender ID, such as the dedicated number configured in the provider account
- `SMS_OTP_HASH_SECRET`: server-only random secret used to hash phone-verification tokens and codes
- `IS_LOCAL_SMS_ENABLED`: local-only SMS safety switch; only `true` enables live Mobile Message sends (unset or `false` keeps SMS disabled). Replaces `LOCAL_SMS_MODE`.
- `LOCAL_SMS_TEST_RECIPIENT`: single Australian mobile number required for local SMS mode; all local messages are redirected here
- `LOCAL_STRIPE_WEBHOOKS`: set to `true` to start Stripe CLI test-mode webhook forwarding during local development
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

The four booking-form steps are **Your details**, **Event details**, **Photo ID**,
and **Review your hire and terms**. Customers provide both ID sides before the
final review, where selected items, additional details, and hire-term acceptance
are shown together.

The booking form accepts the front and back of a photo ID together or in separate
file-picker selections or drops. New selections add to the existing files, up to
two total; customers must remove a selected file before replacing it. Selections
that exceed the limit show an error without changing the existing files.

Booking photo-ID images may be up to 10 MB each. The browser converts HEIC/HEIF
using the CSP-compatible `heic-to` decoder and resizes larger images to JPEG with a longest edge of 2400px
and an encoded size of at most 1.5 MB per file. Processing stays in the browser;
no third-party upload service receives the ID. PDFs are not compressed and remain
limited to 1.5 MB each. The API retains the 1.5 MB per-file cap so two IDs and the
booking fields fit within Vercel's request-body limit. If conversion or compression
fails, the form explains how to retry rather than submitting an oversized file.
On phones, **Scan photo ID** opens a full-screen camera guide with a card
outline, live framing guidance for distance, and advisory lighting, glare, and
focus checks. Customers can review and retake each side, then decide whether to
use the photo; the scanner does not use OCR to decide whether an image is an ID.
Customers should review the details before continuing, and admins can review
the submitted files through the booking workflow. This is not an identity or
authenticity check. Captured images remain in the browser until the booking
request is submitted; the existing file upload remains available as a fallback.
The browser regression test uses `tests/fixtures/synthetic-photo.heic`, an
800x500 generated colour gradient encoded with macOS `sips`; it contains no ID
or customer data and exercises the real decoder rather than a mocked conversion.

Run `supabase/001_booking_management.sql` in the Supabase SQL editor, then create administrator users under Supabase Authentication > Users. Rerun the migration after schema changes so existing databases receive the pickup/drop-off time columns and email-history table. Customer hire selections are built in the cart and carried into the booking request form at `/booking`; requests are managed at `/admin` and changed to `confirmed` only after availability is reviewed. The customer automatically receives a confirmation email when the request is confirmed. Customer-facing email delivery metadata appears in each booking's expandable **Communications** section; admins can review the email history, preview the original message, and view/download captured attachments there. History and attachment files are automatically deleted after 30 days by the daily Vercel Cron job. Photo IDs remain in the private `booking-photo-ids` bucket and are only available through short-lived signed links.

**Inventory** is an admin-only workspace for on-hand equipment counts, catalog/package component mappings, purchase records, and stock adjustments. On first setup, the migration seeds the owner-confirmed opening counts and equipment/package mappings; cables are not capacity-tracked, and the 10m extension reel is reserved only for separate hires. Later migration reruns do not overwrite stock counts. All saved catalog mappings are checked automatically before payment or confirmation; this is not configurable per listing. A payment request reserves mapped units through the hire and the reservation is released when the booking is cancelled or completed. Customer booking requests and public pages do not expose inventory or availability. Inventory purchase reports use the actual total and GST values entered from supplier receipts; they do not assess GST-credit eligibility, deductions, or depreciation. Apply `supabase/001_booking_management.sql` after these schema changes, review the seeded quantities and package mappings in **Admin → Inventory**, and record purchases from receipts before relying on tax reports.

**Bookings** provides the full filter panel: search, multi-select status checkboxes,
payment-state filtering, inclusive date ranges, Melbourne-based calendar/financial-year
presets, pickup or request-received date basis, sorting, and filtered booking CSV export.
Sorting lives at the top-right of the booking list, separate from the filters.
Choose **Submitted** or **Hire Dates** and click the adjacent arrow to reverse
ascending/descending order. Changing the field preserves the selected direction.
The default (and reset) is newest submissions first. Rows show **Hire Dates:** followed by
**Submitted On:** using the Melbourne submission date: "Today" or "Yesterday"
for those calendar days, otherwise the usual date (for example, "12 Oct 2026").
Missing submission dates
are shown as "Not recorded" and sorted last in either submission-date order.
Only **Submitted** and **Confirmed** statuses are selected by default.
Select **Completed** or **Cancelled** to include those bookings; there are no
separate hide controls. Reset filters restores the two default statuses, while
Select all includes all four. The booking list and CSV use the same filters.
**Analytics** is an independent historical business-performance dashboard, not
a booking-list view. Its default period is the last 12 calendar months to date;
30-day, 90-day, calendar-year, financial-year and custom historical periods are
available. Completed hire sales, hire volume and average priced hire compare with
the immediately preceding period of equal length. Completed hires are grouped by
booked return date (pickup date if return is missing), not request date.

The report includes repeat-customer hire share, zero-filled sales/hire/request
trends, package/equipment sales contribution, event mix, weekday pickup patterns,
median hire duration and booking notice. Request outcomes use a separate
received-date cohort in Melbourne time and reflect current booking states, not
a tracked historical conversion funnel. Repeat hires use earlier completed
bookings with matching contact emails in retained history. Product allocation
uses saved item prices and duration, reconciled to recorded hire totals.

Sales exclude refundable deposits, cancelled and non-completed hires, and
unpriced records; missing pricing is flagged and financial growth comparisons
are withheld when either period has incomplete pricing. Charges include GST where
applicable. Profit, advertising ROI and fleet utilisation are deliberately not
inferred from booking data. Use the Tax section for tax reporting.

The performance CSV contains only aggregate period results and breakdowns:
no customer names, email addresses, booking IDs or individual-record drill-down.
The separate Bookings CSV contains contact details and must be handled securely;
private photo IDs are not exported. An empty booking-status selection shows no
results in Bookings.

The admin payment panel offers **Standard** for hires of up to three nights, **Bank Transfer Only** for any hire length, and **Cash on Pickup**. Standard invoices include a Stripe card link and both PayID and bank-account details; customers choose one method. Bank-transfer-only invoices include both bank methods without a Stripe link, while cash invoices contain cash instructions only. Stripe payment links remain valid for at least 30 days and through return plus three days.

When a card payment request is active, use **Send invoice** to change hire items
and replace the payment link together. Saving changed items alone is rejected so
the displayed total cannot diverge from the charge. Received payments and processed
deposits cannot be reset through bank-transfer setup; resend the existing invoice.
Invalid deposit amounts are rejected rather than retaining an earlier amount.

Booking confirmation saves the confirmed status before sending the customer
email. A successful Stripe hire payment automatically confirms submitted bookings;
deposit-only events do not confirm bookings, and cancelled/completed bookings are
never reopened. Review availability before sending a Standard payment request.
For bank transfers, including transfers from a Standard invoice, choose
**Confirmed** in the booking status control and answer the payment-received
dialog. **Yes, confirm booking** records the transfer and deposit receipt,
closes the unused Stripe request when applicable, confirms the booking, and
sends the confirmation and payment receipt.
The separate **Confirm payment** checkbox is no longer needed. Cash-on-pickup
bookings can still be confirmed while payment is due.
If delivery fails, the booking remains confirmed and the admin can retry
using **Send confirmation email**. Automated pickup reminders exclude cancelled
and completed bookings. Manual reminders use the actual pickup date without
assuming tomorrow. Google Calendar runs only for confirmed bookings; errors are
recorded independently and do not prevent customer notification attempts.

Invoice PDFs paginate long item lists and payment details above the branded
footers. Billing delivery tracking errors are surfaced; provider idempotency
protects retries while allowing deliberate resends.

## Hire pricing

Catalogue prices are first-night rates. Packages and individual equipment cost the full rate for the first night and 50% of that rate for each additional night (not a compounding discount). Nights are the calendar-date difference between pickup and return, with a one-night minimum for same-day hires; agreed pickup/return times do not change that count.

For multi-night hires, the cart and booking form highlight the amount saved against the standard nightly total, cross out that standard total, and show the first-night and discounted extra-night subtotals. One-night and same-day hires do not show a saving.

The cart collects the event start/end dates and shows the complete hire total as dates or quantities change. In the start-date calendar, customers select the start date and then the end date in the same calendar; completing the range automatically fills the end-date field. Selecting an earlier second date restarts the range, and selecting the start date again completes a same-day hire. The end-date calendar remains available for separate adjustments. These dates are stored with the hire selection and used as the pickup/drop-off dates in the booking request; the booking form only asks for the times, not the dates again. Customers can return to the cart to change their dates. Both dates are required before continuing, and same-day hire uses the one-night rate. The same calculation is used by booking persistence, admin item editing, Stripe, bank-transfer/cash requests, and invoice/receipt line items. Security deposits and admin-added custom line items remain separate flat charges. Per-unit hire totals are rounded to the nearest cent before multiplying by quantity.

The rule and public explanation live in `lib/site-content.ts`; shared calculations live in `lib/booking-line-items.ts`. No database schema change or legacy pricing mode is required.

Persisted booking items retain their agreed names and prices, including retired
catalogue items. New selections are validated against current catalogue prices.
Malformed saved carts are reported and cleared so browsing remains usable; item
quantities are capped at the booking limit of 100.

## Deferred security-deposit holds

For Stripe hires of up to **three nights**, the customer pays the hire now.
For pickup today or tomorrow in Melbourne, checkout also places the temporary
deposit hold, using a separate payment method for each PaymentIntent so a
single-use card method is not reused. For later pickup, the customer explicitly
consents to saving their card with Stripe; the deposit hold is attempted at
6:00 am AEST or 7:00 am AEDT on pickup day. New pickup times must be 7:30 am or later.
The hire-payment webhook also resumes due holds after the scheduled run.
Four-night and longer hires use bank transfer or cash on pickup.
An explicitly configured zero deposit creates no hold and shows no deposit-hold
instructions. A failed deposit can be retried without charging the paid hire again.

`/api/cron/deposit-holds` runs once daily at 20:00 UTC (06:00 AEST / 07:00 AEDT).
It is protected by `CRON_SECRET`, resumes saved intents rather than creating duplicate holds,
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

## Pickup and drop-off reminders

Email reminders are unchanged: around noon Melbourne time on the day before pickup, once daily at 01:00 UTC (11:00 am AEST / 12:00 pm AEDT).

`/api/cron/pickup-reminders` runs once daily through Vercel Cron and emails customers with a pickup scheduled for the next day in Melbourne. Set `CRON_SECRET` to a long random value in Vercel project environment variables; Vercel sends it as a Bearer token. The route uses the server-only Supabase service role and Resend credentials. Apply the booking migration before enabling the cron.

Pickup and drop-off SMS use two Hobby-compatible, once-daily Vercel jobs:
`/api/cron/hire-reminders` at 21:00 UTC and
`/api/cron/hire-reminders-evening` at 08:00 UTC. Both jobs process both reminder
types. Hobby may start a job up to 59 minutes after its scheduled hour.
The morning window is 7–8 am AEST / 8–9 am AEDT, and the evening window is
6–7 pm AEST / 7–8 pm AEDT. Melbourne-local date/time checks handle daylight saving.
Pickups at or before 9:00 am are eligible from the previous evening window.
Required Stripe
deposits must already be authorised (or captured), and the hire paid; zero
deposits need no hold. An unready deposit is checked again on later runs and
successful deposit/hire payment events attempt a catch-up for that booking only, but
no pickup SMS is sent after the pickup slot. If an early pickup's hold is not
ready the previous evening, the SMS can catch up before pickup once secured.
The message asks the customer to contact the business beforehand if running late
or changing their pickup time.

The SMS cron uses `CRON_SECRET`, server-only Supabase and Mobile Message
credentials. Concurrent runs use a recoverable booking-level claim plus a
stable provider idempotency key. Apply the migration before enabling it.
No sub-daily cron expression, external scheduler or paid Vercel plan is required.
The single-type `/api/cron/pickup-sms` and `/api/cron/dropoff-sms` endpoints remain
available for authorised manual recovery but are not scheduled.

Confirmed bookings are eligible for drop-off SMS from the morning window on the
return day, or from the previous evening window for returns at or before 9:00 am. Missed runs
can catch up strictly before the scheduled return; submitted, cancelled,
completed and already-reminded bookings are skipped. Return reminders do not
depend on deposit status. The message includes the scheduled return time in
AM/PM format, a reminder to check and pack all equipment, cables and accessories,
then a separate contact/late-fee paragraph. It has no address or private-residence note. It uses "today"
or "tomorrow" as appropriate and is capped at three SMS parts (up to three credits).

Both reminders appear in the admin Communications trail and use independent
sent timestamps, recoverable claims and provider idempotency keys. Apply the
canonical migration before deployment to add drop-off tracking and allow its
message type in the SMS history table. This does not add a drop-off email.

## Run

```bash
npm run dev
```

## Browser testing

Use Playwright only for UI checks; do not use the VS Code integrated browser. Run checks against the local development app and the uncommitted changes:

```bash
npm run test:e2e
```

Playwright automatically selects a stable port for each worktree and starts its own local server; it does not attach to another agent's running server. Set `PORT` only when explicitly choosing a port.

The deployed preview at `https://peppermint-audio.vercel.app/` may be used for separate post-deployment checks. Do not use the production custom domain from this environment because Netskope can interfere with it.

## Verify

```bash
npm run lint
npm run build
npm test
npm test -- --coverage
npm run test:e2e
```

## Notes

- Package/pricing content lives in `lib/site-content.ts`.
- Contact form validation schema is in `lib/validation/enquiry.ts`.
- API email sending endpoint is `app/api/enquiry/route.ts`.
- Project documentation lives in [`README/`](./README/), including the [Stripe integration guide](./README/STRIPE-INTEGRATION.md).
