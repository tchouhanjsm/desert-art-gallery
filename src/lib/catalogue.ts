import { createSupabaseServerClient } from "@/lib/supabase/server";
import { collections as previewCollections, products as previewProducts, type Product } from "@/lib/products";

type ProductImageRow = { storage_path: string; alt_text: string; sort_order: number; rights_confirmed: boolean };
type ProductRow = {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  currency: string;
  price_minor: number | null;
  quantity_on_hand: number;
  is_one_of_a_kind: boolean;
  categories: { name: string } | null;
  product_images: ProductImageRow[] | null;
  collection_products?: { collections: { slug: string } | null }[] | null;
};

type CollectionRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  hero_image_path: string | null;
  hero_image_rights_confirmed: boolean;
};

export async function getStorefrontProducts(): Promise<Product[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return previewProducts;

  const { data, error } = await supabase
    .from("products")
    .select("id,title,slug,short_description,currency,price_minor,quantity_on_hand,is_one_of_a_kind,categories(name),product_images(storage_path,alt_text,sort_order,rights_confirmed),collection_products(collections(slug))")
    .eq("status", "active")
    .order("published_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(`Unable to load the published catalogue: ${error.message}`);

  const rows = (data ?? []) as unknown as ProductRow[];
  const resolved = await Promise.all(rows.map(async (row): Promise<Product | null> => {
    const approvedImages = (row.product_images ?? [])
      .filter((image) => image.rights_confirmed)
      .sort((a, b) => a.sort_order - b.sort_order);
    const primary = approvedImages[0];
    if (!primary) return null;

    const { data: signed, error: imageError } = await supabase.storage
      .from("product-media")
      .createSignedUrl(primary.storage_path, 15 * 60);
    if (imageError || !signed?.signedUrl) return null;

    return {
      id: row.id,
      slug: row.slug,
      name: row.title,
      category: row.categories?.name ?? "Heritage textiles",
      image: signed.signedUrl,
      imageAlt: primary.alt_text,
      note: row.short_description ?? "",
      availability: "inquiry",
      priceMinor: row.price_minor,
      currency: row.currency,
      quantityOnHand: row.quantity_on_hand,
      isOneOfAKind: row.is_one_of_a_kind,
      collectionSlugs: (row.collection_products ?? []).flatMap((item) => item.collections ? [item.collections.slug] : []),
    };
  }));

  return resolved.filter((product): product is Product => product !== null);
}

export async function getStorefrontCollections() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return previewCollections;

  const { data, error } = await supabase
    .from("collections")
    .select("id,name,slug,description,hero_image_path,hero_image_rights_confirmed")
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .limit(40);

  if (error) throw new Error(`Unable to load published collections: ${error.message}`);

  const rows = (data ?? []) as unknown as CollectionRow[];
  return Promise.all(rows.map(async (row) => {
    let image = "/images/textile-placeholder.svg";
    if (row.hero_image_path && row.hero_image_rights_confirmed) {
      const { data: signed } = await supabase.storage
        .from("product-media")
        .createSignedUrl(row.hero_image_path, 15 * 60);
      if (signed?.signedUrl) image = signed.signedUrl;
    }
    return { name: row.name, slug: row.slug, description: row.description, image };
  }));
}

export async function getStorefrontProduct(slug: string) {
  const products = await getStorefrontProducts();
  return products.find((product) => product.slug === slug) ?? null;
}

export function formatMoneyFromMinor(amountMinor: number, currency: string) {
  const formatter = new Intl.NumberFormat("en", { style: "currency", currency });
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits;
  return formatter.format(amountMinor / (10 ** fractionDigits));
}
