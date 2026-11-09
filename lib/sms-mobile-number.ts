export function normalizeAustralianMobileNumber(value: string): string | null {
  const trimmed = value.trim();
  const digits = trimmed.startsWith("+")
    ? `+${trimmed.slice(1).replace(/\D/g, "")}`
    : trimmed.replace(/\D/g, "");

  if (/^04\d{8}$/.test(digits)) return `61${digits.slice(1)}`;
  if (/^\+614\d{8}$/.test(digits)) return digits.slice(1);
  if (/^614\d{8}$/.test(digits)) return digits;
  return null;
}
