<!-- BEGIN:nextjs-agent-rules -->
# Next.js guidance

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project reference

## Business and deployment

Peppermint Audio is a Melbourne PA/audio-equipment rental business. The public website presents ready-to-use packages for parties, weddings, corporate events, live gigs, presentations, and private functions. Equipment is collected and returned from Abbotsford 3067; the public contact details are `0452 316 823` and `contactus@peppermintaudio.com.au`.

The production site is deployed to Vercel from the private GitHub repository `randomblues/peppermint-audio`, using the `main` branch. The production domain is `https://www.peppermintaudio.com.au`. Do not commit credentials, customer IDs, Supabase service-role keys, OAuth tokens, or private booking data.

## Technology stack

- Next.js `16.2.6` App Router with React `19.2.4` and TypeScript.
- Tailwind CSS v4 with shadcn-style components built on `@base-ui/react`.
- React Hook Form, `@hookform/resolvers`, and Zod for form handling and validation.
- Supabase for booking persistence, authentication, and private photo-ID storage.
- Resend for internal, customer, reminder, confirmation, and custom email delivery.
- Google APIs for optional Google Calendar OAuth and event creation.
- JSZip for admin archive exports.
- Vitest v3 with Testing Library, jsdom, and V8 coverage.
- Playwright for end-to-end smoke tests in `tests/e2e`.
- Vercel Cron for daily pickup reminders.

## Source-of-truth files

- `lib/site-content.ts`: business details, package tiers, package inclusions, add-on catalog, FAQs, hire terms, and process copy. Do not duplicate package prices or add-on eligibility elsewhere.
- `lib/validation/booking.ts` and `lib/validation/enquiry.ts`: server/client validation schemas.
- `lib/supabase.ts`: server/admin and browser/auth Supabase clients plus the private photo-ID bucket name.
- `lib/admin-dashboard.ts`: booking status values, filtering, counts, and upcoming-booking logic.
- `lib/pickup-reminders.ts`: pickup reminder date logic and branded email template.
- `supabase/001_booking_management.sql`: canonical database/storage migration. Rerun it safely after schema changes; it uses idempotent `if not exists` statements where appropriate.
- `vitest.config.ts` and `vitest.setup.ts`: test discovery, jsdom, aliases, and Testing Library cleanup.

## Public routes and website behavior

- `/`: homepage, package summaries, process, and primary booking CTA.
- `/packages`: package detail tabs and custom-package enquiry CTA.
- `/booking`: seven-step booking-request form. This is publicly linked as **Book now** from the navbar and homepage.
- `/contact`: general enquiry form and package-aware enquiry links.
- `/how-it-works`, `/faq`, `/get-started`: informational pages.
- `/robots.txt`, `/sitemap.xml`, `/icon.svg`: metadata/assets.
- `/admin/login`: Supabase-authenticated admin login.
- `/admin`: protected booking operations console.

The booking page must describe the lifecycle accurately: submitting the form creates a request; it is not confirmed until Peppermint Audio reviews availability and confirms it. The final form state must not imply that submission itself is a confirmed booking.

## Booking lifecycle and data flow

1. A customer submits `/booking` with customer/event details, dates, package, optional package-specific add-ons, two photo-ID files, and accepted hire terms.
2. `POST /api/booking` validates multipart form data with Zod, validates add-ons against the selected package, uploads both IDs to the private `booking-photo-ids` bucket, and inserts a row in `public.bookings` with `status: 'submitted'`.
3. The booking route returns after validation, uploads, and persistence. Calendar/email side effects run in Next.js `after()` so the customer response is not delayed by integrations.
4. The initial customer email confirms receipt of the request only. It must not say the booking is confirmed.
5. An admin reviews the request in `/admin` and changes status from `submitted` to `confirmed` only after availability is checked.
6. The confirmed transition sends the branded confirmation email automatically and records `confirmation_email_sent`.
7. The admin **Send Email** menu can send a confirmation email, pickup reminder, or custom email. Confirmation resend is restricted to confirmed bookings.
8. Other statuses are `completed` and `cancelled`. Cancelled/completed bookings are excluded from upcoming-booking logic and automated pickup reminders.

