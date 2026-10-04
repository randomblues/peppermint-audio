# General improvements

This is the ongoing project log for improvements that are not specific to the Stripe payment integration. Add new work as dated entries so product, UX, operational, and engineering changes remain easy to discover.

## 2026-10-05 — Shared product experience redesign

### Admin console and public website

Established a shared modern design system across both the internal admin console and the customer-facing website.

Admin console improvements:

- Added dark atmospheric backgrounds.
- Added glass-style cards and panels.
- Added accent borders and focus states.
- Improved navigation and active-section styling.
- Redesigned booking detail views.
- Improved the archive section.
- Fixed booking status dropdown styling.
- Improved responsive behavior for desktop and mobile.

Public website improvements:

- Updated the public-site shell styling.
- Refined the navbar and shared navigation.
- Added atmospheric backgrounds and glass surfaces.
- Improved section headings and accent treatments.
- Restyled cards, package selectors, and catalogue surfaces.
- Updated the homepage hero styling.
- Softened the homepage gradient after visual review.
- Simplified the “Why Peppermint Audio?” section.
- Removed excessive decorative borders and circles.
- Improved responsive layouts across the homepage, catalogue, cart, and booking flow.

Relevant files:

- [`components/admin-console.tsx`](../components/admin-console.tsx)
- [`app/page.tsx`](../app/page.tsx)
- [`app/globals.css`](../app/globals.css)
- [`components/navbar.tsx`](../components/navbar.tsx)
- [`components/section.tsx`](../components/section.tsx)

### Cart experience

- Moved the booking-request section into a full-width block.
- Moved the estimated total into the selected-hire card.
- Added animated **Clear cart** behavior.
- Added animated individual-item removal.
- Added trash icons and temporary action states.
- Prevented duplicate removal actions during animations.
- Added matching **Browse packages** and **Browse equipment** actions to the empty-cart state.
- Improved responsive layouts at desktop, tablet, and phone widths.

Relevant files:

- [`components/cart-view.tsx`](../components/cart-view.tsx)
- [`components/cart-view.test.tsx`](../components/cart-view.test.tsx)

### Booking and catalogue experience

- Refined the booking-request form layout and styling.
- Improved date and time controls.
- Improved validation and error states.
- Improved hire-selection summaries.
- Refined package cards and equipment cards.
- Improved equipment detail actions.
- Improved add-to-cart interactions.
- Improved package and equipment navigation.
- Added stronger responsive behavior across catalogue and booking pages.

Relevant files:

- [`components/booking-form.tsx`](../components/booking-form.tsx)
- [`components/date-picker.tsx`](../components/date-picker.tsx)
- [`components/time-picker.tsx`](../components/time-picker.tsx)
- [`components/package-card.tsx`](../components/package-card.tsx)
- [`components/equipment-card.tsx`](../components/equipment-card.tsx)
- [`components/equipment-detail.tsx`](../components/equipment-detail.tsx)

### Navigation and availability controls

- Added and refined the Products dropdown.
- Added Packages and Individual equipment navigation.
- Fixed the Products menu remaining open after selecting an item.
- Added responsive mobile navigation.
- Refined the persistent availability/contact control.
- Replaced the intrusive full-width bottom banner with a compact floating glass control.
- Preserved accessible labels and the expanded contact sheet.

Relevant files:

- [`components/navbar.tsx`](../components/navbar.tsx)
- [`components/mobile-contact-bar.tsx`](../components/mobile-contact-bar.tsx)

### Email and operational communication

Improved customer and internal communication outside the payment-specific workflow:

- Refined booking-request emails.
- Refined booking-confirmation emails.
- Improved pickup reminder emails.
- Added custom admin email support.
- Added email-history visibility in the admin booking view.
- Kept customer-facing wording separate from internal implementation details.
- Escaped customer-provided values in HTML email output.

Relevant files:

- [`lib/booking-confirmation-email.ts`](../lib/booking-confirmation-email.ts)
- [`lib/send-booking-confirmation.ts`](../lib/send-booking-confirmation.ts)
- [`lib/pickup-reminders.ts`](../lib/pickup-reminders.ts)
- [`lib/email-log.ts`](../lib/email-log.ts)

### Authentication and privacy

- Added server-side admin authentication cookie handling.
- Improved protected admin route behavior.
- Kept admin-only controls and private data server-side.
- Preserved private photo-ID storage and short-lived signed-link access.
- Added authentication-focused tests.

Relevant files:

- [`lib/auth-cookies.ts`](../lib/auth-cookies.ts)
- [`proxy.ts`](../proxy.ts)
- [`lib/supabase.ts`](../lib/supabase.ts)

### Testing and quality

- Expanded unit coverage for booking forms, cart interactions, admin behavior, date pickers, equipment details, shared site components, emails, and authentication.
- Added browser end-to-end coverage for layout and booking-flow behavior.
- Browser-checked the public experience at desktop, tablet, and phone widths.
- Checked for horizontal overflow and responsive layout issues.
- Kept focused tests and linting part of the implementation workflow.

Relevant test areas:

- [`components/`](../components/)
- [`app/`](../app/)
- [`lib/`](../lib/)
- [`tests/e2e/`](../tests/e2e/)

## How to add future entries

Add a new dated heading near the top of this file:

```md
## YYYY-MM-DD — Short improvement title

### Area

- What changed
- Why it changed
- Any important behavior or operational notes

Relevant files:

- [`path/to/file.ts`](../path/to/file.ts)
```

Keep payment-specific architecture in [`STRIPE-INTEGRATION.md`](./STRIPE-INTEGRATION.md) rather than duplicating it here.
