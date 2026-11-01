export function formatMoneyFromMinor(amountMinor: number, currency: string) {
  try {
    const formatter = new Intl.NumberFormat("en", { style: "currency", currency });
    const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    return formatter.format(amountMinor / (10 ** fractionDigits));
  } catch {
    // A malformed ISO currency must not crash the product page; admin validation blocks publication.
    return `${currency.toUpperCase()} ${(amountMinor / 100).toFixed(2)}`;
  }
}
