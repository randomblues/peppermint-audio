import { describe, expect, it } from "vitest";

import { formatBankTransferInstructions } from "./bank-transfer";

describe("formatBankTransferInstructions", () => {
  it("includes PayID and standard bank details when both are configured", () => {
    expect(formatBankTransferInstructions("$200.00", "PA-ABC123", {
      accountName: "Peppermint Audio",
      bsb: "123-456",
      accountNumber: "12345678",
      payId: "0452 316 823",
    }, "both")).toBe("Please transfer $200.00 using reference PA-ABC123 via PayID 0452 316 823 or bank account Peppermint Audio, BSB 123-456, account 12345678.");
  });

  it("supports PayID-only instructions", () => {
    expect(formatBankTransferInstructions("$100.00", "PA-ABC123", {
      accountName: "Peppermint Audio",
      payId: "payments@example.com",
    }, "payid")).toContain("PayID payments@example.com");
  });

  it("rejects an account with no usable payment details", () => {
    expect(() => formatBankTransferInstructions("$100.00", "PA-ABC123", { accountName: "Peppermint Audio" }, "bank_account")).toThrow("BSB");
  });
});
