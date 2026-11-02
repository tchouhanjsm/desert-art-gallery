"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { requireLocalAdmin } from "@/server/auth/local-admin";
import { hasSupportedImageSignature } from "@/lib/image-signature";
import { getMySqlDb, isMySqlCatalogueEnabled } from "@/server/db";
import { adjustVariantInventory } from "@/server/catalogue/inventory";
import {
  productCategories, productCategoryLinks, productMedia, products, productVariants,
} from "@/server/db/schema";
import {
  createProductStorageKey, removeProductMedia, storeProductMedia,
} from "@/server/media/product-storage";
import type { EditorialImageMime } from "@/server/media/storage";

function variantSku(formData: FormData): string | null {
  const sku = textValue(formData, "sku", 100).toUpperCase() || null;
  if (sku && !/^[A-Z0-9][A-Z0-9._/-]{0,99}$/.test(sku)) {
    throw new Error("Variant SKU contains unsupported characters.");
  }
  return sku;
}

function parseVariantAttributes(raw: string): Record<string, string> {
  if (!raw) return {};
  if (raw.length > 3000) throw new Error("Variant attributes are too long.");
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    const entries = Object.entries(parsed);
    if (entries.length > 30 || entries.some(([key, value]) =>
      !key.trim() || key.length > 80 || typeof value !== "string" || value.length > 160)) {
      throw new Error();
    }
    return Object.fromEntries(entries) as Record<string, string>;
  } catch {
    throw new Error("Variant attributes must be a JSON object containing short string values.");
  }
}

export type CatalogueActionResult = { ok: true; id?: string } | { ok: false; error: string };

async function requireCatalogueAdmin() {
  if (!isMySqlCatalogueEnabled()) {
    throw new Error("Enable MYSQL_CATALOGUE_ENABLED before using the MySQL catalogue.");
  }
  return requireLocalAdmin();
}
function textValue(formData: FormData, key: string, max = 500) {
  const raw = formData.get(key);
  if (typeof raw !== "string") return "";
  const value = raw.trim();
  if (value.length > max) throw new Error(key + " is too long.");
  return value;
}

function slugify(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "").trim().replace(/[\s-]+/g, "-").slice(0, 180);
}

function amountToMinorUnits(value: string, currency: string) {
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Use a valid three-letter ISO currency code.");
  const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  const pattern = digits === 0 ? /^(0|[1-9]\d*)$/ : new RegExp("^(0|[1-9]\\d*)(?:\\.(\\d{1," + digits + "}))?$");
  const match = value.match(pattern);
  if (!match) throw new Error("Enter a valid price for " + currency + ".");
  const whole = Number(match[1]);
  const fraction = digits === 0 ? 0 : Number((match[2] ?? "").padEnd(digits, "0") || "0");
  const result = whole * 10 ** digits + fraction;
  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(result)) throw new Error("Price exceeds the supported range.");
  return result;
}

function textList(formData: FormData, key: string): string[] {
  return [...new Set(textValue(formData, key, 2000).split(",").map((item) => item.trim()).filter(Boolean))].slice(0, 40);
}

function productInput(formData: FormData) {
  const title = textValue(formData, "title", 240);
  if (title.length < 3) throw new Error("Product title must contain at least three characters.");
  const slug = slugify(textValue(formData, "slug", 180) || title);
  if (!slug) throw new Error("A valid URL slug is required.");
  const currency = textValue(formData, "currency", 3).toUpperCase();
  const price = amountToMinorUnits(textValue(formData, "price", 32), currency);
  const compareText = textValue(formData, "compare_at_price", 32);
  const compareAt = compareText ? amountToMinorUnits(compareText, currency) : null;
  if (compareAt !== null && compareAt < price) throw new Error("Compare-at price cannot be lower than the selling price.");
  const measurementsText = textValue(formData, "measurements", 5000);
  let measurements: Record<string, unknown> | null = null;
  if (measurementsText) {
    try {
      const parsed: unknown = JSON.parse(measurementsText);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      measurements = parsed as Record<string, unknown>;
    } catch {
      throw new Error("Measurements must be a JSON object.");
    }
  }
  return {
    title,
    slug,
    currency,
    priceMinor: price,
    compareAtPriceMinor: compareAt,
    shortDescription: textValue(formData, "short_description", 240),
    description: textValue(formData, "description", 12000) || null,
    productType: textValue(formData, "product_type", 100),
    materials: textList(formData, "materials"),
    sizes: textList(formData, "sizes"),
    measurements,
    conditionNotes: textValue(formData, "condition_notes", 4000) || null,
    provenance: textValue(formData, "provenance", 4000) || null,
    craftStory: textValue(formData, "craft_story", 5000) || null,
    isOneOfAKind: textValue(formData, "one_of_a_kind", 5) === "yes",
    featured: textValue(formData, "featured", 5) === "yes",
    seoTitle: textValue(formData, "seo_title", 255),
    seoDescription: textValue(formData, "seo_description", 500),
    categorySlugs: [...new Set(textValue(formData, "category_slugs", 2000).split(",").map((item) => slugify(item)).filter(Boolean))].slice(0, 20),
  };
}

