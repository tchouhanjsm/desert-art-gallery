import { cartLineKey, type CartLine } from "./cart";

export type CartPreviewItem = {
  slug: string;
  variantId: string | null;
  variantLabel: string | null;
  name: string;
  quantityRequested: number;
  availableQuantity: number;
  available: boolean;
  priceMinor: number | null;
  currency: string | null;
  image: string | null;
  imageAlt: string;
};

export type CartDisplayRow = {
  line: CartLine;
  item: CartPreviewItem | null;
};

/**
 * Keep every locally stored cart line visible while server pricing, inventory
 * and product details are loading or unavailable. The server preview remains
 * the authority for price, availability and media.
 */
export function getCartDisplayRows(
  lines: readonly CartLine[],
  preview: readonly CartPreviewItem[],
): CartDisplayRow[] {
  const previewByKey = new Map(
    preview.map((item) => [cartLineKey(item.slug, item.variantId ?? undefined), item]),
  );

  return lines.map((line) => ({
    line,
    item: previewByKey.get(cartLineKey(line.slug, line.variantId)) ?? null,
  }));
}

export function formatCartFallbackName(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
