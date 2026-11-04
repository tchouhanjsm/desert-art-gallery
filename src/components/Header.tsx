"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Search, UserRound, Heart, ShoppingBag, Menu, X, ChevronDown } from "lucide-react";
import { useCart } from "@/components/CartProvider";
import { useWishlist } from "@/components/WishlistProvider";
import { primaryNavigation } from "@/lib/navigation";

export function Header({ collections = [] }: { collections?: { slug: string; name: string }[] }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { lineCount, openDrawer } = useCart();
  const { count: wishlistCount } = useWishlist();

  if (pathname.startsWith("/admin") || pathname.startsWith("/owner")) return null;

  function closeMenus() {
    setMenuOpen(false);
    setSearchOpen(false);
  }

  return (
    <>
      <a className="skip-link" href="#main-content">本文へスキップ</a>
      <div className="announcement">DESERT ART GALLERY　｜　ジャイサルメール、ラージャスターン州</div>
      <header className="site-header jp-site-header">
        <div className="utility-row jp-utility-row">
          <Link href="/" className="wordmark jp-wordmark" aria-label="Desert Art Gallery ホーム" onClick={closeMenus}>
            <span>DESERT ART GALLERY</span>
            <small>TEXTILES · OBJECTS · STORIES</small>
          </Link>

          <form id="site-search-form" className={searchOpen ? "header-search is-open" : "header-search"} action="/shop" role="search">
            <label className="visually-hidden" htmlFor="site-product-search">商品を検索</label>
            <Search size={17} aria-hidden="true" />
            <input id="site-product-search" name="q" type="search" maxLength={100} placeholder="商品名・キーワードで検索" />
            <button type="submit">検索</button>
          </form>

          <div className="utility-actions jp-utility-actions">
            <button
              className="icon-button jp-search-toggle"
              type="button"
              aria-label={searchOpen ? "検索を閉じる" : "検索を開く"}
              aria-expanded={searchOpen}
              aria-controls="site-search-form"
              onClick={() => { setSearchOpen((open) => !open); setMenuOpen(false); }}
            >
              {searchOpen ? <X size={19} /> : <Search size={19} />}
            </button>
            <Link className="icon-button" href="/account" aria-label="マイページ" onClick={closeMenus}>
              <UserRound size={19} />
            </Link>
            <Link className="icon-button wishlist-link" href="/wishlist" aria-label={"お気に入り " + wishlistCount + " 件"} onClick={closeMenus}>
              <Heart size={19} />
              {wishlistCount > 0 && <span className="wishlist-count">{wishlistCount}</span>}
            </Link>
            <button className="icon-button bag-link" type="button" onClick={() => { closeMenus(); openDrawer(); }} aria-label={"カート " + lineCount + " 点"}>
              <ShoppingBag size={19} />
              <span className="bag-count">{lineCount}</span>
            </button>
            <button
              className="icon-button mobile-menu-button"
              type="button"
              aria-label={menuOpen ? "メニューを閉じる" : "メニューを開く"}
              aria-expanded={menuOpen}
              aria-controls="primary-navigation"
              onClick={() => { setMenuOpen((open) => !open); setSearchOpen(false); }}
            >
              {menuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>

        <nav id="primary-navigation" className={menuOpen ? "main-nav jp-main-nav open" : "main-nav jp-main-nav"} aria-label="メインナビゲーション">
          {primaryNavigation.map((item) => item.href === "/shop" && collections.length > 0 ? (
            <div className="jp-nav-collection" key={item.href}>
              <Link href={item.href} onClick={closeMenus}>{item.label}</Link>
              <ChevronDown size={13} aria-hidden="true" />
              <div className="jp-nav-panel">
                <Link href="/shop" onClick={closeMenus}>すべての商品を見る</Link>
                {collections.map((collection) => (
                  <Link href={"/collections/" + collection.slug} key={collection.slug} onClick={closeMenus}>{collection.name}</Link>
                ))}
              </div>
            </div>
          ) : (
            <Link href={item.href} key={item.href} onClick={closeMenus}>{item.label}</Link>
          ))}
        </nav>
      </header>
    </>
  );
}
