<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project reference

## Business and deployment

Peppermint Audio is a Melbourne PA/audio-equipment rental business. The public website presents ready-to-use packages for parties, weddings, corporate events, live gigs, presentations, and private functions. Equipment is collected and returned from Abbotsford 3067; the public contact details are `0452 316 823` and `contactus@peppermintaudio.com.au`.

The production site is deployed to Vercel from the private GitHub repository `randomblues/peppermint-audio`, using the `main` branch. The production domain is `https://www.peppermintaudio.com.au`. Do not commit credentials, customer IDs, Supabase service-role keys, OAuth tokens, or private booking data.

## Technology stack

- Next.js `16.3.8` App Router with React `19.2.4` and TypeScript.
- Tailwind CSS v4 with shadcn-style components built on `@base-ui/react`.
- React Hook Form, `@hookform/resolvers`, and Zod for form handling and validation.
- Supabase for booking persistence, authentication, and private photo-ID storage.
- Resend for internal, customer, reminder, confirmation, and custom email delivery.
- Google APIs for optional Google Calendar OAuth and event creation.
- JSZip for admin archive exports.
- Vitest v3 with Testing Library, jsdom, and V8 coverage.
- Playwright for end-to-end smoke tests in `tests/e2e`.
- Vercel Cron for daily pickup reminders and deferred security-deposit holds.
- Stripe for customer payment links, hire payments, and deposit authorisations; `pdf-lib` for invoice/receipt PDFs.

## Source-of-truth files

- `lib/site-content.ts`: business details, package tiers, package inclusions, add-on catalog, FAQs, hire terms, and process copy. Do not duplicate package prices or add-on eligibility elsewhere.
- `lib/validation/booking.ts`: server-side multipart intake validation; `lib/validation/enquiry.ts`: shared enquiry validation.
- `lib/supabase.ts`: server/admin and browser/auth Supabase clients plus the private photo-ID bucket name.
- `lib/admin-dashboard.ts`: booking status values, filtering, counts, and upcoming-booking logic.
- `lib/pickup-reminders.ts`: pickup reminder date logic and branded email template.
- `supabase/001_booking_management.sql`: canonical database/storage migration. Rerun it safely after schema changes; it uses idempotent `if not exists` statements where appropriate.
- `vitest.config.ts` and `vitest.setup.ts`: test discovery, jsdom, aliases, and Testing Library cleanup.

## Public routes and website behavior

- `/`: homepage, package summaries, process, and catalogue CTAs.
- `/packages`: package detail tabs with package add-to-cart and detail actions.
- `/equipment`: individual equipment catalogue with add-to-cart and detail actions.
- `/cart`: customer hire selection review; the cart is the only public source of package/equipment selections.
- `/booking`: public booking-request form carrying cart items, customer details, event details, hire times, photo ID, and terms acceptance.
- `/contact`: general enquiry form, with optional package context from catalogue links.
- `/how-it-works`, `/faq`, `/get-started`: informational pages.
- `/robots.txt`, `/sitemap.xml`, `/icon.svg`: metadata/assets.
- `/admin/login`: Supabase-authenticated admin login.
- `/admin`: protected booking operations console.

The public customer flow is catalogue → cart → booking request. The cart sends customers to `/booking`; the booking request confirms receipt only, and availability, final pricing, payment, and hire confirmation are handled by the admin workflow.

## Booking lifecycle and data flow

1. A customer adds packages and/or individual equipment to `/cart`, then submits a booking request through `/booking`.
2. `POST /api/booking` validates the multipart request, uploads the private photo IDs, persists the submitted booking, and runs calendar/email side effects in Next.js `after()`.
3. An admin reviews availability and manages the operational booking record in `/admin`, including canonical `hire_line_items`, dates, pricing, payment method, and security-deposit state.
4. Payment uses Stripe authorisation/payment-intent flows for eligible short hires or bank transfer for longer hires, with deposit capture/release/refund handled by the admin payment workflow.
5. An admin reviews availability and payment state before changing the booking to `confirmed`.
6. The confirmed transition sends the branded confirmation email and records `confirmation_email_sent`.
7. The admin **Send Email** menu can send a confirmation email, pickup reminder, invoice, or custom email. Confirmation resend is restricted to confirmed bookings.
8. Other statuses are `completed` and `cancelled`. Cancelled/completed bookings are excluded from upcoming-booking logic and automated pickup reminders.

