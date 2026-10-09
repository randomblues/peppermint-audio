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

The homepage leads with "Good sound. Less stress.", a real stage photograph, and direct paths to packages and individual gear. Its introductory strip highlights hire options, Abbotsford pickup, and the included setup walkthrough. It keeps the existing package/cart interactions and customer reviews, with a three-step hire overview from `homeHireSteps` in `lib/site-content.ts`. Booking requests still require availability review before confirmation.

The locally served homepage photo, `public/home-live-sound.jpg`, is [A Stage with Microphones and a Bar Stool by Caio](https://www.pexels.com/photo/a-stage-with-microphones-and-a-bar-stool-13061474/), used under the [Pexels License](https://www.pexels.com/license/). It is stock photography, not a photograph of Peppermint Audio's own inventory or an event serviced by the business.

The FAQ leads with five conversational questions about choosing a package, booking ahead, self-setup, specific requirements, and individual equipment hire. Multi-night pricing, pickup/delivery, and booking steps sit in a collapsed "A few practical bits" section. All answers and their contextual links live in `lib/site-content.ts`; FAQ structured data uses the same answers.

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

### Isolated parallel development sessions

Create one worktree per agent from the current committed `HEAD`:

```bash
node .github/hooks/dev-session.mjs create agent-a
node .github/hooks/dev-session.mjs create agent-b
```

The command prints each worktree path, reserved localhost port, URL, and exact
development-server command. Worktrees are created in a sibling
`<repository-name>-sessions` directory on `copilot/session-<name>` branches. Current isolation
tooling is bootstrapped into each worktree as uncommitted changes so it works
before these tools are committed. Other uncommitted source changes are **not**
copied; neither are `.env` files, dependencies, cookies, or customer data.
Existing session names and worktree paths are never overwritten. Port
reservations live in Git's common directory and do not expire or get stolen.
An unrelated process can still take a reserved port; the server then fails
rather than being silently reused by Playwright.

For a single-window workflow, run **Chat: Open Agents window** from the VS Code
Command Palette. Create a separate session for each printed worktree by selecting
**Folder** and that worktree's path; use folder isolation because these directories
are already separate worktrees. Do not create two peer chats in the same session:
peer chats share their session's workspace. Separate editor windows are another
option, not a requirement. An existing chat does not automatically change its
workspace. See [VS Code's Agents window documentation](https://code.visualstudio.com/docs/agents/run/agents-window).
Use a separate terminal for each worktree and its printed development command.
If dependencies are missing, install them in that worktree with `npm ci`;
do not share `node_modules`, `.next`, test reports, or a running server.
Configure only approved test credentials through your normal secure setup.
External Supabase, Stripe, Google Calendar and email resources are **not**
isolated by a worktree; avoid live side effects or use dedicated test resources.

Run `npm run test:e2e` in the worktree. Playwright reads the local
`.copilot-dev-session.json`, starts its own server on that session's port, and
uses fresh browser contexts with empty cookies/storage. Stop a manually started
session server before this command: isolated runs intentionally refuse to reuse
an existing server. Playwright output and build artifacts stay in that worktree.
Terminal-driven Playwright does not use the shared VS Code browser.

```bash
node .github/hooks/dev-session.mjs status agent-a
npm run test:e2e -- tests/e2e/session-isolation.spec.ts --project=chromium
```

For manual inspection, standalone Playwright contexts are independent, but
repository-mandated VS Code integrated-browser UI validation still applies.
Coordinate that shared browser through the lock below. Do not claim integrated
browser profiles are isolated; this tooling does not provide that capability.
When finished, review and commit/transfer desired changes deliberately before
using `git worktree remove <printed-worktree-path>` without `--force`.
Reservations remain until a human verifies the session/server has stopped and
cleans its exact records in Git's `copilot-dev-sessions` directory.

### Shared integrated-browser lock

Copilot SDK/CLI sessions use the project hooks in `.github/hooks/browser-lock.json`.
The first shared integrated-browser tool call acquires an
exclusive lock. The owning session can continue using those tools; other sessions
receive a denial and should continue file-only work or wait without polling.
The lock is released on `agentStop` (end of the agent's turn) or `sessionEnd`.
Normal tool approvals still apply. File operations, terminals, task runners,
and standalone Playwright/test commands are not locked. `runPlaywrightCode` is
locked because it operates through the shared integrated-browser tooling.

The lock is stored in Git's common directory, so worktrees of this repository
share it without adding working-tree files. It does not expire automatically:
stealing a timed-out lock could interrupt an active browser check or server.
It does not stop a running server, prevent edits from triggering hot reloads,
isolate browser storage, or distinguish subagents sharing one runtime session ID.
Do not perform parallel browser/server work within the same session.
Agents must use their assigned worktrees/ports, not a shared source directory
or server. The hook does not enforce where terminal commands are run.

**Activation:** start fresh Copilot SDK/CLI sessions after adding these hooks.
Use the Hooks customization panel to confirm discovery for the selected harness.
Already-running sessions and other harnesses are not guaranteed to load this
configuration. This is cooperative tool enforcement, not a security sandbox:
disabled hooks, unrecognized tool aliases, manual actions, and hook timeouts can
bypass it. The SDK treats hook command timeouts as fail-open; the script uses only
short local operations and bounds its Git command to limit this risk.

**Two-session smoke check:** in session A, use the integrated browser and inspect
lock status before ending the turn. While A holds the lock, session B's
integrated-browser call must be denied, but terminals, standalone Playwright,
and file operations should work in B's isolated worktree. After A finishes its
turn, B's integrated-browser call should succeed. Do not treat installation
alone as proof of enforcement.

From a human-operated terminal at the repository root, inspect ownership with:

```bash
node .github/hooks/browser-lock.mjs status
```

If a session crashed, first verify that its browser/server operations have stopped.
Then release only the owner shown by `status`:

```bash
node .github/hooks/browser-lock.mjs release OWNER_SESSION_ID
```

Do not release another active agent's lock. If metadata is malformed, stop and
inspect the reported lock file manually rather than automatically deleting it.

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
