"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { normalizeWishlistSlugs, toggleWishlistSlug } from "@/lib/wishlist";

type WishlistContextValue = { slugs: string[]; count: number; isSaved: (slug: string) => boolean; toggle: (slug: string) => void; remove: (slug: string) => void };
const WishlistContext = createContext<WishlistContextValue | null>(null);
const STORAGE_KEY = "desert-art-gallery:wishlist:v1";
const SYNCED_USER_STORAGE_KEY = "desert-art-gallery:wishlist-user:v1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function useWishlist() {
  const value = useContext(WishlistContext);
  if (!value) throw new Error("useWishlist must be used inside WishlistProvider.");
  return value;
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const syncedUserId = useRef<string | null>(null);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setSlugs(normalizeWishlistSlugs(JSON.parse(stored)));
      const storedUserId = window.localStorage.getItem(SYNCED_USER_STORAGE_KEY);
      syncedUserId.current = storedUserId && UUID_PATTERN.test(storedUserId) ? storedUserId : null;
    } catch { window.localStorage.removeItem(STORAGE_KEY); window.localStorage.removeItem(SYNCED_USER_STORAGE_KEY); }
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs)); }, [hydrated, slugs]);
  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/wishlist/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slugs, syncedUserId: syncedUserId.current }) });
        if (!response.ok) return;
        const data = await response.json();
        if (data.authenticated && Array.isArray(data.slugs)) {
          if (typeof data.userId === "string" && UUID_PATTERN.test(data.userId)) {
            syncedUserId.current = data.userId;
            window.localStorage.setItem(SYNCED_USER_STORAGE_KEY, data.userId);
          }
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
