import Image from "next/image";
import Link from "next/link";
import { galleryBlurDataUrl } from "@/lib/image";
import { formatMoneyFromMinor } from "@/lib/money";
import type { Product } from "@/lib/products";
import { PreviewArtwork } from "@/components/PreviewArtwork";
import { WishlistToggle } from "@/components/WishlistToggle";

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
    : "価格はお問い合わせください";

  return (
    <article className="atelier-product-card">
      {product.id && (
        <div className="atelier-product-card-wishlist">
          <WishlistToggle slug={product.slug} compact />
        </div>
      )}
      <Link className="atelier-product-link" href={"/products/" + product.slug}>
        <div className="atelier-product-media">
          {isPreview ? (
            <PreviewArtwork title={product.name} category={product.category} variant={previewVariant(product.category)} />
          ) : (
            <Image
              placeholder="blur"
              blurDataURL={galleryBlurDataUrl}
              src={product.image}
              alt={product.imageAlt || product.name}
              fill
              sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 23vw"
            />
          )}
          {isPreview && <span className="atelier-preview-label">商品写真を準備中</span>}
          <span className="atelier-product-open" aria-hidden="true">↗</span>
        </div>
        <div className="atelier-product-meta">
          {product.category && <span className="atelier-product-category">{product.category}</span>}
          <h3>{product.name}</h3>
          {product.note && <p>{product.note}</p>}
          <div className="atelier-product-bottom">
            <span className="atelier-product-price">{price}</span>
            <span className="atelier-product-action">商品を見る</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
