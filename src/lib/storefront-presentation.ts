import type { Product } from "./products";

/**
 * Development preview products deliberately have no persisted id. Only a
 * persisted catalogue record with an image may be promoted to the homepage
 * hero, so placeholder artwork cannot masquerade as published product media.
 */
export function selectStorefrontHeroProduct(products: readonly Product[]): Product | null {
  return products.find((product) =>
    typeof product.id === "string" &&
    product.id.trim().length > 0 &&
    typeof product.image === "string" &&
    product.image.trim().length > 0
  ) ?? null;
}
