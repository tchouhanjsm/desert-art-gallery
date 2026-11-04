export function amountInMajorUnits(amountMinor: number, currency: string): number {
  try {
    const fractionDigits = new Intl.NumberFormat("en", { style: "currency", currency })
      .resolvedOptions().maximumFractionDigits ?? 2;
    return amountMinor / (10 ** fractionDigits);
  } catch {
    // A malformed ISO currency is blocked before publication; retain a safe display fallback.
    return amountMinor / 100;
  }
}

export function formatMoneyFromMinor(amountMinor: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency })
      .format(amountInMajorUnits(amountMinor, currency));
  } catch {
    return `${currency.toUpperCase()} ${(amountMinor / 100).toFixed(2)}`;
  }
}
