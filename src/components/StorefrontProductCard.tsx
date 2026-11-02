"use client";

import Image from "next/image";
import Link from "next/link";
import { formatMoneyFromMinor } from "@/lib/money";
import type { Product } from "@/lib/products";

export function StorefrontProductCard({ product }: { product: Product }) {
  const price = product.priceMinor != null && product.currency
    ? formatMoneyFromMinor(product.priceMinor, product.currency)
    : "Price on enquiry";

  return (
    <article className="atelier-product-card">
      <Link className="atelier-product-link" href={"/products/" + product.slug}>
        <div className="atelier-product-media">
          <Image
            src={product.image}
            alt={product.imageAlt}
            fill
            sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 23vw"
            unoptimized
          />
          {!product.id && <span className="atelier-preview-label">Preview artwork</span>}
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
