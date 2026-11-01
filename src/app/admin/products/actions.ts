"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Sign in with an administrator account.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle();

  if (profileError || !profile || !["admin", "owner"].includes(profile.role)) {
    throw new Error("Administrator permissions are required.");
  }
  return supabase;
}

function value(formData: FormData, key: string, maxLength = 2000) {
  const raw = formData.get(key);
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (trimmed.length > maxLength) throw new Error(key + " is too long.");
  return trimmed;
}

function slugify(input: string) {
  return input.normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function amountToMinorUnits(raw: string, currency: string): number | null {
  if (!raw) return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Enter a valid non-negative price.");
  try {
    const fractionDigits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
    const multiplier = 10 ** fractionDigits;
    const minor = Math.round(amount * multiplier);
    if (!Number.isSafeInteger(minor)) throw new Error("Price is too large.");
    return minor;
  } catch {
    throw new Error("Enter a valid ISO currency code.");
  }
}

function parseProduct(formData: FormData) {
  const title = value(formData, "title", 180);
  if (title.length < 3) throw new Error("Product title must contain at least three characters.");

  const currency = value(formData, "currency", 3).toUpperCase() || "USD";
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a three-letter ISO code.");

  const quantityRaw = value(formData, "quantity_on_hand", 12) || "0";
  const quantity = Number(quantityRaw);
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error("Stock quantity must be a non-negative whole number.");

  const categoryId = value(formData, "category_id", 80);
  const measurementText = value(formData, "measurements", 5000);
  let measurements: Record<string, unknown> = {};
  if (measurementText) {
    try {
      const parsed: unknown = JSON.parse(measurementText);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      measurements = parsed as Record<string, unknown>;
    } catch {
      throw new Error("Measurements must be valid JSON object data.");
    }
  }

  const list = (key: string) => value(formData, key, 1000).split(",").map((item) => item.trim()).filter(Boolean).slice(0, 40);
  const price = amountToMinorUnits(value(formData, "price", 32), currency);
  const compareAt = amountToMinorUnits(value(formData, "compare_at_price", 32), currency);

  if (price !== null && compareAt !== null && compareAt < price) {
    throw new Error("Compare-at price cannot be lower than the selling price.");
  }

  return {
    title,
    slug: slugify(value(formData, "slug", 180) || title),
    category_id: categoryId || null,
    short_description: value(formData, "short_description", 240),
    description: value(formData, "description", 12000),
    sku: value(formData, "sku", 80) || null,
    currency,
    price_minor: price,
    compare_at_price_minor: compareAt,
    quantity_on_hand: quantity,
    materials: list("materials"),
    sizes: list("sizes"),
    measurements,
    condition_notes: value(formData, "condition_notes", 4000),
    provenance: value(formData, "provenance", 4000),
    craft_story: value(formData, "craft_story", 5000),
    seo_title: value(formData, "seo_title", 180) || null,
    seo_description: value(formData, "seo_description", 320) || null,
  };
}

export async function createDraftProduct(formData: FormData) {
  const supabase = await requireAdmin();
  const product = parseProduct(formData);
  if (!product.slug) throw new Error("A valid product URL slug is required.");

  const { data, error } = await supabase.from("products")
    .insert({ ...product, status: "draft", published_at: null })
    .select("id").single();

  if (error || !data) throw new Error(error?.message ?? "Unable to create the product.");
  revalidatePath("/admin/products");
  redirect("/admin/products/" + data.id);
}

export async function updateProduct(formData: FormData) {
  const supabase = await requireAdmin();
  const id = value(formData, "id", 80);
  if (!id) throw new Error("Product ID is required.");

  const product = parseProduct(formData);
  if (!product.slug) throw new Error("A valid product URL slug is required.");

  const { error } = await supabase.from("products")
    .update(product).eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
  revalidatePath("/admin/products/" + id);
  revalidatePath("/shop");
  revalidatePath("/");
}

export async function archiveProduct(formData: FormData) {
  const supabase = await requireAdmin();
  const id = value(formData, "id", 80);
  if (!id) throw new Error("Product ID is required.");

  const { error } = await supabase.from("products")
    .update({ status: "archived" }).eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
  revalidatePath("/admin/products/" + id);
  revalidatePath("/shop");
}

export async function publishProduct(formData: FormData) {
  const supabase = await requireAdmin();
  const id = value(formData, "id", 80);
  if (!id) throw new Error("Product ID is required.");

  const { error } = await supabase.from("products")
    .update({ status: "active", published_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error("Product could not be published. Confirm its price and at least one image-rights record. " + error.message);
  }
  revalidatePath("/admin/products");
  revalidatePath("/admin/products/" + id);
  revalidatePath("/shop");
  revalidatePath("/");
}

export async function uploadProductImage(formData: FormData) {
  const supabase = await requireAdmin();
  const productId = value(formData, "product_id", 80);
  const altText = value(formData, "alt_text", 300);
  const file = formData.get("image");

  if (!productId || !(file instanceof File) || file.size === 0) throw new Error("Choose a product image.");
  if (!altText) throw new Error("Descriptive alt text is required.");
  if (file.size > 12 * 1024 * 1024) throw new Error("Image must be 12 MB or smaller.");

  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
  };
  const extension = extensions[file.type];
  if (!extension) throw new Error("Use JPEG, PNG, WebP or AVIF image files.");

  const { data: product, error: productError } = await supabase
    .from("products").select("id").eq("id", productId).maybeSingle();
  if (productError || !product) throw new Error("Product was not found.");

  const storagePath = productId + "/" + randomUUID() + "." + extension;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage.from("product-media")
    .upload(storagePath, bytes, { contentType: file.type, cacheControl: "3600", upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const { error: imageError } = await supabase.from("product_images").insert({
    product_id: productId,
    storage_path: storagePath,
    alt_text: altText,
    sort_order: 0,
    is_primary: false,
    rights_confirmed: false,
    rights_evidence: "",
  });

  if (imageError) {
    await supabase.storage.from("product-media").remove([storagePath]);
    throw new Error(imageError.message);
  }

  revalidatePath("/admin/products/" + productId);
}

export async function confirmProductImageRights(formData: FormData) {
  const supabase = await requireAdmin();
  const productId = value(formData, "product_id", 80);
  const imageId = value(formData, "image_id", 80);
  const evidence = value(formData, "rights_evidence", 1000);

  if (!productId || !imageId) throw new Error("Product and image IDs are required.");
  if (evidence.length < 12) throw new Error("Provide a meaningful rights evidence reference before confirming.");
  const confirmation = value(formData, "confirm_rights", 8);
  if (confirmation !== "yes") throw new Error("Confirm that the business owns or is authorized to use this image.");

  const { error } = await supabase.from("product_images")
    .update({ rights_confirmed: true, rights_evidence: evidence })
    .eq("id", imageId).eq("product_id", productId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/products/" + productId);
}
