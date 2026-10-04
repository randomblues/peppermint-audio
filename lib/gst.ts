export const GST_RATE_PERCENT = 10;
export const GST_HIRE_ONLY_NOTE = "GST is calculated on the hire cost only. The refundable security deposit is not included in the GST calculation.";

export function gstIncludedCents(taxableAmountCents: number) {
  return Math.round(taxableAmountCents / (100 + GST_RATE_PERCENT) * GST_RATE_PERCENT);
}
