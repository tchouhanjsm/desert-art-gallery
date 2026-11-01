"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { normalizeWishlistSlugs, toggleWishlistSlug } from "@/lib/wishlist";

type WishlistContextValue = { slugs: string[]; count: number; isSaved: (slug: string) => boolean; toggle: (slug: string) => void; remove: (slug: string) => void };
const WishlistContext = createContext<WishlistContextValue | null>(null);
const STORAGE_KEY = "desert-art-gallery:wishlist:v1";

export function useWishlist() {
  const value = useContext(WishlistContext);
  if (!value) throw new Error("useWishlist must be used inside WishlistProvider.");
  return value;
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setSlugs(normalizeWishlistSlugs(JSON.parse(stored)));
    } catch { window.localStorage.removeItem(STORAGE_KEY); }
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs)); }, [hydrated, slugs]);
  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/wishlist/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slugs }) });
        if (!response.ok) return;
        const data = await response.json();
        if (data.authenticated && Array.isArray(data.slugs)) {
          const merged = normalizeWishlistSlugs(data.slugs);
          if (JSON.stringify(merged) !== JSON.stringify(slugs)) setSlugs(merged);
        }
      } catch { /* Keep the local wishlist available while offline. */ }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [hydrated, slugs]);
  const toggle = useCallback((slug: string) => setSlugs((current) => toggleWishlistSlug(current, slug)), []);
  const remove = useCallback((slug: string) => setSlugs((current) => current.filter((item) => item !== slug)), []);
  const isSaved = useCallback((slug: string) => slugs.includes(slug), [slugs]);
  const value = useMemo(() => ({ slugs, count: slugs.length, isSaved, toggle, remove }), [slugs, isSaved, toggle, remove]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}