`POST /api/booking` is the public multipart booking-request intake. It validates canonical `hire_line_items`, uploads private photo IDs, persists a submitted booking, and runs calendar/email side effects in Next.js `after()`. Calendar failure is recorded without invalidating persistence; email and persistence failures must be surfaced explicitly.

## API route inventory

- `POST /api/booking`: public multipart booking-request intake from `/booking`.
- `POST /api/enquiry`: public general enquiry email.
- `GET/PATCH/DELETE /api/admin/bookings`: authenticated list, status/notes update, and destructive deletion with private-ID cleanup.
- `POST /api/admin/export`: authenticated ZIP archive export containing booking CSV/JSON/readme and private IDs.
- `POST /api/admin/login`, `POST /api/admin/logout`: Supabase admin session cookie lifecycle.
- `GET /api/admin/photo-link`: authenticated short-lived signed URL for a private ID.
- `POST /api/admin/test-reminder`: authenticated reminder-template send action.
- `POST /api/admin/send-confirmation`: authenticated confirmation-email resend for confirmed bookings.
- `POST /api/admin/send-custom-email`: authenticated custom email to a booking contact.
- `POST /api/admin/payments/create-checkout`: authenticated Stripe payment-link creation for eligible short hires.
- `POST /api/admin/payments/bank-transfer`: authenticated bank-transfer or cash-on-pickup payment request with invoice.
- `POST /api/admin/payments/update-booking`: authenticated hire-item, payment-method, and GST updates.
- `POST /api/admin/payments/send-invoice`: authenticated invoice resend.
- `POST /api/admin/payments/manage-deposit`: authenticated deposit release/capture and bank-transfer receipt/refund recording.
- `GET /api/admin/tax-report`: authenticated JSON/CSV tax report by paid or issued date.
- `GET/POST /api/payment/[token]`: public time-limited customer payment link backing `/pay/[token]`.
- `POST /api/stripe/webhook`: Stripe-signed PaymentIntent status updates and billing-document emails.
- `GET /api/cron/pickup-reminders`: CRON_SECRET-protected daily reminder job.
- `GET /api/cron/deposit-holds`: CRON_SECRET-protected daily deferred deposit-hold job.
- `GET /api/google-calendar/connect`, `GET /api/google-calendar/callback`: OAuth connect/callback.

Admin routes must remain server-only. Never expose `SUPABASE_SERVICE_ROLE_KEY`, private storage paths, or customer photo IDs to the browser.

## Database and storage

The `public.bookings` table includes:

- Identity/contact: `id`, `email`, `first_name`, `last_name`, `mobile`.
- Event: `event_type`, `event_address`, `pickup_date`, `dropoff_date`.
- Hire: `hire_line_items`, `hire_amount_cents`, `additional_details`, `terms_accepted`, `gst_inclusive`.
- Payments: `payment_method`, `hire_payment_status`, `deposit_payment_status`, Stripe payment-intent IDs, and deposit capture/release fields.
- Private IDs: `photo_id_paths` in the non-public `booking-photo-ids` bucket, used only by the retained server-side booking intake.
- Lifecycle: `status` (`submitted`, `confirmed`, `completed`, `cancelled`).
- Outcomes: `calendar_event_link`, `calendar_error`, `internal_email_sent`, `customer_email_sent`, `confirmation_email_sent`, `reminder_sent_at`.
- Operations: `internal_notes`, `created_at`, `updated_at`.

Run the full migration in Supabase after schema changes, especially before using confirmation tracking, hire line items, or payment fields in production. The migration removes obsolete `package_interest`, `add_ons`, and `guest_count` columns. Existing production databases do not update automatically just because the repository migration changed.

