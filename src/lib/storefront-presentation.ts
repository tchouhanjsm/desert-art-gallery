import type { Product } from "./products";

/**
 * Development preview products deliberately have no persisted id. Only a
 * persisted catalogue record with an image may be promoted to the homepage
 * hero, so placeholder artwork cannot masquerade as published product media.
 */
export function isPublishedProductRecord(product: Product): boolean {
  return typeof product.id === "string" && product.id.trim().length > 0;
}

export function selectStorefrontHeroProduct(products: readonly Product[]): Product | null {
  return products.find((product) =>
    isPublishedProductRecord(product) &&
    typeof product.image === "string" &&
    product.image.trim().length > 0
  ) ?? null;
}

/** A collection photo is rendered only when the data projection explicitly confirms its rights. */
export function isPublishedCollectionImage(collection: {
  id?: string;
  image?: string | null;
  imageAlt?: string | null;
  imageApproved?: boolean;
}): boolean {
  if (collection.imageApproved !== true) return false;
  if (typeof collection.id !== "string" || collection.id.trim().length === 0) return false;
  if (typeof collection.image !== "string" || collection.image.trim().length === 0) return false;
  const imagePath = collection.image.trim().split(/[?#]/, 1)[0];
  if (imagePath === "/images/textile-placeholder.svg") return false;
  if (typeof collection.imageAlt !== "string") return false;
  const alt = collection.imageAlt.trim();
  if (!alt || /^(?:image|photo|photograph|picture|collection image|placeholder|untitled)(?:\s+\d+)?$/i.test(alt)) return false;
  return true;
}

/** Only merchant-supplied product facts are surfaced on the product card. */
export function getProductCardFacts(product: Product): string[] {
  const facts: string[] = [];
  if (product.isOneOfAKind === true) facts.push("One of a kind");
  if (product.materials?.length) facts.push(product.materials.slice(0, 2).join(" · "));
  if (product.sizes?.length) facts.push(product.sizes.slice(0, 2).join(" · "));
  return facts;
}

/**
 * The PDP add-to-bag control requires a persisted, priced product and currency.
 * Variant-level prices may fall back to the product price, so stock—not a
 * duplicated variant price—is the final per-option check.
 */
export function hasPurchasableProductOption(product: Product): boolean {
  if (!isPublishedProductRecord(product)) return false;
  if (typeof product.priceMinor !== "number" || !Number.isSafeInteger(product.priceMinor) || product.priceMinor < 0) return false;
  if (typeof product.currency !== "string" || product.currency.trim().length === 0) return false;
  if (product.variants?.length) {
    return product.variants.some((variant) =>
      variant.status === "active" && variant.quantityOnHand > 0
    );
  }
  return (product.quantityOnHand ?? 0) > 0;
}
