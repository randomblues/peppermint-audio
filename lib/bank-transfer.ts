export type BankTransferDetails = {
  accountName: string;
  bsb?: string;
  accountNumber?: string;
  payId?: string;
};

export type BankTransferOption = "payid" | "bank_account" | "both";

export function isBankTransferOption(value: unknown): value is BankTransferOption {
  return value === "payid" || value === "bank_account" || value === "both";
}

export function formatBankTransferInstructions(amount: string, reference: string, details: BankTransferDetails, option: BankTransferOption) {
  const hasPayId = Boolean(details.payId);
  const hasBankAccount = Boolean(details.bsb && details.accountNumber);
  if (option === "payid" && !hasPayId) throw new Error("PayID is not configured.");
  if (option === "bank_account" && !hasBankAccount) throw new Error("BSB and account number are not configured.");
  if (option === "both" && (!hasPayId || !hasBankAccount)) throw new Error("Both PayID and BSB/account details must be configured.");
  const methods = [
    option !== "bank_account" ? `PayID ${details.payId}` : "",
    option !== "payid" ? `bank account ${details.accountName}, BSB ${details.bsb}, account ${details.accountNumber}` : "",
  ].filter(Boolean);
  return `Please transfer ${amount} using reference ${reference} via ${methods.join(" or ")}.`;
}
