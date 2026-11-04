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
          <strong>{visible.length.toLocaleString("ja-JP")}</strong>
          <span>{visible.length.toLocaleString("ja-JP")}件の商品</span>
        </span>
        <div className="shop-controls atelier-shop-controls">
          <label className="visually-hidden" htmlFor="shop-search">商品を検索</label>
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
            placeholder="商品名・キーワードで検索"
          />
          <label className="visually-hidden" htmlFor="shop-category">カテゴリーで絞り込む</label>
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
              <option key={item} value={item}>{item === ALL_SHOP_CATEGORY ? "すべての商品" : item}</option>
            ))}
          </select>
          <label className="visually-hidden" htmlFor="shop-sort">並び替え</label>
          <select
            id="shop-sort"
            value={sort}
            onChange={(event) => {
              const nextSort = event.currentTarget.value as ShopSort;
              setSort(nextSort);
              updateUrl({ q: query, category, sort: nextSort }, "push");
            }}
          >
            <option value="featured">おすすめ順</option>
            <option value="name">商品名順</option>
            <option value="price-low">価格の安い順</option>
            <option value="price-high">価格の高い順</option>
          </select>
          {hasActiveFilters && (
            <button className="atelier-clear-filters" type="button" onClick={clearFilters}>条件をクリア</button>
          )}
        </div>
      </div>

      {categories.length > 2 && (
        <div className="shop-chips" role="group" aria-label="カテゴリーで絞り込む">
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
              {item === ALL_SHOP_CATEGORY ? "すべての商品" : item}
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
          <h2>{products.length ? "該当する商品が見つかりませんでした" : "商品を準備しています"}</h2>
          <p>{products.length
            ? "検索語を変えるか、絞り込み条件を解除してもう一度お試しください。"
            : "掲載準備が整った商品から順次公開します。現在の取り扱いについてはお問い合わせください。"}</p>
          {hasActiveFilters
            ? <button className="button-outline" type="button" onClick={clearFilters}>すべての条件を解除</button>
            : <Link className="button-outline" href="/contact">お問い合わせ</Link>}
        </div>
      )}
    </div>
  );
}
