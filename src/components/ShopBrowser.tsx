"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatMoneyFromMinor } from "@/lib/catalogue";
import type { Product } from "@/lib/products";

export function ShopBrowser({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All pieces");
  const [sort, setSort] = useState("featured");
  const categories = useMemo(() => ["All pieces", ...Array.from(new Set(products.map((p) => p.category))).sort()], [products]);

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filtered = products.filter((product) =>
      (category === "All pieces" || product.category === category) &&
      (!normalizedQuery || [product.name, product.category, product.note].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)))
    );
    return filtered.sort((a, b) => {
      if (sort === "price-low") return (a.priceMinor ?? Number.MAX_SAFE_INTEGER) - (b.priceMinor ?? Number.MAX_SAFE_INTEGER);
      if (sort === "price-high") return (b.priceMinor ?? -1) - (a.priceMinor ?? -1);
      if (sort === "name") return a.name.localeCompare(b.name);
      return Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || a.name.localeCompare(b.name);
    });
  }, [products, query, category, sort]);

  return <div>
    <div className="shop-toolbar">
      <span>{visible.length} PIECES</span>
      <div className="shop-controls">
        <label className="visually-hidden" htmlFor="shop-search">Search products</label>
        <input id="shop-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pieces…" />
        <label className="visually-hidden" htmlFor="shop-category">Filter by collection</label>
        <select id="shop-category" value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <label className="visually-hidden" htmlFor="shop-sort">Sort products</label>
        <select id="shop-sort" value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="featured">Featured</option>
          <option value="name">Name</option>
          <option value="price-low">Price: low to high</option>
          <option value="price-high">Price: high to low</option>
        </select>
      </div>
    </div>
    {visible.length ? <div className="product-grid">{visible.map((product) => <article className="product-card" key={product.slug}>
      <Link href={`/products/${product.slug}`}>
        <div className="product-image-wrap"><Image src={product.image} alt={product.imageAlt} fill sizes="(max-width:700px) 48vw, 24vw" unoptimized/></div>
        <div className="product-meta">
          <div className="product-category">{product.category}</div>
          <h2 className="product-name">{product.name}</h2>
          <div className="product-note">{product.note}</div>
          <div className="product-price">{product.priceMinor != null && product.currency ? formatMoneyFromMinor(product.priceMinor, product.currency) : "PRICE ON ENQUIRY"}</div>
          <div className="product-availability">{product.quantityOnHand === 0 && product.id ? "CURRENTLY UNAVAILABLE" : "ENQUIRE FOR DETAILS"}</div>
        </div>
      </Link>
    </article>)}</div> : <div className="empty-note">{products.length ? "No pieces match these filters. Try a different search or collection." : "The collection is being curated. Please contact us for current availability."}</div>}
  </div>;
}
