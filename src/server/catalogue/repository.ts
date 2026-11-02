import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import type { Product, ProductImage, ProductVariant } from "../../lib/products";
import { getMySqlDb } from "../db";
import {
  collectionProductLinks, collections, inventoryReservationItems, inventoryReservations,
  productCategories, productCategoryLinks, productMedia, products, productVariants,
} from "../db/schema";
import { getProductMediaUrl, safeProductStorageKey } from "../media/product-storage";

export type PublishedProductQuery = {
  search?: string;
  categorySlug?: string;
  limit?: number;
  offset?: number;
  sort?: "featured" | "newest" | "price-low" | "price-high" | "title";
};

function safeNumber(value: number | string | bigint | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function safeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function toProductImage(row: typeof productMedia.$inferSelect, productTitle: string): ProductImage {
  return {
    id: row.id,
    url: getProductMediaUrl(row.storageKey),
    altText: row.altText.trim() || productTitle,
    sortOrder: row.position,
    isPrimary: row.isPrimary,
  };
}

function toProduct(
  row: typeof products.$inferSelect,
  categories: Array<{ name: string; slug: string }>,
  media: Array<typeof productMedia.$inferSelect>,
  variants: Array<typeof productVariants.$inferSelect>,
  collectionSlugs: string[],
): Product | null {
  const images = media.map((item) => toProductImage(item, row.title));
  if (!images.length) return null;
  const mappedVariants: ProductVariant[] = variants
    .filter((variant) => variant.isActive)
    .map((variant) => ({
      id: variant.id,
      label: variant.label,
      sku: variant.sku,
      attributes: safeRecord(variant.attributes),
      priceMinor: safeNumber(variant.priceMinor),
      quantityOnHand: safeNumber(variant.stockQuantity) ?? 0,
      status: "active",
    }));
  const quantityOnHand = mappedVariants.reduce((sum, variant) => sum + variant.quantityOnHand, 0);
  return {
    id: row.id,
    slug: row.slug,
    name: row.title,
    category: categories[0]?.name ?? "",
    image: images[0].url,
    imageAlt: images[0].altText,
    note: row.shortDescription.trim(),
    availability: "inquiry",
    priceMinor: safeNumber(row.priceMinor),
    currency: row.currency,
    quantityOnHand,
    isOneOfAKind: row.isOneOfAKind,
    collectionSlugs,
    featured: row.featured,
    description: row.description?.trim() ?? "",
    materials: safeStringArray(row.materials),
    sizes: safeStringArray(row.sizes),
    measurements: safeRecord(row.measurements),
    conditionNotes: row.conditionNotes?.trim() ?? "",
    provenance: row.provenance?.trim() ?? "",
    craftStory: row.craftStory?.trim() ?? "",
    images,
    variants: mappedVariants,
    seoTitle: row.seoTitle || null,
    seoDescription: row.seoDescription || null,
  };
}

async function hydrateProducts(rows: Array<typeof products.$inferSelect>): Promise<Product[]> {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const slugs = rows.map((row) => row.slug);
  const db = getMySqlDb();
  const [categoryRows, mediaRows, variantRows, collectionRows] = await Promise.all([
    db.select({
      productId: productCategoryLinks.productId,
      name: productCategories.name,
      slug: productCategories.slug,
      sortOrder: productCategories.sortOrder,
    }).from(productCategoryLinks)
      .innerJoin(productCategories, eq(productCategories.id, productCategoryLinks.categoryId))
      .where(and(inArray(productCategoryLinks.productId, ids), eq(productCategories.isActive, true)))
      .orderBy(asc(productCategories.sortOrder), asc(productCategories.name)),
    db.select().from(productMedia)
      .where(and(
        inArray(productMedia.productId, ids),
        eq(productMedia.rightsConfirmed, true),
        sql`CHAR_LENGTH(TRIM(${productMedia.altText})) > 0`,
        sql`CHAR_LENGTH(TRIM(${productMedia.rightsEvidence})) > 0`,
      ))
      .orderBy(asc(productMedia.position), asc(productMedia.createdAt)),
    db.select().from(productVariants)
      .where(and(inArray(productVariants.productId, ids), eq(productVariants.isActive, true)))
      .orderBy(asc(productVariants.sortOrder), asc(productVariants.label)),
    db.select({
      productSlug: collectionProductLinks.productSlug,
      collectionSlug: collections.slug,
    }).from(collectionProductLinks)
      .innerJoin(collections, eq(collections.id, collectionProductLinks.collectionId))
      .where(and(inArray(collectionProductLinks.productSlug, slugs), eq(collections.isPublished, true)))
      .orderBy(asc(collections.sortOrder), asc(collections.slug)),
  ]);
  const categoryMap = new Map<string, Array<{ name: string; slug: string }>>();
  for (const row of categoryRows) {
    const values = categoryMap.get(row.productId) ?? [];
    values.push({ name: row.name, slug: row.slug });
    categoryMap.set(row.productId, values);
  }
  const mediaMap = new Map<string, typeof mediaRows>();
  for (const row of mediaRows) {
    try { safeProductStorageKey(row.storageKey); } catch { continue; }
    const values = mediaMap.get(row.productId) ?? [];
    values.push(row);
    mediaMap.set(row.productId, values);
  }
  const variantMap = new Map<string, typeof variantRows>();
  for (const row of variantRows) {
    const values = variantMap.get(row.productId) ?? [];
    values.push(row);
    variantMap.set(row.productId, values);
  }
  const collectionMap = new Map<string, string[]>();
  for (const row of collectionRows) {
    const values = collectionMap.get(row.productSlug) ?? [];
    values.push(row.collectionSlug);
    collectionMap.set(row.productSlug, values);
  }
  return rows.flatMap((row) => {
    const item = toProduct(
      row,
      categoryMap.get(row.id) ?? [],
      mediaMap.get(row.id) ?? [],
      variantMap.get(row.id) ?? [],
      collectionMap.get(row.slug) ?? [],
    );
    return item ? [item] : [];
  });
}

export async function listPublishedProducts(input: PublishedProductQuery = {}): Promise<Product[]> {
  const db = getMySqlDb();
  const limit = Math.min(100, Math.max(1, Math.floor(input.limit ?? 100)));
  const offset = Math.max(0, Math.floor(input.offset ?? 0));
  const conditions = [eq(products.status, "published")];
  const search = input.search?.trim().slice(0, 120);
  if (search) {
    const pattern = "%" + search.replace(/[\\%_]/g, "\\$&") + "%";
    conditions.push(or(
      like(products.title, pattern),
      like(products.shortDescription, pattern),
      like(products.description, pattern),
    )!);
  }
  if (input.categorySlug) {
    const [category] = await db.select({ id: productCategories.id }).from(productCategories)
      .where(and(eq(productCategories.slug, input.categorySlug), eq(productCategories.isActive, true))).limit(1);
    if (!category) return [];
    const links = await db.select({ productId: productCategoryLinks.productId }).from(productCategoryLinks)
      .where(eq(productCategoryLinks.categoryId, category.id));
    const ids = links.map((row) => row.productId);
    if (!ids.length) return [];
    conditions.push(inArray(products.id, ids));
  }
  const sort = input.sort ?? "featured";
  const rows = await db.select().from(products).where(and(...conditions))
    .orderBy(
      ...(sort === "newest" ? [desc(products.publishedAt), desc(products.createdAt)]
        : sort === "price-low" ? [asc(products.priceMinor), asc(products.title)]
          : sort === "price-high" ? [desc(products.priceMinor), asc(products.title)]
            : sort === "title" ? [asc(products.title)]
              : [desc(products.featured), desc(products.publishedAt), asc(products.title)]),
    )
    .limit(limit)
    .offset(offset);
  return hydrateProducts(rows);
}

export async function getPublishedProductBySlug(slug: string): Promise<Product | null> {
  const [row] = await getMySqlDb().select().from(products)
    .where(and(eq(products.slug, slug), eq(products.status, "published"))).limit(1);
  if (!row) return null;
  const [product] = await hydrateProducts([row]);
  return product ?? null;
}

export async function isPublicProductMedia(key: string): Promise<boolean> {
  let safeKey: string;
  try { safeKey = safeProductStorageKey(key); } catch { return false; }
  const [row] = await getMySqlDb().select({ id: productMedia.id })
    .from(productMedia)
    .innerJoin(products, eq(products.id, productMedia.productId))
    .where(and(
      eq(productMedia.storageKey, safeKey),
      eq(productMedia.rightsConfirmed, true),
      eq(products.status, "published"),
      sql`CHAR_LENGTH(TRIM(${productMedia.altText})) > 0`,
      sql`CHAR_LENGTH(TRIM(${productMedia.rightsEvidence})) > 0`,
    ))
    .limit(1);
  return Boolean(row);
}

export async function getAvailableVariantQuantity(variantId: string): Promise<number> {
  const db = getMySqlDb();
  const [variant] = await db.select({ stock: productVariants.stockQuantity })
    .from(productVariants).where(and(eq(productVariants.id, variantId), eq(productVariants.isActive, true))).limit(1);
  if (!variant) return 0;
  const reservedRows = await db.select({ quantity: inventoryReservationItems.quantity })
    .from(inventoryReservationItems)
    .innerJoin(inventoryReservations, eq(inventoryReservations.id, inventoryReservationItems.reservationId))
    .where(and(
      eq(inventoryReservationItems.variantId, variantId),
      eq(inventoryReservations.status, "reserved"),
      sql`${inventoryReservations.expiresAt} > CURRENT_TIMESTAMP(3)`,
    ));
  const reserved = reservedRows.reduce((total, row) => total + row.quantity, 0);
  return Math.max(0, variant.stock - reserved);
}