## Environment variables

The complete list lives in the **Environment Variables** section of `README.md`; keep it as the single source rather than duplicating it here. `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`, and Google OAuth secrets are server-only.

Never put secret values in source files, test fixtures committed with real credentials, shell arguments, or documentation.

## Email and calendar conventions

- Customer-provided values in HTML email must be escaped.
- Request-received email and confirmed-booking email are different states and must use different wording.
- Confirmation email is sent only when an admin confirms, or deliberately uses the confirmed-booking resend action.
- Pickup reminders use Melbourne timezone/date logic and must not send for cancelled bookings or already-reminded bookings.
- Google Calendar events span pickup through drop-off and do not add customers as attendees.
- A previously observed Google OAuth `invalid_grant` issue was caused by CRLF/newline characters in the Vercel refresh-token value. Keep refresh tokens as a clean single-line value.

## Customer-facing content boundary

**Internal implementation changes must strictly never leak internal information into customer-facing content.** Admin-only controls, internal notes, implementation details, diagnostic messages, schema or workflow rationale, legal/tax reasoning, and developer explanations must not appear in customer emails, invoices, receipts, PDFs, payment pages, booking confirmations, public pages, or other externally visible output unless that exact wording has been deliberately approved as customer copy.

- Keep internal/admin state separate from customer-facing document and email copy.
- **Strictly never turn internal chat discussions, implementation decisions, provider differences, workarounds, or developer explanations into interface text or other customer-facing copy. Approval of functionality is not approval to publish its explanation. Omit such wording unless the user explicitly approves the exact customer-facing text.**
- When behavior changes internally, review every affected customer-facing surface instead of exposing the internal explanation by default.
- For tax and legal behavior, expose only the accurate customer-facing result required for the document (for example, the appropriate document title and applicable totals), not the internal legal rationale.
- Test both relevant states when wording depends on configuration, such as GST-inclusive versus non-GST invoices.

## Testing and verification

Every behavior change requires unit tests. The suite currently covers API routes, booking/enquiry forms, admin operations, calendar helpers, validation, email templates, shared components, metadata pages, and UI primitives.

**For UI checks, use Playwright against the local development app. Use https://peppermint-audio.vercel.app/ only for separate post-deployment checks. Do not use https://www.peppermintaudio.com.au/ from this environment because Netskope can interfere with the custom domain.**

### Playwright-only UI validation

**Use Playwright only for UI checks. Do not use the VS Code integrated browser or other shared interactive browser tools for UI validation.**

Run Playwright against the local development app so it tests the uncommitted changes. Add or update a Playwright test for the affected route and behavior, and use an isolated Playwright browser context. Playwright automatically chooses a stable port for VS Code-created worktrees; `PORT` may be set explicitly when needed:

```bash
npm run test:e2e
```

The Playwright configuration starts its own server and must not attach to an already-running server. A port conflict should fail explicitly rather than test another agent's app.

For responsive UI changes, use Playwright to check all of these widths:

- 360px (Small Mobile)
- 390px (Modern iPhone)
- 412px (Large Android)
- 540px (Foldable Closed)
- 768px (Tablet Portrait)
- 1024px (Tablet Landscape)
- 1280px (Desktop)
- 1920px (Large Desktop)

At each required width, use Playwright assertions and screenshots as appropriate to verify:

- No horizontal scrolling unless intentional
- No clipped or hidden content
- No overlapping text
- No inaccessible buttons or controls
- No layout breakage
- Navigation remains functional
- Forms remain usable
- Dialogs remain within viewport bounds
- No browser console errors

If any viewport or interaction fails:

1. Fix the issue.
2. Re-test **all** viewport widths.
3. Repeat until **all** viewport widths pass.

The agent must **not**:

- Assume responsiveness from code inspection
- Assume responsiveness because a framework is being used
- Skip browser testing
- Use or foreground the VS Code integrated browser for UI validation
- Mark work as complete without successful Playwright validation

