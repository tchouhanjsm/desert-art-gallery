"use server";

import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasSupportedImageSignature } from "@/lib/image-signature";
import { parseProductCsv, type ProductImportPreviewRow, type ProductImportRow } from "@/lib/product-import";
import { parseVariantAttributes } from "@/lib/variants";
import { requireAdmin } from "@/server/auth/session";
import { getMySqlDb } from "@/server/db";
import {
  catalogueImportBatches, categories, inventoryMovements, inventoryReservationItems,
  inventoryReservations, productImages, products, productVariants,
} from "@/server/db/schema";
import {
  createProductMediaStorageKey, removeMedia, storeMedia,
  type EditorialImageMime,
} from "@/server/media/storage";

export type CatalogueImportPreview = {
  ok: boolean;
  sha256?: string;
  totalRows: number;
  validRows: number;
  rows: ProductImportPreviewRow[];
  errors: string[];
  error?: string;
};
export type CatalogueImportCommitResult =
  | { ok: true; batchId: string; productsCreated: number; stockUnitsAdded: number }
  | { ok: false; error: string };

function value(formData: FormData, key: string, maximum = 2000): string {
  const raw = formData.get(key);
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (trimmed.length > maximum) throw new Error(key + " is too long.");
  return trimmed;
}
function slugify(input: string): string {
  return input.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().toLowerCase()
    .replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
}
function amountToMinorUnits(raw: string, currency: string): number | null {
  if (!raw) return null;
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Enter a valid ISO currency code.");
  let digits: number;
  try { digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2; }
  catch { throw new Error("Enter a valid ISO currency code."); }
  const pattern = digits === 0 ? /^(0|[1-9]\d*)$/ : new RegExp("^(0|[1-9]\\d*)(?:\\.(\\d{1," + digits + "}))?$");
  const match = raw.match(pattern);
  if (!match) throw new Error("Enter a valid price using the supported precision for " + currency + ".");
  const whole = Number(match[1]);
  const fraction = digits === 0 ? 0 : Number((match[2] ?? "").padEnd(digits, "0") || "0");
  const minor = whole * (10 ** digits) + fraction;
  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(minor)) throw new Error("Price is too large.");
  return minor;
}
function parseProduct(formData: FormData) {
  const title = value(formData, "title", 180);
  if (title.length < 3) throw new Error("Product title must contain at least three characters.");
  const currency = value(formData, "currency", 3).toUpperCase() || "INR";
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a three-letter ISO code.");
  const measurementText = value(formData, "measurements", 5000);
  let measurements: Record<string, unknown> = {};
  if (measurementText) {
    try {
      const parsed: unknown = JSON.parse(measurementText);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      measurements = parsed as Record<string, unknown>;
    } catch { throw new Error("Measurements must be valid JSON object data."); }
  }
  const list = (key: string) => value(formData, key, 1000).split(",").map(item => item.trim()).filter(Boolean).slice(0, 40);
  const price = amountToMinorUnits(value(formData, "price", 32), currency);
  const compareAt = amountToMinorUnits(value(formData, "compare_at_price", 32), currency);
  if (price !== null && compareAt !== null && compareAt < price) throw new Error("Compare-at price cannot be lower than the selling price.");
  if (price === null && compareAt !== null) throw new Error("A compare-at price requires a verified selling price.");
  const slug = slugify(value(formData, "slug", 180) || title);
  if (!slug) throw new Error("A valid product URL slug is required.");
  return {
    title, slug,
    categoryId: value(formData, "category_id", 80) || null,
    shortDescription: value(formData, "short_description", 500),
    description: value(formData, "description", 12000),
    sku: value(formData, "sku", 80).toUpperCase() || null,
    currency, priceMinor: price, compareAtPriceMinor: compareAt,
    materials: list("materials"), sizes: list("sizes"), measurements,
    conditionNotes: value(formData, "condition_notes", 4000),
    provenance: value(formData, "provenance", 4000),
    craftStory: value(formData, "craft_story", 5000),
    seoTitle: value(formData, "seo_title", 180) || null,
    seoDescription: value(formData, "seo_description", 320) || null,
  };
}
function revalidateProduct(id?: string, slug?: string) {
  revalidatePath("/"); revalidatePath("/shop"); revalidatePath("/admin/products"); revalidatePath("/admin/media");
  if (id) revalidatePath("/admin/products/" + id);
  if (slug) revalidatePath("/products/" + slug);
}
function positiveInteger(raw: string, label: string): number {
  if (!/^(0|[1-9]\d*)$/.test(raw)) throw new Error(label + " must be a whole number.");
  const number = Number(raw);
  if (!Number.isSafeInteger(number) || number > 2147483647) throw new Error(label + " is outside the supported range.");
  return number;
}

