export type CheckoutTaxRule = {
  name: string;
  rateBasisPoints: number;
  taxableShipping: boolean;
};

export type CheckoutTaxSnapshot = {
  name: string;
  rate_basis_points: number;
  amount_minor: number;
};

const MAX_SAFE_MINOR = BigInt(Number.MAX_SAFE_INTEGER);

export function toSafeOrderMinor(value: bigint, label: string): number {
  if (value < BigInt(0) || value > MAX_SAFE_MINOR) {
    throw new Error("The " + label + " exceeds the supported amount.");
  }
  return Number(value);
}

export function calculateCheckoutTax(
  subtotalMinor: bigint,
  shippingMinor: bigint,
  rules: readonly CheckoutTaxRule[],
): { taxMinor: bigint; breakdown: CheckoutTaxSnapshot[] } {
  if (subtotalMinor < BigInt(0) || shippingMinor < BigInt(0)) throw new Error("Order amounts cannot be negative.");
  if (rules.length === 0) throw new Error("At least one destination tax rule is required.");
  const breakdown = rules.map((rule) => {
    if (!rule.name.trim() || !Number.isInteger(rule.rateBasisPoints)
      || rule.rateBasisPoints < 0 || rule.rateBasisPoints > 10000) {
      throw new Error("A destination tax rule is invalid.");
    }
    const taxableBase = subtotalMinor + (rule.taxableShipping ? shippingMinor : BigInt(0));
    const amount = (taxableBase * BigInt(rule.rateBasisPoints) + BigInt(5000)) / BigInt(10000);
    return {
      name: rule.name,
      rate_basis_points: rule.rateBasisPoints,
      amount_minor: toSafeOrderMinor(amount, "tax amount"),
    };
  });
  const taxMinor = breakdown.reduce((sum, row) => sum + BigInt(row.amount_minor), BigInt(0));
  toSafeOrderMinor(taxMinor, "tax total");
  return { taxMinor, breakdown };
}

export function calculateCheckoutTotal(input: {
  subtotalMinor: bigint;
  shippingMinor: bigint;
  taxMinor: bigint;
  discountMinor?: bigint;
}): number {
  const discount = input.discountMinor ?? BigInt(0);
  return toSafeOrderMinor(
    input.subtotalMinor + input.shippingMinor + input.taxMinor - discount,
    "order total",
  );
}

export function getOrderDraftExpiry(reservationExpiresAt: Date, now: Date, maximumLifetimeMs: number): Date {
  if (!Number.isFinite(reservationExpiresAt.getTime()) || !Number.isFinite(now.getTime())
    || !Number.isSafeInteger(maximumLifetimeMs) || maximumLifetimeMs < 1) {
    throw new Error("A valid reservation expiry and draft lifetime are required.");
  }
  const expiresAt = new Date(Math.min(reservationExpiresAt.getTime(), now.getTime() + maximumLifetimeMs));
  if (expiresAt <= now) throw new Error("The inventory reservation has expired.");
  return expiresAt;
}
