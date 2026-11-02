"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMySqlDb } from "@/server/db";
import { products, productCategories, productVariants, productMedia, inventoryMovements } from "@/server/db/schema";
import { desc, eq } from "drizzle-orm";

async function requireCatalogueAdmin() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase identity is not configured.");
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Sign in with an administrator account.");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profileError || !profile || !["admin", "owner"].includes(profile.role)) throw new Error("Administrator permissions are required.");
  return user;
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
  return {
    title, slug, currency, priceMinor: price, compareAtPriceMinor: compareAt,
    description: textValue(formData, "description", 12000),
    productType: textValue(formData, "product_type", 100),
    isOneOfAKind: textValue(formData, "one_of_a_kind", 5) === "yes",
    featured: textValue(formData, "featured", 5) === "yes",
    seoTitle: textValue(formData, "seo_title", 255),
    seoDescription: textValue(formData, "seo_description", 500),
  };
}

export type CatalogueActionResult = { ok: true; id?: string } | { ok: false; error: string };

export async function createMySqlDraftProduct(formData: FormData): Promise<CatalogueActionResult> {
  try {
    await requireCatalogueAdmin();
    const input = productInput(formData);
    const id = randomUUID();
    await getMySqlDb().insert(products).values({ id, ...input, status: "draft" });
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
    await getMySqlDb().update(products).set(input).where(eq(products.id, id));
    revalidatePath("/admin/products/" + id);
    revalidatePath("/admin/products");
    revalidatePath("/products/" + input.slug);
    revalidatePath("/shop");
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to update product." };
  }
}

export async function archiveMySqlProduct(formData: FormData): Promise<CatalogueActionResult> {
  try {
    await requireCatalogueAdmin();
    const id = textValue(formData, "id", 36);
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("A valid product ID is required.");
    await getMySqlDb().update(products).set({ status: "archived", featured: false }).where(eq(products.id, id));
    revalidatePath("/admin/products");
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
    const id = randomUUID();
    await getMySqlDb().insert(productCategories).values({
      id, name, slug, description: textValue(formData, "description", 4000),
      sortOrder: Number(textValue(formData, "sort_order", 6) || "0"),
    });
    revalidatePath("/admin/products");
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to create category." };
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
    if (!Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > 2147483647) throw new Error("Stock adjustment must be a non-zero whole number.");
    if (reason.length < 3) throw new Error("Enter a reason for this inventory movement.");

    const db = getMySqlDb();
    await db.transaction(async (tx) => {
      const [variant] = await tx.select().from(productVariants).where(eq(productVariants.id, variantId)).for("update");
      if (!variant || !variant.isActive) throw new Error("An active variant was not found.");
      const [product] = await tx.select().from(products).where(eq(products.id, variant.productId)).for("update");
      if (!product || product.status === "archived") throw new Error("Inventory cannot be changed for an archived product.");
      const next = variant.stockQuantity + delta;
      if (!Number.isSafeInteger(next) || next < 0 || next > 2147483647) throw new Error("Adjustment would produce an invalid stock balance.");
      if (product.isOneOfAKind && next > 1) throw new Error("One-of-a-kind products may have no more than one unit in stock.");
      const [existing] = await tx.select().from(inventoryMovements).where(eq(inventoryMovements.referenceKey, referenceKey)).limit(1);
      if (existing) {
        if (existing.variantId !== variantId || existing.quantityDelta !== delta) throw new Error("This inventory reference has already been used for a different movement.");
        return;
      }
      await tx.insert(inventoryMovements).values({
        id: randomUUID(), variantId, quantityDelta: delta,
        reason, referenceKey, actorId: actor.id,
      });
      await tx.update(productVariants).set({ stockQuantity: next }).where(eq(productVariants.id, variantId));
    });
    revalidatePath("/admin/products");
    revalidatePath("/admin/products/" + textValue(formData, "product_id", 36));
    revalidatePath("/shop");
    return { ok: true, id: variantId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Inventory adjustment failed." };
  }
}
