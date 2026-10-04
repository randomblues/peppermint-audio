import { describe, expect, it } from "vitest";

import { formatAudCents, parseAmountCents, paymentMethodForRental, rentalDays } from "./payment-flow";

describe("payment flow helpers", () => {
  it("calculates rental days from date-only values without timezone drift", () => {
    expect(rentalDays("2026-10-01", "2026-10-01")).toBe(1);
    expect(rentalDays("2026-10-01", "2026-10-08")).toBe(7);
    expect(rentalDays("2026-10-01", "2026-10-09")).toBe(8);
    expect(rentalDays("2026-10-09", "2026-10-01")).toBeNull();
  });

  it("routes seven-day-or-shorter hires to Stripe and longer hires to bank transfer", () => {
    expect(paymentMethodForRental("2026-10-01", "2026-10-08")).toBe("stripe_card_hold");
    expect(paymentMethodForRental("2026-10-01", "2026-10-09")).toBe("bank_transfer");
  });

  it("parses decimal dollar amounts into safe cents", () => {
    expect(parseAmountCents("100")).toBe(10000);
    expect(parseAmountCents("100.5")).toBe(10050);
    expect(parseAmountCents("100.55")).toBe(10055);
    expect(parseAmountCents("100.555")).toBeNull();
    expect(parseAmountCents("-1")).toBeNull();
  });

  it("formats Australian dollar amounts", () => {
    expect(formatAudCents(10000)).toBe("$100.00");
  });
});
