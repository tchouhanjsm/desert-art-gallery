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
    const canonicalSearch = serializeShopQuery(urlState, new URLSearchParams(searchParamsString));
    if (canonicalSearch !== searchParamsString) {
      router.replace(canonicalSearch ? pathname + "?" + canonicalSearch : pathname, { scroll: false });
    }
  }, [pathname, router, searchParamsString, urlState]);

  function updateUrl(nextState: ShopQueryState, history: "push" | "replace" = "replace") {
    const nextSearch = serializeShopQuery(nextState, new URLSearchParams(searchParamsString));
    const href = nextSearch ? pathname + "?" + nextSearch : pathname;
    if (history === "push") router.push(href, { scroll: false });
    else router.replace(href, { scroll: false });
  }

  const visible = useMemo(
    () => filterAndSortProducts(products, { q: query, category, sort }),
    [products, query, category, sort],
  );
  const hasActiveFilters = query.length > 0 || category !== ALL_SHOP_CATEGORY || sort !== "featured";

  function clearFilters() {
    setQuery("");
    setCategory(ALL_SHOP_CATEGORY);
    setSort("featured");
    updateUrl({ q: "", category: ALL_SHOP_CATEGORY, sort: "featured" }, "push");
  }

  return (
    <div className="atelier-shop-browser">
      <div className="shop-toolbar atelier-shop-toolbar">
        <span className="atelier-results-count" role="status" aria-live="polite">
          <strong>{visible.length.toLocaleString("en-IN")}</strong>
          <span>{visible.length.toLocaleString("en-IN")} products</span>
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
            placeholder="Search by product or keyword"
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
            {categories.map((item) => (
              <option key={item} value={item}>{item === ALL_SHOP_CATEGORY ? "All products" : item}</option>
            ))}
          </select>
          <label className="visually-hidden" htmlFor="shop-sort">Sort by</label>
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
            <button className="atelier-clear-filters" type="button" onClick={clearFilters}>Clear filters</button>
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
              {item === ALL_SHOP_CATEGORY ? "All products" : item}
            </button>
          ))}
        </div>
      )}

      {visible.length ? (
        <div className="atelier-product-grid">
          {visible.map((product) => <StorefrontProductCard key={product.slug} product={product} />)}
        </div>
      ) : (
        <div className="atelier-empty-catalogue">
          <span className="atelier-empty-mark" aria-hidden="true">✳</span>
          <h2>{products.length ? "No products matched your search" : "Catalogue in preparation"}</h2>
          <p>{products.length
            ? "Try another search term or clear your filters and try again."
            : "Products will be published as their details and media are approved. Contact us with questions about current availability."}</p>
          {hasActiveFilters
            ? <button className="button-outline" type="button" onClick={clearFilters}>Clear all filters</button>
            : <Link className="button-outline" href="/contact">Contact us</Link>}
        </div>
      )}
    </div>
  );
}