type PreparedImportRow = ProductImportRow & { categoryId: string | null };
type PreparedImport = { sha256: string; errors: string[]; rows: PreparedImportRow[] };

async function prepareCatalogueImport(file: File): Promise<PreparedImport> {
  if (!file.name.toLowerCase().endsWith(".csv")) throw new Error("Choose a .csv file.");
  if (file.size === 0 || file.size > 2 * 1024 * 1024) throw new Error("CSV files must be between 1 byte and 2 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  let source: string;
  try { source = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new Error("The CSV must use valid UTF-8 encoding."); }
  const parsed = parseProductCsv(source);
  const rows: PreparedImportRow[] = parsed.rows.map(row => ({ ...row, errors: [...row.errors], categoryId: null }));
  const errors = [...parsed.errors];
  if (!rows.length) return { sha256, errors, rows };
  const db = getMySqlDb();
  const categorySlugs = [...new Set(rows.flatMap(row => row.category_slug ? [row.category_slug] : []))];
  const categoryMap = new Map<string, string>();
  if (categorySlugs.length) {
    const found = await db.select({ id: categories.id, slug: categories.slug }).from(categories).where(inArray(categories.slug, categorySlugs));
    for (const category of found) categoryMap.set(category.slug, category.id);
  }
  for (const row of rows) {
    if (row.category_slug) {
      const categoryId = categoryMap.get(row.category_slug);
      if (!categoryId) row.errors.push("Category slug does not match an existing category: " + row.category_slug + ".");
      else row.categoryId = categoryId;
    }
  }
  const slugs = [...new Set(rows.map(row => row.slug).filter(Boolean))];
  const existingSlugs = slugs.length ? await db.select({ slug: products.slug }).from(products).where(inArray(products.slug, slugs)) : [];
  const slugSet = new Set(existingSlugs.map(row => row.slug));
  const skus = [...new Set(rows.flatMap(row => row.sku ? [row.sku] : []))];
  const existingSkus = skus.length ? await db.select({ sku: products.sku }).from(products).where(inArray(products.sku, skus)) : [];
  const skuSet = new Set(existingSkus.map(row => row.sku?.toUpperCase()).filter(Boolean));
  for (const row of rows) {
    if (slugSet.has(row.slug)) row.errors.push("Product slug already exists in the catalogue.");
    if (row.sku && skuSet.has(row.sku)) row.errors.push("SKU already exists in the catalogue.");
  }
  return { sha256, errors, rows };
}

export async function previewCatalogueImport(formData: FormData): Promise<CatalogueImportPreview> {
  try {
    await requireAdmin();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("Choose a CSV file to preview.");
    const prepared = await prepareCatalogueImport(file);
    const validRows = prepared.rows.filter(row => row.errors.length === 0).length;
    const rows: ProductImportPreviewRow[] = prepared.rows.map(row => ({
      line: row.line, slug: row.slug, title: row.title, sku: row.sku,
      category_slug: row.category_slug, price_minor: row.price_minor,
      currency: row.currency, quantity_on_hand: row.quantity_on_hand, errors: row.errors,
    }));
    return {
      ok: prepared.errors.length === 0 && prepared.rows.length > 0 && validRows === prepared.rows.length,
      sha256: prepared.sha256, totalRows: prepared.rows.length, validRows, rows, errors: prepared.errors,
    };
  } catch (error) {
    return { ok: false, totalRows: 0, validRows: 0, rows: [], errors: [], error: error instanceof Error ? error.message : "Catalogue preview failed." };
  }
}

export async function importCatalogueProducts(formData: FormData): Promise<CatalogueImportCommitResult> {
  try {
    const user = await requireAdmin();
    if (value(formData, "confirm_import", 8) !== "yes") throw new Error("Confirm that the verified catalogue records should be imported as drafts.");
    const expectedSha = value(formData, "expected_sha256", 64);
    if (!/^[a-f0-9]{64}$/.test(expectedSha)) throw new Error("Preview the CSV again before importing.");
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("Choose the same CSV file that was previewed.");
    const prepared = await prepareCatalogueImport(file);
    if (prepared.sha256 !== expectedSha) throw new Error("The CSV changed after preview. Preview the selected file again.");
    if (prepared.errors.length || !prepared.rows.length || prepared.rows.some(row => row.errors.length)) {
      throw new Error("The CSV contains validation issues. Correct them and preview the file again.");
    }

    const db = getMySqlDb();
    const batchId = randomUUID();
    const stockUnitsAdded = prepared.rows.reduce((sum, row) => sum + row.quantity_on_hand, 0);
    await db.transaction(async tx => {
      for (const row of prepared.rows) {
        const productId = randomUUID();
        const now = new Date();
        await tx.insert(products).values({
          id: productId, categoryId: row.categoryId, title: row.title, slug: row.slug,
          shortDescription: row.short_description, description: row.description,
          sku: row.sku, currency: row.currency, priceMinor: row.price_minor,
          compareAtPriceMinor: row.compare_at_price_minor, quantityOnHand: row.quantity_on_hand,
          status: "draft", isOneOfAKind: false, materials: row.materials, sizes: row.sizes,
          measurements: row.measurements, conditionNotes: row.condition_notes,
          provenance: row.provenance, craftStory: row.craft_story,
          seoTitle: null, seoDescription: null, publishedAt: null, createdAt: now, updatedAt: now,
        });
        if (row.quantity_on_hand > 0) {
          await tx.insert(inventoryMovements).values({
            id: randomUUID(), productId, variantId: null, quantityDelta: row.quantity_on_hand,
            reason: "opening_stock", reference: "catalogue-import:" + batchId,
            actorId: user.id, createdAt: now,
          });
        }
      }
      await tx.insert(catalogueImportBatches).values({
        id: batchId, createdBy: user.id, rowCount: prepared.rows.length,
        productsCreated: prepared.rows.length, stockUnitsAdded, createdAt: new Date(),
      });
    });
    revalidateProduct();
    return { ok: true, batchId, productsCreated: prepared.rows.length, stockUnitsAdded };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Catalogue import failed." };
  }
}

export async function createDraftProduct(formData: FormData) {
  await requireAdmin();
  const input = parseProduct(formData);
  const id = randomUUID();
  const now = new Date();
  await getMySqlDb().insert(products).values({
    id, ...input, quantityOnHand: 0, status: "draft", isOneOfAKind: false,
    publishedAt: null, createdAt: now, updatedAt: now,
  });
  revalidateProduct(id, input.slug);
  redirect("/admin/products/" + id);
}

export async function updateProduct(formData: FormData) {
  await requireAdmin();
  const id = value(formData, "id", 80);
  if (!id) throw new Error("Product ID is required.");
  const input = parseProduct(formData);
  await getMySqlDb().update(products).set({ ...input, updatedAt: new Date() }).where(eq(products.id, id));
  revalidateProduct(id, input.slug);
}

export async function archiveProduct(formData: FormData) {
  await requireAdmin();
  const id = value(formData, "id", 80);
  if (!id) throw new Error("Product ID is required.");
  await getMySqlDb().update(products).set({ status: "archived", updatedAt: new Date() }).where(eq(products.id, id));
  revalidateProduct(id);
}

export async function publishProduct(formData: FormData) {
  await requireAdmin();
  const id = value(formData, "id", 80);
  if (!id) throw new Error("Product ID is required.");
  const db = getMySqlDb();
  await db.transaction(async tx => {
    const [product] = await tx.select().from(products).where(eq(products.id, id)).for("update").limit(1);
    if (!product) throw new Error("Product was not found.");
    if (product.priceMinor === null) throw new Error("A verified price is required before publishing.");
    const [image] = await tx.select({ id: productImages.id }).from(productImages)
      .where(and(eq(productImages.productId, id), eq(productImages.rightsConfirmed, true), eq(productImages.rightsEvidence, productImages.rightsEvidence)))
      .limit(1);
    const approved = await tx.select({ id: productImages.id, alt: productImages.altText, evidence: productImages.rightsEvidence })
      .from(productImages).where(and(eq(productImages.productId, id), eq(productImages.rightsConfirmed, true))).limit(20);
    if (!image || !approved.some(item => item.alt.trim() && item.evidence.trim())) {
      throw new Error("At least one product image must have descriptive alt text and confirmed usage-rights evidence.");
    }
    await tx.update(products).set({ status: "active", publishedAt: new Date(), updatedAt: new Date() }).where(eq(products.id, id));
  });
  revalidateProduct(id);
}

async function adjustStock(productId: string, variantId: string | null, delta: number, reason: string, reference: string, actorId: string) {
  const db = getMySqlDb();
  await db.transaction(async tx => {
    const [product] = await tx.select().from(products).where(eq(products.id, productId)).for("update").limit(1);
    if (!product) throw new Error("Product was not found.");
    const variantRows = variantId
      ? await tx.select().from(productVariants).where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId))).for("update").limit(1)
      : [];
    if (variantId && !variantRows.length) throw new Error("Product variant was not found.");
    const now = new Date();
    const reservedRows = await tx.select({ quantity: inventoryReservationItems.quantity })
      .from(inventoryReservationItems).innerJoin(inventoryReservations, eq(inventoryReservations.id, inventoryReservationItems.reservationId))
      .where(and(eq(inventoryReservationItems.productId, productId),
        variantId ? eq(inventoryReservationItems.variantId, variantId) : isNull(inventoryReservationItems.variantId),
        eq(inventoryReservations.status, "reserved"), gt(inventoryReservations.expiresAt, now)));
    const reserved = reservedRows.reduce((sum, row) => sum + row.quantity, 0);
    const current = variantId ? variantRows[0].quantityOnHand : product.quantityOnHand;
    const next = current + delta;
    if (!Number.isSafeInteger(next) || next < reserved) throw new Error("Stock cannot be reduced below active reservations.");
    if (variantId) await tx.update(productVariants).set({ quantityOnHand: next, updatedAt: now }).where(eq(productVariants.id, variantId));
    else await tx.update(products).set({ quantityOnHand: next, updatedAt: now }).where(eq(products.id, productId));
    await tx.insert(inventoryMovements).values({
      id: randomUUID(), productId, variantId, quantityDelta: delta, reason,
      reference: reference || null, actorId, createdAt: now,
    });
  });
}

