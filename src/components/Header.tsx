"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Search, UserRound, Heart, ShoppingBag, Menu, X } from "lucide-react";
import { useCart } from "@/components/CartProvider";
import { useWishlist } from "@/components/WishlistProvider";
import { primaryNavigation } from "@/lib/navigation";

export function Header({ collections = [] }: { collections?: { slug: string; name: string }[] }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { lineCount, openDrawer } = useCart();
  const { count: wishlistCount } = useWishlist();

  if (pathname.startsWith("/admin")) return null;

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="announcement">TEXTILES · OBJECTS · STORIES · JAISALMER, RAJASTHAN</div>
      <header className="site-header">
        <div className="utility-row">
          <button
            className="icon-button search-toggle"
            type="button"
            aria-label={searchOpen ? "Close product search" : "Open product search"}
            aria-expanded={searchOpen}
            aria-controls="site-search-panel"
            onClick={() => {
              setSearchOpen((open) => !open);
              setMenuOpen(false);
            }}
          >
            {searchOpen ? <X size={19} /> : <Search size={19} />}
          </button>

          <Link href="/" className="wordmark" aria-label="Desert Art Gallery home">
            <span>DESERT ART GALLERY</span>
            <small>TEXTILES · OBJECTS · STORIES</small>
          </Link>

          <div className="utility-actions">
            <Link className="icon-button" href="/account" aria-label="Account">
              <UserRound size={19} />
            </Link>
            <Link className="icon-button wishlist-link" href="/wishlist" aria-label={"Wishlist, " + wishlistCount + " saved pieces"}>
              <Heart size={19} />
              {wishlistCount > 0 && <span className="wishlist-count">{wishlistCount}</span>}
            </Link>
            <button className="icon-button bag-link" type="button" onClick={openDrawer} aria-label={"Shopping bag, " + lineCount + " items"}>
              <ShoppingBag size={19} />
              <span className="bag-count">{lineCount}</span>
            </button>
            <button
              className="icon-button mobile-menu-button"
              type="button"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={menuOpen}
              aria-controls="primary-navigation"
              onClick={() => {
                setMenuOpen((open) => !open);
                setSearchOpen(false);
              }}
            >
              {menuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>

        {searchOpen && (
          <form id="site-search-panel" className="search-panel" action="/shop" role="search">
            <label className="visually-hidden" htmlFor="site-product-search">Search the shop</label>
            <input id="site-product-search" name="q" type="search" placeholder="Search published pieces…" />
            <button type="submit">SEARCH</button>
          </form>
        )}

        <nav id="primary-navigation" className={menuOpen ? "main-nav open" : "main-nav"} aria-label="Primary navigation">
          {primaryNavigation.map((item) => item.href === "/shop" && collections.length > 0 ? (
            <div className="nav-mega" key={item.href}>
              <Link href={item.href} onClick={() => setMenuOpen(false)}>{item.label}</Link>
              <div className="nav-mega-panel">
                <div>
                  <span className="nav-mega-title">Collections</span>
                  {collections.map((c) => (
                    <Link href={"/collections/" + c.slug} key={c.slug} onClick={() => setMenuOpen(false)}>{c.name}</Link>
                  ))}
                </div>
                <div>
                  <span className="nav-mega-title">Browse</span>
                  <Link href="/shop" onClick={() => setMenuOpen(false)}>All pieces</Link>
                  <Link href="/artisans" onClick={() => setMenuOpen(false)}>Meet the makers</Link>
                  <Link href="/journal" onClick={() => setMenuOpen(false)}>Journal</Link>
                </div>
              </div>
            </div>
          ) : (
            <Link href={item.href} key={item.href} onClick={() => setMenuOpen(false)}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}
