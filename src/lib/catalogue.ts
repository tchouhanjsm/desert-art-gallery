import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { collections as previewCollections, products as previewProducts, type Product, type ProductImage, type ProductVariant } from "@/lib/products";
import { isPresentableProductImage, sortProductImages } from "@/lib/product-details";

type ProductImageRow = {
  id: string;
  storage_path: string;
  alt_text: string | null;
  sort_order: number | null;
  is_primary: boolean | null;
  rights_confirmed: boolean;
  created_at: string | null;
};

type ProductRow = {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  currency: string;
  price_minor: number | string | null;
  quantity_on_hand: number;
  is_one_of_a_kind: boolean;
  categories: { name: string } | null;
  product_images: ProductImageRow[] | null;
  collection_products?: { collections: { slug: string } | null }[] | null;
};

type ProductVariantRow = {
  id: string;
  label: string;
  sku: string | null;
  attributes: unknown;
  price_override_minor: number | string | null;
  quantity_on_hand: number;
  status: "active" | "draft" | "archived";
  sort_order: number;
};

type ProductDetailRow = ProductRow & {
  product_variants: ProductVariantRow[] | null;
  description: string | null;
  materials: string[] | null;
  sizes: string[] | null;
  measurements: Record<string, unknown> | null;
  condition_notes: string | null;
  provenance: string | null;
  craft_story: string | null;
  seo_title: string | null;
  seo_description: string | null;
};

type CollectionRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  hero_image_path: string | null;
  hero_image_rights_confirmed: boolean;
};

function safePriceMinor(value: number | string | null): number | null {
  if (value === null) return null;
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

function safeQuantity(value: number): number {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function safeCurrency(value: string | null | undefined): string | undefined {
  const currency = value?.trim().toUpperCase();
  return currency && /^[A-Z]{3}$/.test(currency) ? currency : undefined;
}

function stringList(value: string[] | null | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function resolveProductImages(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  row: ProductRow,
): Promise<ProductImage[]> {
  const approved = sortProductImages(
    (row.product_images ?? []).filter(isPresentableProductImage),
  );

  const resolved = await Promise.all(approved.map(async (image): Promise<ProductImage | null> => {
    const { data, error } = await supabase.storage
      .from("product-media")
      .createSignedUrl(image.storage_path, 60 * 60);
    if (error || !data?.signedUrl) return null;

    return {
      id: image.id,
      url: data.signedUrl,
      altText: image.alt_text?.trim() || row.title,
      sortOrder: image.sort_order ?? 0,
      isPrimary: Boolean(image.is_primary),
    };
  }));

  return resolved.filter((image): image is ProductImage => image !== null);
}

export async function getStorefrontProducts(): Promise<Product[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return process.env.NODE_ENV === "development" ? previewProducts : [];

  const { data, error } = await supabase
    .from("products")
    .select("id,title,slug,short_description,currency,price_minor,quantity_on_hand,is_one_of_a_kind,categories(name),product_images(id,storage_path,alt_text,sort_order,is_primary,rights_confirmed,created_at),collection_products(collections(slug))")
    .eq("status", "active")
    .order("published_at", { ascending: false })
    .limit(100);

  if (error) throw new Error("Unable to load the published catalogue: " + error.message);

  const rows = (data ?? []) as unknown as ProductRow[];
  const resolved = await Promise.all(rows.map(async (row): Promise<Product | null> => {
    const approvedImages = sortProductImages(
      (row.product_images ?? []).filter(isPresentableProductImage),
    );
    const primary = approvedImages[0];
    if (!primary?.storage_path) return null;

    const { data: signed, error: imageError } = await supabase.storage
      .from("product-media")
      .createSignedUrl(primary.storage_path, 60 * 60);
    if (imageError || !signed?.signedUrl) return null;

    return {
      id: row.id,
      slug: row.slug,
      name: row.title,
      category: row.categories?.name?.trim() ?? "",
      image: signed.signedUrl,
      imageAlt: primary.alt_text?.trim() || row.title,
      note: row.short_description?.trim() ?? "",
      availability: "inquiry",
      priceMinor: safePriceMinor(row.price_minor),
      currency: safeCurrency(row.currency),
      quantityOnHand: safeQuantity(row.quantity_on_hand),
      isOneOfAKind: row.is_one_of_a_kind,
      collectionSlugs: (row.collection_products ?? []).flatMap((item) => item.collections ? [item.collections.slug] : []),
    };
  }));

  return resolved.filter((product): product is Product => product !== null);
}

export async function getStorefrontCollections() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return process.env.NODE_ENV === "development" ? previewCollections : [];

  const { data, error } = await supabase
    .from("collections")
    .select("id,name,slug,description,hero_image_path,hero_image_rights_confirmed")
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .limit(40);

  if (error) throw new Error("Unable to load published collections: " + error.message);

  const rows = (data ?? []) as unknown as CollectionRow[];
  return Promise.all(rows.map(async (row) => {
    let image = "/images/textile-placeholder.svg";
    if (row.hero_image_path && row.hero_image_rights_confirmed) {
      const { data: signed } = await supabase.storage
        .from("product-media")
        .createSignedUrl(row.hero_image_path, 60 * 60);
      if (signed?.signedUrl) image = signed.signedUrl;
    }
    return { name: row.name, slug: row.slug, description: row.description, image };
  }));
}

/**
 * Fetch one active product and its approved gallery directly. The previous
 * implementation signed images for the entire 100-item catalogue just to
 * render one product detail page.
 */
export const getStorefrontProduct = cache(async (slug: string): Promise<Product | null> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return process.env.NODE_ENV === "development"
      ? previewProducts.find((product) => product.slug === slug) ?? null
      : null;
  }

  const { data, error } = await supabase
    .from("products")
    .select("id,title,slug,short_description,description,currency,price_minor,quantity_on_hand,is_one_of_a_kind,materials,sizes,measurements,condition_notes,provenance,craft_story,seo_title,seo_description,categories(name),product_images(id,storage_path,alt_text,sort_order,is_primary,rights_confirmed,created_at),product_variants(id,label,sku,attributes,price_override_minor,quantity_on_hand,status,sort_order)")
    .eq("status", "active")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error("Unable to load this product: " + error.message);
  if (!data) return null;

  const row = data as unknown as ProductDetailRow;
  const images = await resolveProductImages(supabase, row);
  if (!images.length) return null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.title,
    category: row.categories?.name?.trim() ?? "",
    image: images[0].url,
    imageAlt: images[0].altText,
    note: row.short_description?.trim() ?? "",
    availability: "inquiry",
    priceMinor: safePriceMinor(row.price_minor),
    currency: safeCurrency(row.currency),
    quantityOnHand: safeQuantity(row.quantity_on_hand),
    isOneOfAKind: row.is_one_of_a_kind,
    description: row.description?.trim() ?? "",
    materials: stringList(row.materials),
    sizes: stringList(row.sizes),
    measurements: recordValue(row.measurements),
    conditionNotes: row.condition_notes?.trim() ?? "",
    provenance: row.provenance?.trim() ?? "",
    craftStory: row.craft_story?.trim() ?? "",
    images,
    variants: (row.product_variants ?? [])
      .filter((variant): variant is ProductVariantRow => variant.status === "active")
      .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label))
      .map((variant): ProductVariant => ({
        id: variant.id,
        label: variant.label,
        sku: variant.sku,
        attributes: recordValue(variant.attributes),
        priceMinor: safePriceMinor(variant.price_override_minor),
        quantityOnHand: safeQuantity(variant.quantity_on_hand),
        status: variant.status,
      })),
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
  };
});
