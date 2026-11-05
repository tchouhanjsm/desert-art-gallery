import type { Product } from "@/lib/products";

export const ALL_SHOP_CATEGORY = "All pieces";
export const SHOP_SORTS = ["featured", "name", "price-low", "price-high"] as const;
export type ShopSort = (typeof SHOP_SORTS)[number];

export type ShopQueryState = {
  q: string;
  category: string;
  sort: ShopSort;
};

const MAX_QUERY_LENGTH = 100;

export function sanitizeShopQuery(value: unknown): string {
  if (typeof value !== "string") return "";

  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .slice(0, MAX_QUERY_LENGTH);
}

export function normalizeShopSearchText(value: string): string {
  return sanitizeShopQuery(value)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("en");
}

export function getShopCategories(products: readonly Product[]): string[] {
  const categories = new Set(
    products
      .map((product) => product.category.trim())
      .filter((category) => category.length > 0 && category !== ALL_SHOP_CATEGORY),
  );

  return [
    ALL_SHOP_CATEGORY,
    ...Array.from(categories).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })),
  ];
}

export type ShopCategorySummary = {
  category: string;
  count: number;
};

export function getShopCategorySummary(products: readonly Product[]): ShopCategorySummary[] {
  const counts = new Map<string, number>();

  for (const product of products) {
    const category = product.category.trim();
    if (!category || category === ALL_SHOP_CATEGORY) continue;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  return getShopCategories(products).map((category) => ({
    category,
    count: category === ALL_SHOP_CATEGORY ? products.length : (counts.get(category) ?? 0),
  }));
}

export function isShopSort(value: unknown): value is ShopSort {
  return typeof value === "string" && SHOP_SORTS.some((sort) => sort === value);
}

export function parseShopQuery(
  params: Pick<URLSearchParams, "get">,
  categories: readonly string[],
): ShopQueryState {
  const requestedCategory = params.get("category");
  const requestedSort = params.get("sort");

  return {
    q: sanitizeShopQuery(params.get("q")),
    category:
      requestedCategory && categories.includes(requestedCategory)
        ? requestedCategory
        : ALL_SHOP_CATEGORY,
    sort: isShopSort(requestedSort) ? requestedSort : "featured",
  };
}

export function serializeShopQuery(
  state: ShopQueryState,
  currentParams: URLSearchParams = new URLSearchParams(),
): string {
  const params = new URLSearchParams(currentParams.toString());

  params.delete("q");
  params.delete("category");
  params.delete("sort");

  const q = sanitizeShopQuery(state.q);
  if (q.length > 0) params.set("q", q);

  if (state.category && state.category !== ALL_SHOP_CATEGORY) {
    params.set("category", state.category);
  }

  if (state.sort !== "featured" && isShopSort(state.sort)) {
    params.set("sort", state.sort);
  }

  return params.toString();
}

function compareNames(a: Product, b: Product): number {
  return normalizeShopSearchText(a.name).localeCompare(
    normalizeShopSearchText(b.name),
    "en",
  );
}

function comparePrices(a: Product, b: Product, direction: 1 | -1): number {
  const aPrice = typeof a.priceMinor === "number" && Number.isFinite(a.priceMinor)
    ? a.priceMinor
    : null;
  const bPrice = typeof b.priceMinor === "number" && Number.isFinite(b.priceMinor)
    ? b.priceMinor
    : null;

  // Unpriced inquiry-only pieces stay after priced records in either direction.
  if (aPrice === null && bPrice === null) return compareNames(a, b);
  if (aPrice === null) return 1;
  if (bPrice === null) return -1;

  return (aPrice - bPrice) * direction || compareNames(a, b);
}

export function filterAndSortProducts(
  products: readonly Product[],
  state: ShopQueryState,
): Product[] {
  const query = normalizeShopSearchText(state.q);

  const filtered = products.filter((product) => {
    const matchesCategory =
      state.category === ALL_SHOP_CATEGORY || product.category === state.category;
    const searchableText = [product.name, product.category, product.note]
      .map(normalizeShopSearchText)
      .join(" ");

    return matchesCategory && (!query || searchableText.includes(query));
  });

  return [...filtered].sort((a, b) => {
    if (state.sort === "price-low") return comparePrices(a, b, 1);
    if (state.sort === "price-high") return comparePrices(a, b, -1);
    if (state.sort === "name") return compareNames(a, b);

    return Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || compareNames(a, b);
  });
}