The initial booking flow also attempts Google Calendar creation and internal/customer request emails. Calendar failure is recorded without invalidating the persisted request; email and persistence failures must be surfaced explicitly.

## API route inventory

- `POST /api/booking`: public booking request submission.
- `POST /api/enquiry`: public general enquiry email.
- `GET/PATCH/DELETE /api/admin/bookings`: authenticated list, status/notes update, and destructive deletion with private-ID cleanup.
- `POST /api/admin/export`: authenticated ZIP archive export containing booking CSV/JSON/readme and private IDs.
- `POST /api/admin/login`, `POST /api/admin/logout`: Supabase admin session cookie lifecycle.
- `GET /api/admin/photo-link`: authenticated short-lived signed URL for a private ID.
- `POST /api/admin/test-reminder`: authenticated reminder-template send action.
- `POST /api/admin/send-confirmation`: authenticated confirmation-email resend for confirmed bookings.
- `POST /api/admin/send-custom-email`: authenticated custom email to a booking contact.
- `GET /api/cron/pickup-reminders`: CRON_SECRET-protected daily reminder job.
- `GET /api/google-calendar/connect`, `GET /api/google-calendar/callback`: OAuth connect/callback.

Admin routes must remain server-only. Never expose `SUPABASE_SERVICE_ROLE_KEY`, private storage paths, or customer photo IDs to the browser.

## Database and storage

The `public.bookings` table includes:

- Identity/contact: `id`, `email`, `first_name`, `last_name`, `mobile`.
- Event: `event_type`, `event_address`, `pickup_date`, `dropoff_date`, `guest_count`.
- Hire: `package_interest`, `add_ons`, `additional_details`, `terms_accepted`.
- Private IDs: `photo_id_paths` in the non-public `booking-photo-ids` bucket.
- Lifecycle: `status` (`submitted`, `confirmed`, `completed`, `cancelled`).
- Outcomes: `calendar_event_link`, `calendar_error`, `internal_email_sent`, `customer_email_sent`, `confirmation_email_sent`, `reminder_sent_at`.
- Operations: `internal_notes`, `created_at`, `updated_at`.

Run the full migration in Supabase after schema changes, especially before using confirmation tracking or add-ons in production. Existing production databases do not update automatically just because the repository migration changed.

## Environment variables

Required email/configuration variables:

- `RESEND_API_KEY`
- `ENQUIRY_FROM_EMAIL`
- `ENQUIRY_TO_EMAIL`
- `NEXT_PUBLIC_SITE_URL` (optional; confirmation email logo falls back to the production domain)

Supabase:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)

