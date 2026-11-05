import Link from "next/link";
import { StorefrontImage } from "@/components/StorefrontImage";
import { galleryBlurDataUrl } from "@/lib/image";
import { formatMoneyFromMinor } from "@/lib/money";
import type { Product } from "@/lib/products";
import { StorefrontMediaPlaceholder } from "@/components/StorefrontMediaPlaceholder";
import { WishlistToggle } from "@/components/WishlistToggle";
import { getProductCardFacts, hasPurchasableProductOption, isPublishedProductRecord } from "@/lib/storefront-presentation";


export function StorefrontProductCard({ product }: { product: Product }) {
  const isPreview = !isPublishedProductRecord(product);
  const facts = getProductCardFacts(product);
  const purchasable = hasPurchasableProductOption(product);
  const price = product.priceMinor != null && product.currency
    ? formatMoneyFromMinor(product.priceMinor, product.currency)
    : "Price on request";

  return (
    <article className="atelier-product-card">
      {isPublishedProductRecord(product) && (
        <div className="atelier-product-card-wishlist">
          <WishlistToggle slug={product.slug} compact />
        </div>
      )}
      <Link className="atelier-product-link" href={"/products/" + product.slug}>
        <div className="atelier-product-media">
          {isPreview ? (
<StorefrontMediaPlaceholder variant="product" label={"Photography pending for " + product.name} caption="PHOTOGRAPHY PENDING" />
          ) : (
            <StorefrontImage
              placeholder="blur"
              blurDataURL={galleryBlurDataUrl}
              src={product.image}
              alt={product.imageAlt || product.name}
              fill
              sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 23vw"
            />
          )}
          {isPreview && <span className="atelier-preview-label">PREVIEW · NOT FOR SALE</span>}
          <span className="atelier-product-open" aria-hidden="true">↗</span>
        </div>
        <div className="atelier-product-meta">
          {product.category && <span className="atelier-product-category">{product.category}</span>}
          <h3>{product.name}</h3>
          {product.note && <p>{product.note}</p>}
          {facts.length > 0 && (
            <ul className="atelier-product-facts" aria-label="Product details">
              {facts.map((fact) => <li key={fact}>{fact}</li>)}
            </ul>
          )}
          <div className="atelier-product-bottom">
            <span className="atelier-product-price">{price}</span>
            <span className="atelier-product-action">{purchasable ? "View & buy" : "View details"}</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