export async function createMySqlDraftProduct(formData: FormData): Promise<CatalogueActionResult> {
  try {
    await requireCatalogueAdmin();
    const input = productInput(formData);
    const { categorySlugs, ...productFields } = input;
    const id = randomUUID();
    const db = getMySqlDb();
    await db.transaction(async (tx) => {
      await tx.insert(products).values({ id, ...productFields, status: "draft" });
      await tx.insert(productVariants).values({
        id: randomUUID(),
        productId: id,
        sku: null,
        label: "Standard",
        attributes: {},
        priceMinor: null,
        currency: input.currency,
        stockQuantity: 0,
        isActive: true,
        sortOrder: 0,
      });
      const categories = categorySlugs.length
        ? await tx.select({ id: productCategories.id, slug: productCategories.slug }).from(productCategories)
          .where(and(inArray(productCategories.slug, categorySlugs), eq(productCategories.isActive, true)))
        : [];
      if (categories.length !== categorySlugs.length) {
        throw new Error("One or more category slugs do not match active MySQL categories.");
      }
      if (categories.length) {
        await tx.insert(productCategoryLinks).values(categories.map((category) => ({ productId: id, categoryId: category.id })));
      }
    });
    revalidatePath("/admin/products");
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to create draft." };
  }
}

export async function updateMySqlDraftProduct(formData: FormData): Promise<CatalogueActionResult> {
  try {
    await requireCatalogueAdmin();
    const id = textValue(formData, "id", 36);
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("A valid product ID is required.");
    const input = productInput(formData);
    const { categorySlugs, ...productFields } = input;
    const db = getMySqlDb();
    const [current] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!current || current.status === "archived") throw new Error("Product was not found or has been archived.");
    if (current.status === "published" && input.priceMinor < 1) throw new Error("Published products require a verified non-zero price.");
    await db.transaction(async (tx) => {
      await tx.update(products).set(productFields).where(eq(products.id, id));
      const categories = categorySlugs.length
        ? await tx.select({ id: productCategories.id, slug: productCategories.slug }).from(productCategories)
          .where(and(inArray(productCategories.slug, categorySlugs), eq(productCategories.isActive, true)))
        : [];
      if (categories.length !== categorySlugs.length) {
        throw new Error("One or more category slugs do not match active MySQL categories.");
      }
      await tx.delete(productCategoryLinks).where(eq(productCategoryLinks.productId, id));
      if (categories.length) await tx.insert(productCategoryLinks).values(categories.map((category) => ({ productId: id, categoryId: category.id })));
    });
    revalidatePath("/admin/products/" + id);
    revalidatePath("/admin/products");
    revalidatePath("/products/" + input.slug);
    revalidatePath("/shop");
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to update product." };
  }
}