Google Calendar:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALENDAR_REDIRECT_URI`
- `GOOGLE_CALENDAR_REFRESH_TOKEN`
- `GOOGLE_CALENDAR_ID` (optional; defaults to `primary`)

Operations:

- `CRON_SECRET`

Never put secret values in source files, test fixtures committed with real credentials, shell arguments, or documentation.

## Email and calendar conventions

- Customer-provided values in HTML email must be escaped.
- Request-received email and confirmed-booking email are different states and must use different wording.
- Confirmation email is sent only when an admin confirms, or deliberately uses the confirmed-booking resend action.
- Pickup reminders use Melbourne timezone/date logic and must not send for cancelled bookings or already-reminded bookings.
- Google Calendar events span pickup through drop-off and do not add customers as attendees.
- A previously observed Google OAuth `invalid_grant` issue was caused by CRLF/newline characters in the Vercel refresh-token value. Keep refresh tokens as a clean single-line value.

## Testing and verification

Every behavior change requires unit tests. The suite currently covers API routes, booking/enquiry forms, admin operations, calendar helpers, validation, email templates, shared components, metadata pages, and UI primitives.

Use:

```bash
npm test
npm test -- --coverage
npm run lint
npm run build
npm run test:e2e
```

The focused test command is preferred while iterating; the full suite and build are required before a feature is considered complete when practical. Tests intentionally log simulated provider/database failures in some error-path cases; a passing exit code is the source of truth.

## Operational gotchas

- Apply `supabase/001_booking_management.sql` manually in the production Supabase project after schema changes.
- Vercel Cron invocation may be difficult to verify from the dashboard; use the authorized route and inspect logs carefully.
- `after()` moves calendar/email work after the booking response; do not assume those side effects have completed when the HTTP response returns.
- Preserve unrelated working-tree changes. In particular, inspect `git status --short` before edits and never reset or checkout files as a recovery shortcut.
- Use `git diff --check` before commits. Do not commit or push unless the user explicitly asks.

# Agent working rules

These rules are mandatory. Safety, preservation of existing work, bounded execution, and truthful verification take priority over speed.

## Before acting

- Inspect the relevant files and current state before editing or running a command.
- Confirm the purpose, scope, destructive risk, blocking risk, completion condition, verification method, and recovery method for the planned action.
- Never silently ignore, weaken, reinterpret, or work around repository instructions.
- Do not modify `AGENTS.md`, repository instructions, or other governance files unless the user explicitly requests it.

## File changes

- Use the smallest complete targeted edit that satisfies the request.
- Preserve existing style, structure, encoding, and line endings.
- Never overwrite, delete, truncate, rename over, or recreate an existing file as a recovery method after an edit failure.
- If an edit fails: stop, re-read the complete file, inspect for partial changes and permissions/path issues, check Git state, then retry only with a smaller targeted edit.
- After editing, re-read the changed section and run the most relevant syntax check, formatter, linter, type-check, or test.
- Do not modify generated files, lockfiles, or release metadata unless the task requires it.

## Mandatory unit testing

- Every code change or new feature MUST include or update unit tests covering the changed behavior.
- Unit tests are mandatory; do not consider a code change complete without them unless the change is documentation-only or a test is technically impossible. In that case, document the reason explicitly in the completion report.
- Run the relevant focused tests and the broader test suite when practical, and report the actual results.

## Terminal commands

- Use commands appropriate for the detected operating system and shell.
- Prefer readable, independently verifiable commands over large one-liners.
- Use non-interactive commands with a clear completion condition. Do not run editors, pagers, watchers, follow-mode logs, foreground servers, or commands that wait for input.
- Every potentially long-running command must be bounded by a timeout, finite output/count, non-watch mode, or a tool-native wait condition.
- Do not repeatedly poll a command that has not terminated. If it appears stuck, identify the cause, stop checking in a loop, and replace it with a bounded command.
- Quote paths and variables safely, use `--` before filenames where supported, and avoid `eval` or shell wrappers unless genuinely required.
- Never put credentials, tokens, private keys, or other secrets in command arguments or generated files.

## Destructive actions

- Treat deletion, replacement, truncation, force operations, resets, and changes outside the requested scope as destructive.
- Inspect the target first and prefer a dry run where available.
- Do not perform destructive actions unless the user's request clearly authorizes the exact action and target.
- Never broaden scope or use uninspected wildcards for destructive actions.

## Git safety

- Run `git status --short` before and after changes.
- Do not discard unrelated working-tree changes or stage unrelated files.
- Do not amend, rebase, reset, force-push, delete branches, commit, or push unless explicitly requested.
- Before claiming completion, inspect the relevant diff and run `git diff --check`.

## Verification and recovery

- A tool returning without an error is not sufficient proof of success.
- Use the narrowest relevant validation: parse configuration with the framework or language tooling, lint or type-check changed code, and run targeted tests when available.
- Do not rerun a failing command unchanged. First inspect the actual failure, state the new hypothesis, and change the approach.
- If a command is cancelled or interrupted, reassess the filesystem and Git state before continuing; preserve all existing work.
- Never claim a test, build, or command passed unless its actual result was checked.

## Completion report

Report:

- what changed and which files changed;
- validations or commands run and their actual outcomes;
- anything incomplete and the exact reason; and
- any manual authentication or approval still required.
