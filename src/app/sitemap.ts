import type { MetadataRoute } from "next";
import { getStorefrontCollections, getStorefrontProducts } from "@/lib/catalogue";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl().origin;
  const [collections, products] = await Promise.all([
    getStorefrontCollections(),
    getStorefrontProducts(),
  ]);

  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/shop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/story`, changeFrequency: "monthly", priority: 0.7 },
    ...collections.map((collection) => ({
      url: `${base}/collections/${collection.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...products
      .filter((product) => Boolean(product.id?.trim()))
      .map((product) => ({
        url: `${base}/products/${product.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
  ];
}
