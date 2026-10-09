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
- `GET /api/cron/pickup-reminders`: CRON_SECRET-protected daily reminder job.
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

## Customer-facing content boundary

**Internal implementation changes must strictly never leak internal information into customer-facing content.** Admin-only controls, internal notes, implementation details, diagnostic messages, schema or workflow rationale, legal/tax reasoning, and developer explanations must not appear in customer emails, invoices, receipts, PDFs, payment pages, booking confirmations, public pages, or other externally visible output unless that exact wording has been deliberately approved as customer copy.

- Keep internal/admin state separate from customer-facing document and email copy.
- When behavior changes internally, review every affected customer-facing surface instead of exposing the internal explanation by default.
- For tax and legal behavior, expose only the accurate customer-facing result required for the document (for example, the appropriate document title and applicable totals), not the internal legal rationale.
- Test both relevant states when wording depends on configuration, such as GST-inclusive versus non-GST invoices.

## Testing and verification

Every behavior change requires unit tests. The suite currently covers API routes, booking/enquiry forms, admin operations, calendar helpers, validation, email templates, shared components, metadata pages, and UI primitives.

**For browser testing and manual website checks, always use https://peppermint-audio.vercel.app/. Do not use https://www.peppermintaudio.com.au/ from this environment because Netskope can interfere with the custom domain.**

### STRICT BROWSER UI VALIDATION RULE

**EVERY NEW FEATURE OR UI CHANGE MUST BE OPENED AND CHECKED IN A REAL BROWSER BEFORE IT IS CONSIDERED COMPLETE. THIS IS MANDATORY, NOT OPTIONAL.**

**CHECK THE FEATURE AT BOTH LAPTOP/DESKTOP WIDTH AND PHONE WIDTH. INSPECT THE ACTUAL RENDERED UI, INCLUDING SPACING, ALIGNMENT, OVERFLOW, RESPONSIVE BEHAVIOR, POP-OVERS, MENUS, FORM CONTROLS, BUTTONS, AND ERROR/SUCCESS STATES.**

**IF ANYTHING LOOKS MISALIGNED, CLIPPED, CROWDED, HARD TO USE, OR OTHERWISE WONKY, FIX IT BEFORE COMPLETION AND RECHECK BOTH VIEWPORTS. DO NOT CLAIM A UI FEATURE IS DONE BASED ONLY ON UNIT TESTS, A BUILD, OR SOURCE INSPECTION.**

**WHEN BUILDING OR MODIFYING A FEATURE, THE BROWSER CHECK MUST USE THE LOCALHOST DEVELOPMENT APP SO THE ACTUAL UNCOMMITTED CHANGES ARE BEING INSPECTED. CHECK BOTH LAPTOP/DESKTOP WIDTH AND PHONE WIDTH ON LOCALHOST BEFORE COMPLETION.** Use the Vercel preview URL only for a separate post-deployment verification. Record any browser-check limitation explicitly rather than silently skipping it.

**IF THE LOCALHOST BROWSER CHECK HAS NOT BEEN COMPLETED AT BOTH REQUIRED VIEWPORT WIDTHS, OR IDENTIFIED VISUAL/RESPONSIVE PROBLEMS HAVE NOT BEEN FIXED AND RECHECKED, THE TASK MUST BE MARKED AS A FAILURE — NOT COMPLETE, NOT READY, AND NOT SUCCESSFUL.**

### 🔴 TOP PRIORITY — MANDATORY RESPONSIVE TESTING POLICY (VS CODE INTEGRATED BROWSER)

**THIS POLICY IS TOP PRIORITY, STRICTLY ENFORCED, AND NON-NEGOTIABLE.**

**NO TASK THAT AFFECTS UI/UX MAY BE MARKED COMPLETE UNLESS THIS POLICY IS FULLY SATISFIED.**

**ANY CHANGE THAT AFFECTS UI, CSS, LAYOUT, PAGES, COMPONENTS, NAVIGATION, FORMS, DIALOGS, TABLES, ACCESSIBILITY, OR VISUAL BEHAVIOUR MUST BE TESTED IN THE VS CODE INTEGRATED BROWSER BEFORE THE TASK CAN BE CONSIDERED COMPLETE.**

**WHEN THE VS CODE INTEGRATED BROWSER IS AVAILABLE, IT MUST BE USED FOR VALIDATION SO BROWSER-AWARE AI TOOLING CAN INSPECT AND VERIFY THE RENDERED APPLICATION.**

Because the VS Code browser has a limited preset list, manual viewport checks are required at all of the following widths:

- 360px (Small Mobile)
- 390px (Modern iPhone)
- 412px (Large Android)
- 540px (Foldable Closed)
- 768px (Tablet Portrait)
- 1024px (Tablet Landscape)
- 1280px (Desktop)
- 1920px (Large Desktop)

