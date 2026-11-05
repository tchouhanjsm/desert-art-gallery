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
  reservationKey: string;
  orderDraftKey: string;
};

function normalizeLines(lines: readonly CartLine[]) {
  return lines
    .map((line) => ({
      slug: line.slug,
      variantId: line.variantId ?? null,
      quantity: line.quantity,
    }))
    .sort((left, right) => {
      const leftKey = left.slug + "\u0000" + (left.variantId ?? "");
      const rightKey = right.slug + "\u0000" + (right.variantId ?? "");
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });
}

/**
 * The fingerprint represents the exact order-draft request after the same
 * address/note normalization performed by the API. Reordered cart lines and
 * whitespace-only address edits therefore replay the same checkout attempt.
 */
export function buildCheckoutAttemptFingerprint(input: CheckoutAttemptInput): string {
  return JSON.stringify({
    lines: normalizeLines(input.lines),
    address: normalizeCheckoutAddress(input.address) ?? input.address,
    shippingRateId: input.shippingRateId,
    customerNote: input.customerNote.trim(),
  });
}

/**
 * Retain both idempotency keys until the checkout payload changes. A retry
 * after an ambiguous network response must replay both the stock reservation
 * and order-draft request instead of generating a fresh order key.
 */
export function getCheckoutAttemptKeys(
  fingerprint: string,
  current: CheckoutAttemptKeys | null,
  createKey: () => string,
): CheckoutAttemptKeys {
  if (current?.fingerprint === fingerprint) return current;

  const reservationKey = createKey();
  const orderDraftKey = createKey();
  if (!reservationKey || !orderDraftKey || reservationKey === orderDraftKey) {
    throw new Error("Checkout attempt keys must be distinct non-empty values.");
  }

  return { fingerprint, reservationKey, orderDraftKey };
}
