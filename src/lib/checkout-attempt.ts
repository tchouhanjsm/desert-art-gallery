import type { CartLine } from "@/lib/cart";
import { normalizeCheckoutAddress, type CheckoutAddress } from "@/lib/checkout";

export type CheckoutAttemptInput = {
  lines: readonly CartLine[];
  address: CheckoutAddress;
  shippingRateId: string;
  customerNote: string;
};

export type CheckoutAttemptKeys = {
  fingerprint: string;
  reservationFingerprint: string;
  reservationKey: string;
  orderDraftKey: string;
};

function normalizeLines(lines: readonly CartLine[]) {
  return lines
    .map((line) => ({ slug: line.slug, variantId: line.variantId ?? null, quantity: line.quantity }))
    .sort((left, right) => {
      const leftKey = left.slug + "\u0000" + (left.variantId ?? "");
      const rightKey = right.slug + "\u0000" + (right.variantId ?? "");
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });
}

/** The reservation endpoint receives only cart lines. */
export function buildReservationFingerprint(lines: readonly CartLine[]): string {
  return JSON.stringify(normalizeLines(lines));
}

/** The order-draft fingerprint covers every value which determines the draft. */
export function buildCheckoutAttemptFingerprint(input: CheckoutAttemptInput): string {
  return JSON.stringify({
    lines: normalizeLines(input.lines),
    address: normalizeCheckoutAddress(input.address) ?? input.address,
    shippingRateId: input.shippingRateId,
    customerNote: input.customerNote.trim(),
  });
}

/**
 * Reuse a reservation key while cart lines are unchanged. Order-draft replay
 * remains tied to the full request so a changed address, rate or note can
 * create a new draft against the same stock hold.
 */
export function getCheckoutAttemptKeys(
  fingerprint: string,
  reservationFingerprint: string,
  current: CheckoutAttemptKeys | null,
  createKey: () => string,
): CheckoutAttemptKeys {
  if (current?.fingerprint === fingerprint) return current;

  const reservationKey = current?.reservationFingerprint === reservationFingerprint
    ? current.reservationKey
    : createKey();
  const orderDraftKey = createKey();
  if (!reservationKey || !orderDraftKey || reservationKey === orderDraftKey) {
    throw new Error("Checkout attempt keys must be distinct non-empty values.");
  }
  return { fingerprint, reservationFingerprint, reservationKey, orderDraftKey };
}