For UI/UX-affecting tasks, report a Playwright pass/fail checklist for 360, 390, 412, 540, 768, 1024, 1280, and 1920 widths. If a width is not relevant or could not be tested, state why; do not imply it passed.

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
- Use a unique `PORT` per worktree for development and Playwright. Playwright starts its own server and does not reuse an existing listener; do not stop another agent's server to resolve a conflict.
- Before starting a development server, check whether its requested port already has a listener. Use `npm run dev` as the standard launcher. For agent-run long-lived servers, use `scripts/dev-detached.sh` to run it in the background. Check startup from the launcher output or `/tmp/dev-<port>.log` for detached servers, and stop detached servers with `scripts/dev-stop.sh <port>`. Do not interrupt a server you do not own.
- Never start a long-running process (including development servers, watchers, or `stripe listen`) in a way that keeps a shell attached. Run it detached with output redirected to a log file. For local Stripe forwarding, use `scripts/dev-stripe-detached.sh`; it starts the app and listener together so the generated signing secret is passed directly to the app.
- After a Playwright check passes, do not repeat the same validation loop unless code or viewport behavior has changed. Report the result and move on.
- Preserve unrelated working-tree changes. In particular, inspect `git status --short` before edits and never reset or checkout files as a recovery shortcut.
- Use `git diff --check` before commits. Do not commit or push unless the user explicitly asks.

## Parallel agent work

- When the user wants multiple chats or agents to edit this project, use one Git worktree per editing chat. Prefer VS Code's **New Worktree** option when starting each chat; do not ask the user to run the worktree helper commands manually.
- If a chat is already in a shared checkout and the host offers a managed worktree/isolation action, use it before editing. If it requires confirmation, request that confirmation. If no managed action is available, explain the VS Code **New Worktree** option; use `scripts/agent-worktree.mjs` only as a fallback.
- A new worktree starts from the current commit and does not include uncommitted changes. Before isolating, warn the user if the new chat would need uncommitted work; never discard or silently omit that work.
- Each worktree has an isolated local Supabase stack. Playwright automatically chooses a stable worktree-specific app port; use `npm run test:e2e` without a port override unless one is explicitly needed.

## Local development environment

Every new agent session must use the local-only Supabase stack when working
locally. Never use the hosted database, production admin credentials or real
customer data for local validation.

- Before running local setup commands, read the current `package.json` scripts
  and this section from disk. These define the current workflow; do not reuse
  removed setup commands from older session guidance. Startup, migration and
  health checks are handled by the app launcher, not separate database commands.
- Start the app with `npm run dev`; for agent-run long-lived servers, use
  `scripts/dev-detached.sh`, which runs the same launcher in the background. It starts or reuses this worktree's
  local stack and injects its credentials into Next.js. Read `/tmp/dev-<port>.log` to check startup and use
  `scripts/dev-stop.sh <port>` to stop it. Keep one task server on the agreed
  port and do not interrupt another agent's server without approval.
- The local stack is isolated per worktree and is not seeded with bookings or an
  admin account. Use only a separately provisioned disposable local admin for
  admin testing; never ask for or use production credentials.
- Do not run a database reset or delete volumes without explicit approval.
- Local database isolation does not sandbox Stripe, Resend or Google Calendar.
  Use Stripe test keys, safe email settings and disabled calendar integration.
  Never assume a local booking cannot trigger an external side effect.
- Use Playwright only for UI checks. Do not open or foreground the VS Code integrated browser for validation.

## Self-improvement and technical issue log

This section is a persistent, lightweight feedback loop. When a technical issue causes wasted work, a misleading result, a repeated validation loop, or a preventable delay, append a dated entry with the symptom, root cause, prevention rule, and the next action. Read this section before starting similar work and apply the prevention rule. Do not silently repeat a known failure.

### 2026-10-03 — Conflicting localhost development servers