export async function publishMySqlProduct(formData: FormData): Promise<CatalogueActionResult> {
  try {
    await requireCatalogueAdmin();
    const id = textValue(formData, "id", 36);
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("A valid product ID is required.");
    const db = getMySqlDb();
    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!product || product.status === "archived") throw new Error("Product was not found or is archived.");
    if (product.priceMinor < 1) throw new Error("A verified price greater than zero is required before publication.");
    const [image] = await db.select({ id: productMedia.id }).from(productMedia)
      .where(and(
        eq(productMedia.productId, id),
        eq(productMedia.rightsConfirmed, true),
        sql`CHAR_LENGTH(TRIM(${productMedia.altText})) > 0`,
        sql`CHAR_LENGTH(TRIM(${productMedia.rightsEvidence})) > 0`,
      )).limit(1);
    if (!image) throw new Error("At least one image with confirmed usage rights, evidence and descriptive alt text is required.");
    const [variant] = await db.select({ id: productVariants.id }).from(productVariants)
      .where(and(eq(productVariants.productId, id), eq(productVariants.isActive, true))).limit(1);
    if (!variant) throw new Error("At least one active product variant is required before publication.");
    await db.update(products).set({ status: "published", publishedAt: new Date() }).where(eq(products.id, id));
    revalidatePath("/admin/products");
    revalidatePath("/admin/products/" + id);
    revalidatePath("/shop");
    revalidatePath("/products/" + product.slug);
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to publish product." };
  }
}

export async function archiveMySqlProduct(formData: FormData): Promise<CatalogueActionResult> {
  try {
    await requireCatalogueAdmin();
    const id = textValue(formData, "id", 36);
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("A valid product ID is required.");
    await getMySqlDb().update(products).set({ status: "archived", featured: false }).where(eq(products.id, id));
    revalidatePath("/admin/products");
    revalidatePath("/admin/products/" + id);
    revalidatePath("/shop");
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to archive product." };
  }
}

export async function createMySqlCategory(formData: FormData): Promise<CatalogueActionResult> {
  try {
    await requireCatalogueAdmin();
    const name = textValue(formData, "name", 160);
    const slug = slugify(textValue(formData, "slug", 180) || name);
    if (name.length < 2 || !slug) throw new Error("Enter a category name and valid slug.");
    const sortOrderText = textValue(formData, "sort_order", 6) || "0";
    if (!/^\d{1,6}$/.test(sortOrderText)) throw new Error("Display order must be a whole number between 0 and 999999.");
    const id = randomUUID();
    await getMySqlDb().insert(productCategories).values({
      id, name, slug, description: textValue(formData, "description", 2000),
      sortOrder: Number(sortOrderText),
    });
    revalidatePath("/admin/products");
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to create category." };
  }
}

export async function createMySqlProductVariant(formData: FormData): Promise<CatalogueActionResult> {
  try {
    await requireCatalogueAdmin();
    const productId = textValue(formData, "product_id", 36);
    if (!/^[0-9a-f-]{36}$/i.test(productId)) throw new Error("A valid product ID is required.");
    const label = textValue(formData, "label", 180);
    if (!label) throw new Error("Variant label is required.");
    const sku = variantSku(formData);
    const attributes = parseVariantAttributes(textValue(formData, "attributes", 3000));
    const db = getMySqlDb();
    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!product || product.status === "archived") throw new Error("Product was not found or is archived.");
    const [last] = await db.select({ sortOrder: productVariants.sortOrder }).from(productVariants)
      .where(eq(productVariants.productId, productId)).orderBy(desc(productVariants.sortOrder)).limit(1);
    const id = randomUUID();
    await db.insert(productVariants).values({
      id, productId, sku, label, attributes, currency: product.currency,
      priceMinor: null, stockQuantity: 0, isActive: false,
      sortOrder: last ? last.sortOrder + 1 : 0,
    });
    revalidatePath("/admin/products/" + productId);
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to create variant." };
  }
}

