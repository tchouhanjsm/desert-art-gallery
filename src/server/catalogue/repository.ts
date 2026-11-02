import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { getMySqlDb } from "@/server/db";
import { categories, collections, productCollectionLinks, productImages, products, productVariants } from "@/server/db/schema";
import { getMediaUrl } from "@/server/media/storage";
import type { Product, ProductImage, ProductVariant } from "@/lib/products";

type ProductRow = typeof products.$inferSelect;
type ImageRow = typeof productImages.$inferSelect;
type VariantRow = typeof productVariants.$inferSelect;

function safeMinor(value: number | null): number | null {
  return value !== null && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean) : [];
}
function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function imageModel(row: ImageRow, fallbackTitle: string): ProductImage {
  return { id: row.id, url: getMediaUrl(row.storagePath), altText: row.altText.trim() || fallbackTitle, sortOrder: row.sortOrder, isPrimary: row.isPrimary };
}
function variantModel(row: VariantRow): ProductVariant {
  return { id: row.id, label: row.label, sku: row.sku, attributes: recordValue(row.attributes), priceMinor: safeMinor(row.priceOverrideMinor), quantityOnHand: row.quantityOnHand, status: row.status as ProductVariant["status"] };
}
async function relatedProductData(productIds: string[]) {
  if (!productIds.length) return { images: new Map<string, ImageRow[]>(), variants: new Map<string, VariantRow[]>(), collections: new Map<string, string[]>() };
  const db = getMySqlDb();
  const [imageRows, variantRows, collectionRows] = await Promise.all([
    db.select().from(productImages).where(inArray(productImages.productId, productIds)).orderBy(asc(productImages.sortOrder), desc(productImages.isPrimary)),
    db.select().from(productVariants).where(inArray(productVariants.productId, productIds)).orderBy(asc(productVariants.sortOrder), asc(productVariants.label)),
    db.select({ productId: productCollectionLinks.productId, slug: collections.slug })
      .from(productCollectionLinks).innerJoin(collections, eq(collections.id, productCollectionLinks.collectionId))
      .where(and(inArray(productCollectionLinks.productId, productIds), eq(collections.isPublished, true)))
      .orderBy(asc(productCollectionLinks.sortOrder), asc(collections.slug)),
  ]);
  const images = new Map<string, ImageRow[]>();
  const variants = new Map<string, VariantRow[]>();
  const collectionSlugs = new Map<string, string[]>();
  for (const row of imageRows) images.set(row.productId, [...(images.get(row.productId) ?? []), row]);
  for (const row of variantRows) variants.set(row.productId, [...(variants.get(row.productId) ?? []), row]);
  for (const row of collectionRows) collectionSlugs.set(row.productId, [...(collectionSlugs.get(row.productId) ?? []), row.slug]);
  return { images, variants, collections: collectionSlugs };
}
function approvedImages(rows: ImageRow[]) {
  return rows.filter((row) => row.rightsConfirmed && row.rightsEvidence.trim() && row.altText.trim())
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder);
}
function model(row: ProductRow, category: string, images: ImageRow[], variants: VariantRow[], collectionSlugs: string[]): Product | null {
  const visibleImages = approvedImages(images);
  if (!visibleImages.length) return null;
  const mappedImages = visibleImages.map((image) => imageModel(image, row.title));
  return {
    id: row.id, slug: row.slug, name: row.title, category: category.trim(),
    image: mappedImages[0].url, imageAlt: mappedImages[0].altText, note: row.shortDescription.trim(),
    availability: "inquiry", priceMinor: safeMinor(row.priceMinor), currency: row.currency,
    quantityOnHand: row.quantityOnHand, isOneOfAKind: row.isOneOfAKind, collectionSlugs,
    description: row.description, materials: stringList(row.materials), sizes: stringList(row.sizes),
    measurements: recordValue(row.measurements), conditionNotes: row.conditionNotes,
    provenance: row.provenance, craftStory: row.craftStory, images: mappedImages,
    variants: variants.filter((variant) => variant.status === "active").map(variantModel),
    seoTitle: row.seoTitle, seoDescription: row.seoDescription,
  };
}

export async function listPublishedProducts(): Promise<Product[]> {
  const rows = await getMySqlDb().select({ product: products, category: categories.name })
    .from(products).leftJoin(categories, eq(categories.id, products.categoryId))
    .where(eq(products.status, "active")).orderBy(desc(products.publishedAt), desc(products.createdAt)).limit(200);
  const related = await relatedProductData(rows.map((row) => row.product.id));
  return rows.flatMap(({ product, category }) => {
    const item = model(product, category ?? "", related.images.get(product.id) ?? [], related.variants.get(product.id) ?? [], related.collections.get(product.id) ?? []);
    return item ? [item] : [];
  });
}