- **Symptom:** Browser tabs showed different versions of the public site, making current changes appear stuck or missing.
- **Root cause:** Multiple task-owned Next.js servers were left running on ports 3000–3003, and checks alternated between them.
- **Prevention:** Use the assigned port for each worktree; have Playwright start its own server instead of reusing another listener.
- **Next action:** Run `npm run test:e2e` from the worktree and keep its automatically selected port consistent for the task.

### 2026-10-03 — Repeated validation after completion

- **Symptom:** The same tests, builds, and Playwright checks were rerun after they had already passed, delaying delivery.
- **Root cause:** Validation scope was not closed after a successful result, and stale-server confusion triggered unnecessary rechecks.
- **Prevention:** Maintain a clear completion checklist; rerun only the check affected by a subsequent code change; report passed checks once and proceed.
- **Next action:** After the final edit, run the smallest affected tests plus the required final suite/build/Playwright checks once, then stop unless a concrete failure appears.

### 2026-10-03 — Browser test draft left in local storage

- **Symptom:** The active localhost site reopened with test customer data, making the page look stuck or incorrectly populated.
- **Root cause:** Browser validation data was written to the new booking draft storage and was not cleared before the next inspection.
- **Prevention:** Use clearly disposable test data, clear the booking draft after browser checks, reload the page, and verify the form is clean before handing control back.
- **Next action:** Never leave test customer data in the active browser tab or local storage.

### 2026-10-05 — QA execution and reporting discipline

- **Symptom:** Exploratory QA occasionally lost time due to tool-level race noise and large command outputs, and useful process lessons risked being dropped after the report.
- **Root cause:** Parallel field-entry actions in one page interaction can conflict, large test output was not always summarized with targeted extraction first, and lesson capture was not consistently codified after each run.
- **Prevention:** Prefer sequential or scripted single-flow interactions for form-heavy checks; when command output is large, inspect saved output files with targeted `rg`/bounded reads; include a concise "Quick lessons learned" section in reports when meaningful.
- **Next action:** After each substantial run, provide "Quick lessons learned" and explicitly ask the user whether to persist the lessons into this log; update this log only with explicit user approval.

### 2026-10-09 — Local Supabase email login and signup flags

- **Symptom:** A local email user could be created, but signing in failed with "Email logins are disabled".
- **Root cause:** Setting `[auth.email].enable_signup = false` disabled the email login provider, not just public account creation.
- **Prevention:** Keep `[auth].enable_signup = false` to block public signup while setting `[auth.email].enable_signup = true` to allow administrator email login.
- **Next action:** After changing Auth configuration, restart only the affected local stack and validate local sign-in against local Auth.

### 2026-10-09 — Responsive admin selectors and post-login state

- **Symptom:** Browser checks timed out waiting for a booking name even though local authentication and booking retrieval worked.
- **Root cause:** Text selectors matched a hidden responsive copy; client-side navigation also exposed the initial loading state before booking controls were ready.
- **Prevention:** Select visible semantic controls rather than the first duplicated text label. For data-access smoke checks, sign in through the same Playwright context's request API, navigate to `/admin`, and wait for the actual booking control. Test the login form separately when its behavior is in scope.
- **Next action:** Use a booking button's accessible name and wait for loaded controls in the isolated Playwright context when a disposable local admin account is available.

### 2026-10-10 — Mocked photo conversion missed HEIC compatibility

- **Symptom:** Photo-ID uploads passed unit tests, but a customer's HEIC image failed conversion in the browser.
- **Root cause:** Conversion tests mocked the decoder and therefore verified the wrapper without exercising real HEIC decoding or browser-bundle compatibility.
- **Prevention:** Keep wrapper unit tests, but also test the actual decoder with a generated, private-data-free HEIC fixture through the booking form. Check the submitted JPEG MIME type, signature and upload-size limit.
- **Next action:** Run `tests/e2e/photo-id.spec.ts` on desktop and mobile after decoder changes, and use Playwright for responsive checks. Do not claim compatibility with a particular customer file based only on a synthetic fixture.

### 2026-10-10 — Hung Docker container starts and unbounded local startup