For **every** viewport width, verify:

- No horizontal scrolling unless intentional
- No clipped or hidden content
- No overlapping text
- No inaccessible buttons or controls
- No layout breakage
- Navigation remains functional
- Forms remain usable
- Dialogs remain within viewport bounds
- No browser console errors

If **any** viewport fails:

1. Fix the issue.
2. Re-test **all** viewport widths.
3. Repeat until **all** viewport widths pass.

The agent must **not**:

- Assume responsiveness from code inspection
- Assume responsiveness because a framework is being used
- Skip browser testing
- Mark work as complete without browser validation

**COMPLETION REPORTS ARE MANDATORY EVIDENCE. FOR ANY UI/UX-AFFECTING TASK, THE FINAL REPORT MUST INCLUDE A VIEWPORT-BY-VIEWPORT PASS/FAIL CHECKLIST FOR 360, 390, 412, 540, 768, 1024, 1280, AND 1920 WIDTHS. IF THIS CHECKLIST IS MISSING OR INCOMPLETE, THE TASK IS AUTOMATICALLY A FAILURE AND MUST NOT BE MARKED COMPLETE.**

**ANY BREACH OF THIS POLICY MEANS THE TASK IS INCOMPLETE AND MUST BE TREATED AS A FAILURE UNTIL FULL RESPONSIVE VALIDATION PASSES.**

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
- Use one localhost server per task. Before browser validation, check which process owns the target port, stop stale task-owned servers by PID, start one current server, and use one browser tab/URL consistently. Do not alternate between stale `localhost:3000`, `localhost:3001`, `localhost:3002`, or `localhost:3003` tabs.
- **Reuse an existing browser tab when the required site or tool is already open. Do not open duplicate tabs or keep piling up browser tabs.**
- If a browser tab does not reflect an edit, reload it and verify its URL, port, process, and rendered source before changing code again. Do not assume a stale tab proves the implementation is broken.
- After a required browser check passes, do not repeat the same validation loop unless code or viewport behavior has changed. Report the result and move on.
- Preserve unrelated working-tree changes. In particular, inspect `git status --short` before edits and never reset or checkout files as a recovery shortcut.
- Use `git diff --check` before commits. Do not commit or push unless the user explicitly asks.

## Local development database and test administrator

Every new agent session must use the local-only Supabase stack when working
locally. Never use the hosted database, production admin credentials or real
customer data for local validation.

- Run `npm run db:local:status` in the current checkout to check its stack and
  discover its local API, Studio and Auth inbox URLs without printing keys.
- If it is not running, ensure Docker Desktop is running, then use
  `npm run db:local:start`. This applies the canonical booking schema without
  resetting local data. Do not run a database reset or delete volumes without
  explicit approval.
- Run `npm run db:local:seed` when the test account or fixtures are needed.
  It creates the local administrator `admin@peppermint.local` with the admin role
  and three disposable bookings. Repeated seeding preserves existing fixtures.
- The generated test-admin password is in the ignored, owner-readable
  `.local-supabase/admin-login.json` inside that checkout. Never print, commit,
  paste into chat or place these credentials in command arguments.
- Start the app with `npm run dev` (or `npm start` for a built local app), not
  a bare Next.js command. These launchers inject only this worktree's local
  credentials. Keep one task server on the agreed port and do not interrupt
  another agent's server without approval.
- The admin console is at `/admin`; the normal login form is at `/admin/login`.
  **The agent must sign in itself; do not ask the user to fill in credentials.**
  For the integrated browser, reuse the localhost tab and run:
  `await page.evaluate(async () => { const result = await fetch("/api/dev/admin-login", { method: "POST" }); if (!result.ok) throw new Error(await result.text()); });`
  Then navigate that same tab to `/admin`. This endpoint reads the local login
  file on the server and authenticates through local Supabase; it returns normal
  HTTP-only session cookies, never credentials. It is available only in
  development on a loopback, same-origin request, and never on Vercel or in a
  production build. The normal login form remains unchanged.
  For terminal-run Playwright checks, call
  `context.request.post(localUrl + "/api/dev/admin-login", { headers: { origin: localUrl } })`
  then open `/admin` using `context.newPage()` in that same context.
  If the helper reports missing fixtures, run the start/seed commands above and
  retry once. Report browser-tool connection failures instead of asking the user
  to log in or repeatedly retrying a broken browser connection.
  Do not print login data, cookie values or storage-state contents.
- Each worktree has its own stack, ports, data and test-admin credentials.
  Do not borrow another checkout's login file or connect to its database.
