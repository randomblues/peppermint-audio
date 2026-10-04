export type IncomeTaxYear = "2025-26" | "2026-27";

const taxRates = {
  "2025-26": [
    { thresholdCents: 19000001, baseCents: 5163800, rate: 0.45, fromCents: 19000000 },
    { thresholdCents: 13500001, baseCents: 3128800, rate: 0.37, fromCents: 13500000 },
    { thresholdCents: 4500001, baseCents: 428800, rate: 0.3, fromCents: 4500000 },
    { thresholdCents: 1820001, baseCents: 0, rate: 0.16, fromCents: 1820000 },
  ],
  "2026-27": [
    { thresholdCents: 19000001, baseCents: 5137000, rate: 0.45, fromCents: 19000000 },
    { thresholdCents: 13500001, baseCents: 3102000, rate: 0.37, fromCents: 13500000 },
    { thresholdCents: 4500001, baseCents: 402000, rate: 0.3, fromCents: 4500000 },
    { thresholdCents: 1820001, baseCents: 0, rate: 0.15, fromCents: 1820000 },
  ],
} as const;

export function calculateResidentIncomeTax(taxableIncomeCents: number, year: IncomeTaxYear) {
  const income = Math.max(0, Math.round(taxableIncomeCents));
  const bracket = taxRates[year].find((rate) => income >= rate.thresholdCents);
  return bracket ? Math.round(bracket.baseCents + (income - bracket.fromCents) * bracket.rate) : 0;
}

export function calculateMedicareLevy(taxableIncomeCents: number) {
  return Math.round(Math.max(0, taxableIncomeCents) * 0.02);
}