- **Symptom:** `npm run dev` stalled for many minutes after Docker Desktop launched; Supabase containers stayed `Created`, and the launcher never exited.
- **Root cause:** Docker Desktop 4.43.2 answered `docker info` but its host backend hung every container start (even a trivial `docker run`). The launcher hid this behind a blocking `execFileSync`; on timeout it killed only the npm `.bin/supabase` wrapper, orphaning the native CLI, which kept output pipes open and Node alive. The interrupted start then left a `Created` database container that made later `supabase start` runs fail immediately.
- **Prevention:** Prove the engine can start a trivial container before blaming Supabase. On macOS there is no `timeout`; signal-based limits (for example Perl `alarm`) can be swallowed because `docker run` forwards signals to the container, so use a fork-and-SIGKILL helper. Kill whole process groups when stopping child commands. Avoid reading Docker's Group Container settings file or running `python3` without a bound, because both can hang on macOS prompts or shims.
- **Next action:** Keep `scripts/local-dev.mjs` startup bounded (process-group kill, `Created`-state watchdog, redacted progress), and verify a fixed Docker engine with `docker run --rm hello-world` before rerunning `npm run dev`.

### 2026-10-10 — Stale Next.js route types after route deletion

- **Symptom:** Type-checking or the build failed on a generated route validator after its route had been deleted.
- **Root cause:** `.next/dev/types` still contained generated type entries for the removed route.
- **Prevention:** When deleting a route, check whether stale generated route types remain before diagnosing a source-code type error.
- **Next action:** Remove the stale `.next/dev/types` output or rerun `next dev` to regenerate it, then rerun the build.

### 2026-10-10 — Single local development entry point

- **Symptom:** Local setup exposed several commands for starting, stopping, checking, seeding, and verifying services even though `npm run dev` already starts or reuses the local stack and app.
- **Root cause:** Local database administration commands were presented as part of the normal development workflow.
- **Prevention:** Keep `npm run dev` as the default local entry point; expose additional commands only when a recurring workflow requires them.
- **Next action:** Keep local startup, health checks, and optional Stripe forwarding together in `scripts/local-dev.mjs`.

### 2026-10-10 — Restricted environment file access blocked a local test launch

- **Symptom:** Local end-to-end testing was delayed after access to `.env.local` was denied.
- **Root cause:** Restricted access to the environment file was incorrectly treated as a blocker to invoking the repository's normal local launcher.
- **Prevention:** Do not inspect restricted environment files; when the user requests the documented local launcher, run it directly and assess its explicit startup result.
- **Next action:** Use `npm run dev` for local UI validation without independently opening `.env.local`.

### 2026-10-10 — Current checkout workflow verification

- **Symptom:** A removed standalone database command was recommended for this checkout.
- **Root cause:** Session-provided workflow guidance lagged behind the active repository scripts.
- **Prevention:** Check the active checkout's package scripts before relying on environment-provided setup commands.
- **Next action:** Use `npm run dev` as the standard local launcher; keep removed setup commands out of maintained project guidance.

### 2026-10-12 — Payment checkout browser test lacked a real link

- **Symptom:** The first browser check showed a missing payment link instead of the consent copy.
- **Root cause:** The test used a dummy token against the real local API, which correctly returned 404.
- **Prevention:** Intercept the local payment API with a disposable test response when validating checkout UI, so the actual page renders without creating a real payment link or triggering a charge.
- **Next action:** Verify the consent text, checkbox interaction, and responsive layout with Playwright at the required viewport widths.

### 2026-10-12 — Google Ads keyword pagination returned stale rows

- **Symptom:** A broad-match audit initially read previous-page keyword rows after the pagination counter had advanced.
- **Root cause:** The table data refreshed more slowly than the page counter, so rapid page navigation produced stale row results.
- **Prevention:** Wait for the keyword table itself to finish refreshing before auditing each page; confirm its displayed rows match the current page.
- **Next action:** Use settled row data for each page when checking keyword status across a paginated Google Ads list.

### 2026-10-30 — Optional Stripe forwarding blocked local UI startup

