const GST_RATE_PERCENT = 10;

export function gstIncludedCents(taxableAmountCents: number) {
  return Math.round(taxableAmountCents / (100 + GST_RATE_PERCENT) * GST_RATE_PERCENT);
}
