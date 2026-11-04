"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, UserRound, Heart, ShoppingBag, Menu, X, ChevronDown } from "lucide-react";
import { useCart } from "@/components/CartProvider";
import { useWishlist } from "@/components/WishlistProvider";
import { primaryNavigation } from "@/lib/navigation";

export function Header({ collections = [] }: { collections?: { slug: string; name: string }[] }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const collectionsButtonRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!menuOpen && !collectionsOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      setCollectionsOpen(false);
      if (menuOpen) menuButtonRef.current?.focus();
      else collectionsButtonRef.current?.focus();
    }

    function handleOutsidePointer(event: PointerEvent) {
      if (!(event.target instanceof Node)) return;
      const insideNav = navRef.current?.contains(event.target) ?? false;
      const insideMenuButton = menuButtonRef.current?.contains(event.target) ?? false;
      if (!insideNav && !insideMenuButton) {
        setMenuOpen(false);
        setCollectionsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handleOutsidePointer);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handleOutsidePointer);
    };
  }, [menuOpen, collectionsOpen]);
  const { lineCount, openDrawer } = useCart();
  const { count: wishlistCount } = useWishlist();

  if (pathname.startsWith("/admin") || pathname.startsWith("/owner")) return null;

  function closeMenus() {
    setMenuOpen(false);
    setSearchOpen(false);
    setCollectionsOpen(false);
  }

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="announcement">DESERT ART GALLERY  |  JAISALMER, RAJASTHAN, INDIA</div>
      <header className="site-header jp-site-header">
        <div className="utility-row jp-utility-row">
          <Link href="/" className="wordmark jp-wordmark" aria-label="Desert Art Gallery home" onClick={closeMenus}>
            <span>DESERT ART GALLERY</span>
            <small>Textiles · Objects · Stories</small>
          </Link>

          <form id="site-search-form" className={searchOpen ? "header-search is-open" : "header-search"} action="/shop" role="search">
            <label className="visually-hidden" htmlFor="site-product-search">Search products</label>
            <Search size={17} aria-hidden="true" />
            <input id="site-product-search" name="q" type="search" maxLength={100} placeholder="Search products or keywords" />
            <button type="submit">Search</button>
          </form>

          <div className="utility-actions jp-utility-actions">
            <button
              className="icon-button jp-search-toggle"
              type="button"
              aria-label={searchOpen ? "Close search" : "Open search"}
              aria-expanded={searchOpen}
              aria-controls="site-search-form"
              onClick={() => { setSearchOpen((open) => !open); setMenuOpen(false); }}
            >
              {searchOpen ? <X size={19} /> : <Search size={19} />}
            </button>
            <Link className="icon-button" href="/account" aria-label="My account" onClick={closeMenus}>
              <UserRound size={19} />
            </Link>
            <Link className="icon-button wishlist-link" href="/wishlist" aria-label={"Wishlist · " + wishlistCount + " items"} onClick={closeMenus}>
              <Heart size={19} />
              {wishlistCount > 0 && <span className="wishlist-count">{wishlistCount}</span>}
            </Link>
            <button className="icon-button bag-link" type="button" onClick={() => { closeMenus(); openDrawer(); }} aria-label={"Cart · " + lineCount + " items"}>
              <ShoppingBag size={19} />
              <span className="bag-count">{lineCount}</span>
            </button>
            <button
              ref={menuButtonRef}
              className="icon-button mobile-menu-button"
              type="button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="primary-navigation"
              onClick={() => { setMenuOpen((open) => !open); setSearchOpen(false); }}
            >
              {menuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>

        <nav ref={navRef} id="primary-navigation" className={menuOpen ? "main-nav jp-main-nav open" : "main-nav jp-main-nav"} aria-label="Primary navigation">
          {primaryNavigation.map((item) => item.href === "/shop" && collections.length > 0 ? (
            <div className="jp-nav-collection" key={item.href}>
              <Link href={item.href} onClick={closeMenus}>{item.label}</Link>
              <button
                ref={collectionsButtonRef}
                className="jp-nav-disclosure"
                type="button"
                aria-label={collectionsOpen ? "Close collections" : "Browse collections"}
                aria-expanded={collectionsOpen}
                aria-controls="shop-category-panel"
                onClick={() => setCollectionsOpen((open) => !open)}
              >
                <ChevronDown size={13} aria-hidden="true" />
              </button>
              <div id="shop-category-panel" className={collectionsOpen ? "jp-nav-panel is-open" : "jp-nav-panel"}>
                <Link href="/shop" onClick={closeMenus} >Shop all products</Link>
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