export async function updateMySqlProductVariant(formData: FormData): Promise<CatalogueActionResult> {
  try {
    await requireCatalogueAdmin();
    const productId = textValue(formData, "product_id", 36);
    const variantId = textValue(formData, "variant_id", 36);
    if (!/^[0-9a-f-]{36}$/i.test(productId) || !/^[0-9a-f-]{36}$/i.test(variantId)) {
      throw new Error("Valid product and variant IDs are required.");
    }
    const label = textValue(formData, "label", 180);
    if (!label) throw new Error("Variant label is required.");
    const sku = variantSku(formData);
    const attributes = parseVariantAttributes(textValue(formData, "attributes", 3000));
    const active = textValue(formData, "is_active", 5) === "yes";
    const db = getMySqlDb();
    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    const [variant] = await db.select({ id: productVariants.id, isActive: productVariants.isActive }).from(productVariants)
      .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId))).limit(1);
    if (!product || !variant) throw new Error("Variant or product was not found.");
    if (!active && product.status === "published" && variant.isActive) {
      const [another] = await db.select({ id: productVariants.id }).from(productVariants)
        .where(and(eq(productVariants.productId, productId), eq(productVariants.isActive, true), ne(productVariants.id, variantId))).limit(1);
      if (!another) throw new Error("A published product must retain at least one active variant.");
    }
    await db.update(productVariants).set({ label, sku, attributes, isActive: active })
      .where(eq(productVariants.id, variantId));
    revalidatePath("/admin/products/" + productId);
    revalidatePath("/shop");
    return { ok: true, id: variantId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to update variant." };
  }
}

