"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatMoneyFromMinor } from "@/lib/money";
import type { Product } from "@/lib/products";
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

  function updateUrl(nextState: ShopQueryState) {
    const nextSearch = serializeShopQuery(
      nextState,
      new URLSearchParams(searchParamsString),
    );
    router.replace(nextSearch ? pathname + "?" + nextSearch : pathname, {
      scroll: false,
    });
  }

  const visible = useMemo(
    () => filterAndSortProducts(products, { q: query, category, sort }),
    [products, query, category, sort],
  );
  const hasActiveFilters =
    query.length > 0 || category !== ALL_SHOP_CATEGORY || sort !== "featured";

  return (
    <div>
      <div className="shop-toolbar">
        <span role="status" aria-live="polite">
          {visible.length} {visible.length === 1 ? "PIECE" : "PIECES"}
        </span>
        <div className="shop-controls">
          <label className="visually-hidden" htmlFor="shop-search">
            Search products
          </label>
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
            placeholder="Search published pieces…"
          />
          <label className="visually-hidden" htmlFor="shop-category">
            Filter by category
          </label>
          <select
            id="shop-category"
            value={category}
            onChange={(event) => {
              const nextCategory = event.currentTarget.value;
              setCategory(nextCategory);
              updateUrl({ q: query, category: nextCategory, sort });
            }}
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <label className="visually-hidden" htmlFor="shop-sort">
            Sort products
          </label>
          <select
            id="shop-sort"
            value={sort}
            onChange={(event) => {
              const nextSort = event.currentTarget.value as ShopSort;
              setSort(nextSort);
              updateUrl({ q: query, category, sort: nextSort });
            }}
          >
            <option value="featured">Featured</option>
            <option value="name">Name</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
          </select>
          {hasActiveFilters && (
            <button
              className="text-link"
              type="button"
              onClick={() => {
                setQuery("");
                setCategory(ALL_SHOP_CATEGORY);
                setSort("featured");
                updateUrl({
                  q: "",
                  category: ALL_SHOP_CATEGORY,
                  sort: "featured",
                });
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>
      {visible.length ? (
        <div className="product-grid">
          {visible.map((product) => (
            <article className="product-card" key={product.slug}>
              <Link href={"/products/" + product.slug}>
                <div className="product-image-wrap">
                  <Image
                    src={product.image}
                    alt={product.imageAlt}
                    fill
                    sizes="(max-width:700px) 48vw, 24vw"
                    unoptimized
                  />
                </div>
                <div className="product-meta">
                  <div className="product-category">{product.category}</div>
                  <h2 className="product-name">{product.name}</h2>
                  <div className="product-note">{product.note}</div>
                  <div className="product-price">
                    {product.priceMinor != null && product.currency
                      ? formatMoneyFromMinor(product.priceMinor, product.currency)
                      : "PRICE ON ENQUIRY"}
                  </div>
                  <div className="product-availability">
                    {product.quantityOnHand === 0 && product.id
                      ? "CURRENTLY UNAVAILABLE"
                      : "ENQUIRE FOR DETAILS"}
                  </div>
                </div>
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-note">
          {products.length
            ? "No published pieces match these filters. Try a different search or category."
            : "No pieces are currently published online. Contact the gallery for current availability."}
          <div className="center-action">
            <Link className="text-link" href="/contact">
              CONTACT THE GALLERY ↗
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