- **Symptom:** The local app failed to start after the local database became healthy because Stripe CLI forwarding could not reach its OAuth endpoint through the proxy.
- **Root cause:** Local Stripe webhook forwarding was enabled even though the UI validation did not involve Stripe webhooks.
- **Prevention:** For local checks unrelated to Stripe webhooks, start the app with `LOCAL_STRIPE_WEBHOOKS=false`; enable forwarding only when webhook testing is intended and Stripe CLI authentication is available.
- **Next action:** Keep unrelated local browser validation on the local Supabase stack without optional Stripe forwarding.

### 2026-11-05 — Enquiry tests use an expired event date

- **Symptom:** Four enquiry route tests returned validation errors instead of reaching their email assertions.
- **Root cause:** The shared test payload hard-codes `eventDate` to `2026-10-10`, while enquiry validation rejects dates earlier than the current Melbourne date.
- **Prevention:** Freeze the test clock or derive a deterministic future event date for date-sensitive enquiry tests.
- **Next action:** Update the shared enquiry test fixture so the validation boundary remains deterministic across dates.

### 2026-11-05 — Detached launcher test reads partial capture output

- **Symptom:** The launcher argument test intermittently read only `run` from its capture file and failed its full-argument assertion; the isolated test passed.
- **Root cause:** The fake `npm` process creates the capture file in its first `printf`, while `waitForFile` returns as soon as the path exists, before later arguments are appended.
- **Prevention:** Wait for a completion marker or child-process exit, or write captured arguments atomically before asserting.
- **Next action:** Make the launcher test wait for complete capture contents rather than file existence alone.

### 2026-11-05 — Duplicate Communications component declaration

- **Symptom:** The admin console failed to compile because `CommunicationsSection` was declared twice.
- **Root cause:** The Communications component was left in both its original and relocated positions during integration.
- **Prevention:** Search for duplicate component declarations after moving or consolidating components.
- **Next action:** Keep one canonical definition and run the focused test and build checks after integration.

### 2026-11-06 — Supabase CLI project not linked

- **Symptom:** Supabase authentication and project listing succeeded, but remote database queries reported no linked project.
- **Root cause:** CLI authentication is account-wide, while project linkage is local to the repository work directory.
- **Prevention:** Run `supabase link --project-ref <ref>` from the repository root and verify the project reports `linked: true` before remote queries.
- **Next action:** Verify the remote target with a read-only query before applying an explicitly approved SQL change.

### 2026-11-09 — Different local and global Supabase CLI versions

- **Symptom:** Production SQL stalled at `Initialising login role...` despite successful authentication and project listing.
- **Root cause:** The repository CLI and globally authenticated CLI were different versions. The repository CLI stalled, while the global v3 CLI completed the same remote operation.
- **Prevention:** Compare the repository and global CLI versions before repeating login or linkage steps. Use the selected CLI's documented remote flags and verify the target with a read-only query first.
- **Next action:** For approved production SQL, use `supabase db query --remote=<ref> --read-only "<sql>"` for verification; use `--yes` for writes only after explicit approval. Keep the existing app launcher for local development.

### 2026-11-09 — Internal calendar discussion published as interface copy

- **Symptom:** The customer calendar card displayed an explanation of the Google versus Apple/Outlook event behaviour discussed internally.
- **Root cause:** Approval of the calendar functionality was incorrectly treated as approval to publish the implementation explanation.
- **Prevention:** Strictly keep internal discussions and implementation explanations out of all interfaces, messages, and documents shown to customers. Functional approval never authorizes explanatory copy; the exact wording requires separate explicit approval.
- **Next action:** Remove the calendar implementation explanations, preserve the agreed functionality, and assert their absence in unit and browser tests, including when times are not arranged.

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
- a brief "Quick lessons learned" section (what worked, what failed, delay cause, better approach) when meaningful.

After providing any "Quick lessons learned" section, ask the user whether they want those lessons added to the "Self-improvement and technical issue log" in this file. Do not update this file with new lessons unless the user explicitly approves.