export async function adjustProductInventory(formData: FormData) {
  const user = await requireAdmin();
  const productId = value(formData, "product_id", 80);
  const deltaText = value(formData, "quantity_delta", 12);
  const reason = value(formData, "reason", 24);
  const reference = value(formData, "reference", 120);
  if (!productId || !/^-?(0|[1-9]\d*)$/.test(deltaText)) throw new Error("Enter a product and a signed whole-number stock adjustment.");
  const delta = Number(deltaText);
  if (!Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > 2147483647) throw new Error("Stock adjustment must be a non-zero whole number within range.");
  if (!["restock", "correction", "damage", "return", "other"].includes(reason)) throw new Error("Choose a supported inventory adjustment reason.");
  if ((reason === "restock" || reason === "return") && delta < 0) throw new Error("Restock and return adjustments must increase stock.");
  if (reason === "damage" && delta > 0) throw new Error("Damage adjustments must decrease stock.");
  await adjustStock(productId, null, delta, reason, reference, user.id);
  revalidateProduct(productId, value(formData, "product_slug", 100));
}

function imageMime(file: File): EditorialImageMime {
  const types: Record<string, EditorialImageMime> = {
    "image/jpeg":"image/jpeg", "image/png":"image/png", "image/webp":"image/webp", "image/avif":"image/avif",
  };
  const mime = types[file.type];
  if (!mime) throw new Error("Use JPEG, PNG, WebP or AVIF image files.");
  return mime;
}
export async function uploadProductImage(formData: FormData) {
  await requireAdmin();
  const productId = value(formData, "product_id", 80);
  const altText = value(formData, "alt_text", 300);
  const file = formData.get("image");
  if (!productId || !(file instanceof File) || !file.size || !altText) throw new Error("Choose a product image and provide descriptive alt text.");
  if (file.size > 12 * 1024 * 1024) throw new Error("Image must be 12 MB or smaller.");
  const mime = imageMime(file);
  if (!hasSupportedImageSignature(mime, new Uint8Array(await file.slice(0,64).arrayBuffer()))) throw new Error("Image signature does not match the selected file type.");
  const [product] = await getMySqlDb().select({id:products.id}).from(products).where(eq(products.id,productId)).limit(1);
  if (!product) throw new Error("Product was not found.");
  const key = createProductMediaStorageKey(productId, mime);
  await storeMedia(key, new Uint8Array(await file.arrayBuffer()));
  try {
    const now = new Date();
    await getMySqlDb().insert(productImages).values({
      id: randomUUID(), productId, storagePath:key, altText, sortOrder:9999,
      isPrimary:false, rightsConfirmed:false, rightsEvidence:"", createdAt:now,
    });
  } catch (error) {
    await removeMedia(key).catch(()=>undefined);
    throw error;
  }
  revalidateProduct(productId);
}

