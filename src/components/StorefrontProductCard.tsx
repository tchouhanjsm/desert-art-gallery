import Image from "next/image";
import Link from "next/link";
import { formatMoneyFromMinor } from "@/lib/money";
import type { Product } from "@/lib/products";
import { PreviewArtwork } from "@/components/PreviewArtwork";

function previewVariant(category: string): "textile" | "embroidered" | "object" | "heritage" {
  const value = category.toLowerCase();
  if (value.includes("banjara") || value.includes("tribal")) return "embroidered";
  if (value.includes("mukka") || value.includes("zari")) return "object";
  if (value.includes("vintage") || value.includes("nomadic")) return "heritage";
  return "textile";
}

export function StorefrontProductCard({ product }: { product: Product }) {
  const isPreview = !product.id;
  const price = product.priceMinor != null && product.currency
    ? formatMoneyFromMinor(product.priceMinor, product.currency)
    : "Price on enquiry";

  return (
    <article className="atelier-product-card">
      <Link className="atelier-product-link" href={"/products/" + product.slug}>
        <div className="atelier-product-media">
          {isPreview ? (
            <PreviewArtwork
              title={product.name}
              category={product.category}
              variant={previewVariant(product.category)}
            />
          ) : (
            <Image
              src={product.image}
              alt={product.imageAlt}
              fill
              sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 23vw"
              unoptimized
            />
          )}
          {isPreview && <span className="atelier-preview-label">Photography pending</span>}
          <span className="atelier-product-open" aria-hidden="true">↗</span>
        </div>
        <div className="atelier-product-meta">
          {product.category && <span className="atelier-product-category">{product.category}</span>}
          <h3>{product.name}</h3>
          {product.note && <p>{product.note}</p>}
          <div className="atelier-product-bottom">
            <span className="atelier-product-price">{price}</span>
            <span className="atelier-product-action">View piece</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
