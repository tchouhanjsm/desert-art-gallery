"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/products";
import { StorefrontProductCard } from "@/components/StorefrontProductCard";
import {
  ALL_SHOP_CATEGORY,
  filterAndSortProducts,
  getShopCategories,
  parseShopQuery,
  serializeShopQuery,
  type ShopQueryState,
  type ShopSort,
} from "@/lib/shop-query";

export function ShopBrowser({ products }: { products: Product[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();

  const categories = useMemo(() => getShopCategories(products), [products]);
  const urlState = useMemo(
    () => parseShopQuery(new URLSearchParams(searchParamsString), categories),
    [categories, searchParamsString],
  );

  const [query, setQuery] = useState(urlState.q);
  const [category, setCategory] = useState(urlState.category);
  const [sort, setSort] = useState<ShopSort>(urlState.sort);

  useEffect(() => {
    setQuery(urlState.q);
    setCategory(urlState.category);
    setSort(urlState.sort);

    const canonicalSearch = serializeShopQuery(
      urlState,
      new URLSearchParams(searchParamsString),
    );
    if (canonicalSearch !== searchParamsString) {
      router.replace(
        canonicalSearch ? pathname + "?" + canonicalSearch : pathname,
        { scroll: false },
      );
    }
  }, [pathname, router, searchParamsString, urlState]);

  function updateUrl(
    nextState: ShopQueryState,
    history: "push" | "replace" = "replace",
  ) {
    const nextSearch = serializeShopQuery(
      nextState,
      new URLSearchParams(searchParamsString),
    );
    const href = nextSearch ? pathname + "?" + nextSearch : pathname;
    if (history === "push") {
      router.push(href, { scroll: false });
    } else {
      router.replace(href, { scroll: false });
    }
  }

  const visible = useMemo(
    () => filterAndSortProducts(products, { q: query, category, sort }),
    [products, query, category, sort],
  );
  const hasActiveFilters =
    query.length > 0 || category !== ALL_SHOP_CATEGORY || sort !== "featured";

  return (
    <div className="atelier-shop-browser">
      <div className="shop-toolbar atelier-shop-toolbar">
        <span className="atelier-results-count" role="status" aria-live="polite">
          <strong>{visible.length.toString().padStart(2, "0")}</strong>
          <span>{visible.length === 1 ? "PIECE" : "PIECES"} IN THE GALLERY</span>
        </span>
        <div className="shop-controls atelier-shop-controls">
          <label className="visually-hidden" htmlFor="shop-search">Search products</label>
          <input
            id="shop-search"
            type="search"
            maxLength={100}
            value={query}
            onChange={(event) => {
              const nextQuery = event.currentTarget.value;
              setQuery(nextQuery);
              updateUrl({ q: nextQuery, category, sort });
            }}
            placeholder="Search the gallery…"
          />
          <label className="visually-hidden" htmlFor="shop-category">Filter by category</label>
          <select
            id="shop-category"
            value={category}
            onChange={(event) => {
              const nextCategory = event.currentTarget.value;
              setCategory(nextCategory);
              updateUrl({ q: query, category: nextCategory, sort }, "push");
            }}
          >
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <label className="visually-hidden" htmlFor="shop-sort">Sort products</label>
          <select
            id="shop-sort"
            value={sort}
            onChange={(event) => {
              const nextSort = event.currentTarget.value as ShopSort;
              setSort(nextSort);
              updateUrl({ q: query, category, sort: nextSort }, "push");
            }}
          >
            <option value="featured">Featured</option>
            <option value="name">Name</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
          </select>
          {hasActiveFilters && (
            <button
              className="atelier-clear-filters"
              type="button"
              onClick={() => {
                setQuery("");
                setCategory(ALL_SHOP_CATEGORY);
                setSort("featured");
                updateUrl({ q: "", category: ALL_SHOP_CATEGORY, sort: "featured" }, "push");
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>
      {categories.length > 2 && (
        <div className="shop-chips" role="group" aria-label="Filter by category">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              className="shop-chip"
              aria-pressed={category === item}
              onClick={() => {
                setCategory(item);
                updateUrl({ q: query, category: item, sort }, "push");
              }}
            >
              {item}
            </button>
          ))}
        </div>
      )}
      {visible.length ? (
        <div className="atelier-product-grid">
          {visible.map((product) => (
            <StorefrontProductCard key={product.slug} product={product} />
          ))}
        </div>
      ) : (
        <div className="atelier-empty-catalogue">
          <span className="atelier-empty-mark" aria-hidden="true">✳</span>
          <h2>{products.length ? "No pieces found." : "The next collection is taking shape."}</h2>
          <p>{products.length
            ? "Try another search or remove one of the selected filters."
            : "No pieces are currently published online. Contact the gallery for current availability."}</p>
          {hasActiveFilters
            ? <button className="button-outline" type="button" onClick={() => {
                setQuery("");
                setCategory(ALL_SHOP_CATEGORY);
                setSort("featured");
                updateUrl({ q: "", category: ALL_SHOP_CATEGORY, sort: "featured" }, "push");
              }}>Clear all filters</button>
            : <Link className="button-outline" href="/contact">Contact the gallery</Link>}
        </div>
      )}
    </div>
  );
}
