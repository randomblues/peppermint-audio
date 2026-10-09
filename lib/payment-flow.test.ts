import { describe, expect, it } from "vitest";

import { canSwitchPendingBankTransfer, depositHoldCoversReturn, depositHoldDate, paymentLinkExpiry, formatAudCents, parseAmountCents, paymentMethodForRental, rentalDays } from "./payment-flow";

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

  it("routes up to three nights to Stripe and four or more to bank transfer", () => {
    expect(paymentMethodForRental("2026-10-01", "2026-10-04")).toBe("stripe_card_hold");
    expect(paymentMethodForRental("2026-10-01", "2026-10-05")).toBe("bank_transfer");
    expect(paymentMethodForRental("2026-10-01", "2026-10-08")).toBe("bank_transfer");
  });

  it("schedules the calendar day before pickup across month/year boundaries", () => {
    expect(depositHoldDate("2027-01-01")).toBe("2026-12-31");
    expect(depositHoldDate("2026-03-01")).toBe("2026-02-28");
    expect(() => depositHoldDate("2026-02-30")).toThrow();
  });

  it("keeps advance-booking links valid through deposit authentication", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    expect(paymentLinkExpiry("2026-04-03", now)).toBe("2026-04-06T00:00:00.000Z");
    expect(paymentLinkExpiry("2026-01-02", now)).toBe("2026-01-31T00:00:00.000Z");
  });

  it("checks the exact hold expiry against return and a check-in margin", () => {
    const boundary = Date.parse("2026-10-12T19:00:00+10:00") / 1000;
    expect(depositHoldCoversReturn(boundary, "2026-10-12", "18:00")).toBe(false);
    expect(depositHoldCoversReturn(boundary + 1, "2026-10-12", "18:00")).toBe(true);
    expect(depositHoldCoversReturn(null, "2026-10-12")).toBe(false);
    expect(depositHoldCoversReturn(boundary, "2026-02-30")).toBe(false);
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
