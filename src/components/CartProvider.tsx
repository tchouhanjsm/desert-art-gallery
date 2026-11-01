"use client";

import Image from "next/image";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { formatMoneyFromMinor } from "@/lib/money";
import { mergeCartLine, normalizeCartLines, setCartLineQuantity, type CartLine } from "@/lib/cart";

type CartPreviewItem = {
  slug: string; name: string; quantityRequested: number; availableQuantity: number;
  available: boolean; priceMinor: number | null; currency: string | null; image: string | null; imageAlt: string;
};
type CartContextValue = {
  lines: CartLine[]; preview: CartPreviewItem[]; lineCount: number; isLoading: boolean; error: string;
  drawerOpen: boolean; addItem: (slug: string, maximum: number) => void; removeItem: (slug: string) => void;
  setQuantity: (slug: string, quantity: number) => void; openDrawer: () => void; closeDrawer: () => void;
};
const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "desert-art-gallery:bag:v1";

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider.");
  return value;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [preview, setPreview] = useState<CartPreviewItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setLines(normalizeCartLines(JSON.parse(stored)));
    } catch { window.localStorage.removeItem(STORAGE_KEY); }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [hydrated, lines]);

  const refresh = useCallback(async (currentLines: CartLine[]) => {
    if (!currentLines.length) { setPreview([]); setError(""); return; }
    setIsLoading(true);
    try {
      const response = await fetch("/api/cart/preview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: currentLines }), cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to refresh the bag.");
      setPreview(Array.isArray(result.items) ? result.items as CartPreviewItem[] : []);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to refresh the bag.");
      setPreview([]);
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { if (hydrated) void refresh(lines); }, [hydrated, lines, refresh]);

  const addItem = useCallback((slug: string, maximum: number) => {
    if (maximum < 1) { setError("This piece is currently unavailable."); return; }
    setLines((current) => mergeCartLine(current, slug, 1, Math.min(99, maximum)));
    setDrawerOpen(true);
  }, []);
  const removeItem = useCallback((slug: string) => setLines((current) => current.filter((line) => line.slug !== slug)), []);
  const setQuantity = useCallback((slug: string, quantity: number) => setLines((current) => setCartLineQuantity(current, slug, quantity)), []);
  const openDrawer = useCallback(() => { setDrawerOpen(true); if (hydrated) void refresh(lines); }, [hydrated, lines, refresh]);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const lineCount = useMemo(() => lines.reduce((total, line) => total + line.quantity, 0), [lines]);

  const value: CartContextValue = { lines, preview, lineCount, isLoading, error, drawerOpen, addItem, removeItem, setQuantity, openDrawer, closeDrawer };
  return <CartContext.Provider value={value}>{children}<CartDrawer /></CartContext.Provider>;
}

function CartDrawer() {
  const { lines, preview, isLoading, error, drawerOpen, closeDrawer, removeItem, setQuantity } = useCart();
  if (!drawerOpen) return null;
  const totals: Record<string, number> = {};
  for (const item of preview) {
    if (item.priceMinor !== null && item.currency) totals[item.currency] = (totals[item.currency] ?? 0) + item.priceMinor * item.quantityRequested;
  }
  return <div className="cart-overlay" role="presentation" onClick={closeDrawer}>
    <aside className="cart-drawer" role="dialog" aria-modal="true" aria-label="Shopping bag" onClick={(event) => event.stopPropagation()}>
      <div className="cart-drawer-header"><div><div className="section-kicker">YOUR SELECTION</div><h2>Your bag</h2></div><button className="icon-button" onClick={closeDrawer} aria-label="Close shopping bag">×</button></div>
      {isLoading && <p className="cart-state">Refreshing current product and stock details…</p>}
      {error && <p className="cart-error" role="status">{error}</p>}
      {!lines.length ? <div className="empty-note">Your bag is waiting for its first piece.<br/><Link href="/shop" className="empty-link" onClick={closeDrawer}>EXPLORE THE COLLECTION ↗</Link></div> :
        <div className="cart-drawer-lines">{preview.map((item) => <article className="cart-line" key={item.slug}>
          {item.image ? <Image src={item.image} alt={item.imageAlt} width={88} height={116} unoptimized /> : <div className="cart-line-placeholder" aria-hidden="true" />}
          <div className="cart-line-details"><h3>{item.name}</h3>
            {item.priceMinor !== null && item.currency ? <p>{formatMoneyFromMinor(item.priceMinor, item.currency)}</p> : <p>Price unavailable</p>}
            <div className="cart-quantity"><button aria-label="Decrease quantity" onClick={() => setQuantity(item.slug, item.quantityRequested - 1)}>−</button><span>{item.quantityRequested}</span><button aria-label="Increase quantity" disabled={item.quantityRequested >= item.availableQuantity} onClick={() => setQuantity(item.slug, item.quantityRequested + 1)}>+</button><button className="cart-remove" onClick={() => removeItem(item.slug)}>REMOVE</button></div>
            {!item.available && <small className="cart-error">Only {item.availableQuantity} currently available. Please adjust this line.</small>}
          </div>
        </article>)}</div>}
      {!!Object.keys(totals).length && <div className="cart-drawer-total"><span>ITEM SUBTOTAL</span><strong>{Object.entries(totals).map(([currency, amount]) => formatMoneyFromMinor(amount, currency)).join(" · ")}</strong></div>}
      <div className="cart-drawer-footer"><Link href="/cart" className="button-primary dark-button" onClick={closeDrawer}>VIEW YOUR BAG</Link><p>Shipping and taxes are not included. Checkout activates after payment and delivery configuration is complete.</p></div>
    </aside>
  </div>;
}