export async function confirmProductImageRights(formData: FormData) {
  await requireAdmin();
  const productId=value(formData,"product_id",80);const imageId=value(formData,"image_id",80);const evidence=value(formData,"rights_evidence",1000);
  if(!productId||!imageId||evidence.length<12||value(formData,"confirm_rights",8)!=="yes")throw new Error("Provide rights evidence and explicitly confirm permission.");
  await getMySqlDb().update(productImages).set({rightsConfirmed:true,rightsEvidence:evidence}).where(and(eq(productImages.id,imageId),eq(productImages.productId,productId)));
  revalidateProduct(productId);
}

export async function updateProductImageOrder(formData: FormData) {
  await requireAdmin();
  const productId=value(formData,"product_id",80);const imageId=value(formData,"image_id",80);const raw=value(formData,"sort_order",8);
  const order=positiveInteger(raw,"Display order");
  if(!productId||!imageId)throw new Error("Product and image IDs are required.");
  await getMySqlDb().update(productImages).set({sortOrder:order}).where(and(eq(productImages.id,imageId),eq(productImages.productId,productId)));
  revalidateProduct(productId);
}
export async function setProductImagePrimary(formData: FormData) {
  await requireAdmin();
  const productId=value(formData,"product_id",80);const imageId=value(formData,"image_id",80);
  if(!productId||!imageId)throw new Error("Product and image IDs are required.");
  const db=getMySqlDb();
  await db.transaction(async tx=>{
    const [image]=await tx.select().from(productImages).where(and(eq(productImages.id,imageId),eq(productImages.productId,productId))).limit(1);
    if(!image)throw new Error("Product image was not found.");
    if(!image.rightsConfirmed||!image.rightsEvidence.trim()||!image.altText.trim())throw new Error("Confirm image rights before using this image as primary.");
    await tx.update(productImages).set({isPrimary:false}).where(eq(productImages.productId,productId));
    await tx.update(productImages).set({isPrimary:true}).where(eq(productImages.id,imageId));
  });
  revalidateProduct(productId);
}

