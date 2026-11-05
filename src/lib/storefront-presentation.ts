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

/** Only persisted collections with a real image path and descriptive alt text use photo tiles. */
export function isPublishedCollectionImage(collection: {
  id?: string;
  image?: string | null;
  imageAlt?: string | null;
}): boolean {
  return typeof collection.id === "string" && collection.id.trim().length > 0
    && typeof collection.image === "string" && collection.image.trim().length > 0
    && typeof collection.imageAlt === "string" && collection.imageAlt.trim().length > 0;
}

/** Only merchant-supplied product facts are surfaced on the product card. */
export function getProductCardFacts(product: Product): string[] {
  const facts: string[] = [];
  if (product.isOneOfAKind === true) facts.push("One of a kind");
  if (product.materials?.length) facts.push(product.materials.slice(0, 2).join(" · "));
  if (product.sizes?.length) facts.push(product.sizes.slice(0, 2).join(" · "));
  return facts;
}

/** A card is purchase-ready only when a published product/variant is priced and in stock. */
export function hasPurchasableProductOption(product: Product): boolean {
  if (!isPublishedProductRecord(product)) return false;
  if (product.variants?.length) {
    return product.variants.some((variant) =>
      variant.status === "active" && typeof variant.priceMinor === "number" && variant.quantityOnHand > 0
    );
  }
  return typeof product.priceMinor === "number" && Boolean(product.currency) && (product.quantityOnHand ?? 0) > 0;
}
