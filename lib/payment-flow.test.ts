import { describe, expect, it } from "vitest";

import { canSwitchPendingBankTransfer, formatAudCents, parseAmountCents, paymentMethodForRental, rentalDays } from "./payment-flow";

describe("payment flow helpers", () => {
  it("calculates rental days from date-only values without timezone drift", () => {
    expect(rentalDays("2026-10-01", "2026-10-01")).toBe(1);
    expect(rentalDays("2026-10-01", "2026-10-08")).toBe(7);
    expect(rentalDays("2026-10-01", "2026-10-09")).toBe(8);
    expect(rentalDays("2026-10-09", "2026-10-01")).toBeNull();
    expect(rentalDays("2026-02-30", "2026-03-02")).toBeNull();
    expect(rentalDays("2026-13-01", "2027-01-02")).toBeNull();
    expect(rentalDays("2026-1-01", "2026-01-02")).toBeNull();
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

  it("allows switching a pending bank transfer to Stripe only before payment activity", () => {
    expect(canSwitchPendingBankTransfer("bank_transfer", "bank_transfer_pending", "bank_transfer_pending")).toBe(true);
    expect(canSwitchPendingBankTransfer("bank_transfer", "bank_transfer_received", "bank_transfer_received")).toBe(false);
    expect(canSwitchPendingBankTransfer("bank_transfer", "bank_transfer_pending", "bank_transfer_refunded")).toBe(false);
    expect(canSwitchPendingBankTransfer("stripe_card_hold", "bank_transfer_pending", "bank_transfer_pending")).toBe(false);
  });

});