- `npm run db:local:verify` checks actual local Auth, the admin role, booking
  persistence, anonymous access denial and private storage with disposable
  fixtures; it cleans up its own verification records and files.
- Local database isolation does not sandbox Stripe, Resend or Google Calendar.
  Use Stripe test keys, safe email settings and disabled calendar integration.
  Never assume a local booking cannot trigger an external side effect.
- Follow the existing integrated-browser validation policy. Independent
  Playwright checks do not replace mandatory integrated-browser evidence.

## Self-improvement and technical issue log

This section is a persistent, lightweight feedback loop. When a technical issue causes wasted work, a misleading result, a repeated validation loop, or a preventable delay, append a dated entry with the symptom, root cause, prevention rule, and the next action. Read this section before starting similar work and apply the prevention rule. Do not silently repeat a known failure.

### 2026-10-03 — Conflicting localhost development servers

- **Symptom:** Browser tabs showed different versions of the public site, making current changes appear stuck or missing.
- **Root cause:** Multiple task-owned Next.js servers were left running on ports 3000–3003, and browser checks alternated between them.
- **Prevention:** Use one canonical localhost port for the task; inspect and stop stale task-owned processes before starting it; verify the active browser URL and port before judging the UI.
- **Next action:** Keep browser validation on `http://localhost:3000` unless that port is unavailable, and record the replacement port explicitly.

### 2026-10-03 — Repeated validation after completion

- **Symptom:** The same tests, builds, and browser checks were rerun after they had already passed, delaying delivery.
- **Root cause:** Validation scope was not closed after a successful result, and stale-server confusion triggered unnecessary rechecks.
- **Prevention:** Maintain a clear completion checklist; rerun only the check affected by a subsequent code change; report passed checks once and proceed.
- **Next action:** After the final edit, run the smallest affected tests plus the required final suite/build/browser checks once, then stop unless a concrete failure appears.

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

### 2026-10-09 — Integrated browser viewport capture

- **Symptom:** Screenshots showed cropped layouts or a different breakpoint from the requested viewport, delaying responsive validation.
- **Root cause:** Integrated-browser screenshot helpers reset or rescale emulated viewport dimensions; a successful `setViewportSize()` call alone did not guarantee capture at that width.
- **Prevention:** Verify `innerWidth` at capture time. If screenshot helpers alter the viewport, use a CDP device-metrics override and direct `Page.captureScreenshot` on the same integrated-browser tab. Inspect the captured images as well as rendered bounds.
- **Additional observation:** Hidden or concurrently controlled tabs can return stale rendered frames even when `innerWidth` matches the requested width. Inspect an actual breakpoint-dependent layout and confirm the frame has updated before trusting the screenshot. If viewport, frame, or input evidence remains inconsistent after a bounded diagnostic attempt, stop retries and report responsive validation as incomplete rather than marking it passed.
- **Next action:** Use a dedicated QA tab, capture evidence at every required width, and wait for cart hydration and the actual end of the page before checking footer clearance.

### 2026-10-09 — Raw patch arguments rejected by tool hook

- **Symptom:** The browser-lock hook blocked calendar edits and the patch to repair the hook itself.
- **Root cause:** The hook attempted to JSON-parse every string-valued tool argument, including raw `apply_patch` text.
- **Prevention:** Parse tool arguments according to the tool's input format. Decode JSON-encoded parallel arguments for lock inspection, but preserve raw patch text and keep browser/terminal ownership checks intact.
- **Next action:** Add regression coverage for raw patch arguments alongside existing JSON-encoded parallel payload tests before extending tool hooks.

### 2026-10-09 — Local Supabase email login and signup flags

- **Symptom:** The local test administrator could be created, but signing in failed with "Email logins are disabled".
- **Root cause:** Setting `[auth.email].enable_signup = false` disabled the email login provider, not just public account creation.
- **Prevention:** Keep `[auth].enable_signup = false` to block public signup while setting `[auth.email].enable_signup = true` to allow administrator email login.
- **Next action:** After changing Auth configuration, stop/start only the affected local stack and run `npm run db:local:verify` against real local Auth.

### 2026-10-09 — Responsive admin selectors and post-login state

- **Symptom:** Browser checks timed out waiting for a booking name even though local authentication and booking retrieval worked.
- **Root cause:** Text selectors matched a hidden responsive copy; client-side navigation also exposed the initial loading state before booking controls were ready.
- **Prevention:** Select visible semantic controls rather than the first duplicated text label. For data-access smoke checks, sign in through the same Playwright context's request API, navigate to `/admin`, and wait for the actual booking control. Test the login form separately when its behavior is in scope.
- **Next action:** Use a booking button's accessible name and wait for loaded controls at every viewport; preserve the separate integrated-browser validation requirement.

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