function parseVariantForm(formData: FormData, currency: string) {
  const label=value(formData,"label",120);if(!label)throw new Error("Variant label is required.");
  let raw:unknown;try{raw=JSON.parse(value(formData,"attributes",3000));}catch{throw new Error("Variant attributes must be valid JSON object data.");}
  const attributes=parseVariantAttributes(raw);
  const sku=value(formData,"sku",80).toUpperCase()||null;
  if(sku&&!/^[A-Z0-9][A-Z0-9._/-]{0,79}$/.test(sku))throw new Error("Variant SKU contains unsupported characters.");
  return {label,attributes,sku,priceOverrideMinor:amountToMinorUnits(value(formData,"price_override",32),currency)};
}
export async function createProductVariant(formData:FormData){
  await requireAdmin();const productId=value(formData,"product_id",80);const slug=value(formData,"product_slug",120);
  const [product]=await getMySqlDb().select({currency:products.currency}).from(products).where(eq(products.id,productId)).limit(1);
  if(!product)throw new Error("Product was not found.");
  const variant=parseVariantForm(formData,product.currency);const now=new Date();
  await getMySqlDb().insert(productVariants).values({id:randomUUID(),productId,...variant,quantityOnHand:0,status:"draft",sortOrder:0,createdAt:now,updatedAt:now});
  revalidateProduct(productId,slug);
}
export async function updateProductVariant(formData:FormData){
  await requireAdmin();const productId=value(formData,"product_id",80);const variantId=value(formData,"variant_id",80);const status=value(formData,"status",16);const slug=value(formData,"product_slug",120);
  if(!["draft","active","archived"].includes(status))throw new Error("Choose a supported variant status.");
  const [product]=await getMySqlDb().select({currency:products.currency}).from(products).where(eq(products.id,productId)).limit(1);
  if(!product)throw new Error("Product was not found.");
  const variant=parseVariantForm(formData,product.currency);
  const result=await getMySqlDb().update(productVariants).set({...variant,status,updatedAt:new Date()}).where(and(eq(productVariants.id,variantId),eq(productVariants.productId,productId)));
  revalidateProduct(productId,slug);
}
export async function adjustProductVariantInventory(formData:FormData){
  const user=await requireAdmin();const productId=value(formData,"product_id",80);const variantId=value(formData,"variant_id",80);
  const deltaText=value(formData,"quantity_delta",12);const reason=value(formData,"reason",24);const reference=value(formData,"reference",120);
  if(!productId||!variantId||! /^-?(0|[1-9]\d*)$/.test(deltaText))throw new Error("Enter a variant and a signed whole-number stock adjustment.");
  const delta=Number(deltaText);if(!Number.isSafeInteger(delta)||delta===0||Math.abs(delta)>2147483647)throw new Error("Stock adjustment is outside the supported range.");
  if(!["restock","correction","damage","return","other"].includes(reason))throw new Error("Choose a supported inventory adjustment reason.");
  if((reason==="restock"||reason==="return")&&delta<0)throw new Error("Restock and return adjustments must increase stock.");
  if(reason==="damage"&&delta>0)throw new Error("Damage adjustments must decrease stock.");
  await adjustStock(productId,variantId,delta,reason,reference,user.id);
  revalidateProduct(productId,value(formData,"product_slug",120));
}