export async function adjustMySqlVariantInventory(formData: FormData): Promise<CatalogueActionResult> {
  try {
    const actor = await requireCatalogueAdmin();
    const variantId = textValue(formData, "variant_id", 36);
    const deltaText = textValue(formData, "quantity_delta", 12);
    const reason = textValue(formData, "reason", 160);
    const referenceKey = textValue(formData, "reference_key", 180) || "owner-adjustment-" + randomUUID();
    if (!/^[0-9a-f-]{36}$/i.test(variantId)) throw new Error("A valid product variant is required.");
    if (!/^-?(0|[1-9]\d*)$/.test(deltaText)) throw new Error("Enter a whole-number stock adjustment.");
    const delta = Number(deltaText);
    if (!Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > 2147483647) {
      throw new Error("Stock adjustment must be a non-zero whole number.");
    }
    await adjustVariantInventory({ variantId, quantityDelta: delta, reason, referenceKey, actorId: actor.id });
    revalidatePath("/admin/products");
    revalidatePath("/admin/products/" + textValue(formData, "product_id", 36));
    revalidatePath("/shop");
    return { ok: true, id: variantId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Inventory adjustment failed." };
  }
}

export async function uploadMySqlProductImage(formData: FormData): Promise<CatalogueActionResult> {
  try {
    await requireCatalogueAdmin();
    const productId = textValue(formData, "product_id", 36);
    const altText = textValue(formData, "alt_text", 300);
    const file = formData.get("image");
    if (!/^[0-9a-f-]{36}$/i.test(productId)) throw new Error("A valid product ID is required.");
    if (!altText) throw new Error("Descriptive image alt text is required.");
    if (!(file instanceof File) || file.size < 1 || file.size > 12 * 1024 * 1024) {
      throw new Error("Choose an image between 1 byte and 12 MB.");
    }
    const mimeTypes: Record<string, EditorialImageMime> = {
      "image/jpeg": "image/jpeg", "image/png": "image/png",
      "image/webp": "image/webp", "image/avif": "image/avif",
    };
    const mimeType = mimeTypes[file.type];
    if (!mimeType) throw new Error("Use JPEG, PNG, WebP or AVIF image files.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasSupportedImageSignature(mimeType, bytes.slice(0, 64))) {
      throw new Error("Image contents do not match the declared file type.");
    }
    const db = getMySqlDb();
    const [product] = await db.select({ slug: products.slug }).from(products)
      .where(eq(products.id, productId)).limit(1);
    if (!product) throw new Error("Product was not found.");
    const [last] = await db.select({ position: productMedia.position }).from(productMedia)
      .where(eq(productMedia.productId, productId))
      .orderBy(desc(productMedia.position)).limit(1);
    const storageKey = createProductStorageKey(productId, mimeType);
    await storeProductMedia(storageKey, bytes);
    try {
      await db.insert(productMedia).values({
        id: randomUUID(), productId, storageKey, altText,
        rightsConfirmed: false, rightsEvidence: "", mimeType, byteSize: bytes.byteLength,
        position: last ? last.position + 1 : 0, isPrimary: !last,
      });
    } catch (error) {
      await removeProductMedia(storageKey).catch(() => undefined);
      throw error;
    }
    revalidatePath("/admin/products/" + productId);
    revalidatePath("/admin/products");
    revalidatePath("/shop");
    revalidatePath("/products/" + product.slug);
    return { ok: true, id: productId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to upload product image." };
  }
}

export async function confirmMySqlProductImageRights(formData: FormData): Promise<CatalogueActionResult> {
  try {
    await requireCatalogueAdmin();
    const productId = textValue(formData, "product_id", 36);
    const imageId = textValue(formData, "image_id", 36);
    const evidence = textValue(formData, "rights_evidence", 1000);
    if (!/^[0-9a-f-]{36}$/i.test(productId) || !/^[0-9a-f-]{36}$/i.test(imageId)) {
      throw new Error("Valid product and image IDs are required.");
    }
    if (evidence.length < 12 || textValue(formData, "confirm_rights", 8) !== "yes") {
      throw new Error("Provide evidence and explicitly confirm image-use permission.");
    }
    const db = getMySqlDb();
    const [image] = await db.select({ id: productMedia.id }).from(productMedia)
      .where(and(eq(productMedia.id, imageId), eq(productMedia.productId, productId))).limit(1);
    if (!image) throw new Error("Product image was not found.");
    await db.update(productMedia).set({ rightsConfirmed: true, rightsEvidence: evidence })
      .where(eq(productMedia.id, imageId));
    revalidatePath("/admin/products/" + productId);
    revalidatePath("/admin/products");
    revalidatePath("/shop");
    return { ok: true, id: imageId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to confirm image rights." };
  }
}

export async function revokeMySqlProductImageRights(formData: FormData): Promise<CatalogueActionResult> {
  try {
    await requireCatalogueAdmin();
    const productId = textValue(formData, "product_id", 36);
    const imageId = textValue(formData, "image_id", 36);
    const [image] = await getMySqlDb().select({ id: productMedia.id }).from(productMedia)
      .where(and(eq(productMedia.id, imageId), eq(productMedia.productId, productId))).limit(1);
    if (!image) throw new Error("Product image was not found.");
    await getMySqlDb().update(productMedia)
      .set({ rightsConfirmed: false, rightsEvidence: "" })
      .where(eq(productMedia.id, imageId));
    revalidatePath("/admin/products/" + productId);
    revalidatePath("/shop");
    return { ok: true, id: imageId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to revoke image rights." };
  }
}

export async function createMySqlDraftProductState(_previous: CatalogueActionResult, formData: FormData) {
  return createMySqlDraftProduct(formData);
}

export async function updateMySqlDraftProductState(_previous: CatalogueActionResult, formData: FormData) {
  return updateMySqlDraftProduct(formData);
}

export async function publishMySqlProductState(_previous: CatalogueActionResult, formData: FormData) {
  return publishMySqlProduct(formData);
}

export async function archiveMySqlProductState(_previous: CatalogueActionResult, formData: FormData) {
  return archiveMySqlProduct(formData);
}

export async function createMySqlCategoryState(_previous: CatalogueActionResult, formData: FormData) {
  return createMySqlCategory(formData);
}

export async function createMySqlProductVariantState(_previous: CatalogueActionResult, formData: FormData) {
  return createMySqlProductVariant(formData);
}

export async function updateMySqlProductVariantState(_previous: CatalogueActionResult, formData: FormData) {
  return updateMySqlProductVariant(formData);
}

export async function adjustMySqlVariantInventoryState(_previous: CatalogueActionResult, formData: FormData) {
  return adjustMySqlVariantInventory(formData);
}

export async function uploadMySqlProductImageState(_previous: CatalogueActionResult, formData: FormData) {
  return uploadMySqlProductImage(formData);
}

export async function confirmMySqlProductImageRightsState(_previous: CatalogueActionResult, formData: FormData) {
  return confirmMySqlProductImageRights(formData);
}

export async function revokeMySqlProductImageRightsState(_previous: CatalogueActionResult, formData: FormData) {
  return revokeMySqlProductImageRights(formData);
}