export async function getPublishedProduct(slug: string): Promise<Product | null> {
  const [row] = await getMySqlDb().select({ product: products, category: categories.name })
    .from(products).leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.slug, slug), eq(products.status, "active"))).limit(1);
  if (!row) return null;
  const related = await relatedProductData([row.product.id]);
  return model(row.product, row.category ?? "", related.images.get(row.product.id) ?? [], related.variants.get(row.product.id) ?? [], related.collections.get(row.product.id) ?? []);
}

export async function listPublishedCollections() {
  const rows = await getMySqlDb().select().from(collections)
    .where(eq(collections.isPublished, true)).orderBy(asc(collections.sortOrder), asc(collections.name)).limit(100);
  return rows.map((row) => ({
    name: row.name, slug: row.slug, description: row.description,
    image: row.heroImagePath && row.heroImageRightsConfirmed && row.heroImageRightsEvidence.trim() && row.heroImageAlt.trim()
      ? getMediaUrl(row.heroImagePath) : "/images/textile-placeholder.svg",
    imageAlt: row.heroImageAlt.trim() || row.name,
  }));
}
export async function getPublishedCollection(slug: string) {
  const [row] = await getMySqlDb().select().from(collections)
    .where(and(eq(collections.slug, slug), eq(collections.isPublished, true))).limit(1);
  return row ?? null;
}
export async function listProductsForCollection(collectionId: string): Promise<Product[]> {
  const db = getMySqlDb();
  const linked = await db.select({ productId: productCollectionLinks.productId })
    .from(productCollectionLinks).innerJoin(products, eq(products.id, productCollectionLinks.productId))
    .where(and(eq(productCollectionLinks.collectionId, collectionId), eq(products.status, "active")))
    .orderBy(asc(productCollectionLinks.sortOrder));
  if (!linked.length) return [];
  const ids = linked.map((row) => row.productId);
  const rows = await db.select({ product: products, category: categories.name })
    .from(products).leftJoin(categories, eq(categories.id, products.categoryId)).where(inArray(products.id, ids));
  const byId = new Map(rows.map((row) => [row.product.id, row]));
  const related = await relatedProductData(ids);
  return linked.flatMap(({ productId }) => {
    const row = byId.get(productId);
    if (!row) return [];
    const item = model(row.product, row.category ?? "", related.images.get(productId) ?? [], related.variants.get(productId) ?? [], related.collections.get(productId) ?? []);
    return item ? [item] : [];
  });
}
export async function getProductById(id: string) {
  const [row] = await getMySqlDb().select({ product: products, category: categories.name })
    .from(products).leftJoin(categories, eq(categories.id, products.categoryId)).where(eq(products.id, id)).limit(1);
  if (!row) return null;
  const related = await relatedProductData([id]);
  return {
    ...row.product, categoryName: row.category ?? "",
    images: (related.images.get(id) ?? []).map((image) => imageModel(image, row.product.title)),
    variants: (related.variants.get(id) ?? []).map(variantModel),
  };
}
export async function listAdminProducts() {
  return getMySqlDb().select({
    id: products.id, title: products.title, slug: products.slug, status: products.status,
    price_minor: products.priceMinor, currency: products.currency,
    quantity_on_hand: products.quantityOnHand, updated_at: products.updatedAt, category_name: categories.name,
  }).from(products).leftJoin(categories, eq(categories.id, products.categoryId))
    .orderBy(desc(products.updatedAt)).limit(500);
}
export async function listCategories() {
  return getMySqlDb().select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
}
export async function getPublicMediaProduct(storageKey: string) {
  const [row] = await getMySqlDb().select({ id: productImages.id }).from(productImages)
    .innerJoin(products, eq(products.id, productImages.productId))
    .where(and(eq(productImages.storagePath, storageKey), eq(productImages.rightsConfirmed, true),
      ne(productImages.rightsEvidence, ""), ne(productImages.altText, ""), eq(products.status, "active"))).limit(1);
  return Boolean(row);
}
export async function getAdminMediaAttachedToProduct(storageKey: string) {
  const [row] = await getMySqlDb().select({ id: productImages.id }).from(productImages)
    .where(eq(productImages.storagePath, storageKey)).limit(1);
  return Boolean(row);
}
