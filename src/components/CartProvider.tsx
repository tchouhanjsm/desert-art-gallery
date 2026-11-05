"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { formatMoneyFromMinor } from "@/lib/money";
import { cartLineKey, mergeCartLine, normalizeCartLines, setCartLineQuantity, type CartLine } from "@/lib/cart";
import { StorefrontImage } from "@/components/StorefrontImage";
import { formatCartFallbackName, getCartDisplayRows, type CartPreviewItem } from "@/lib/cart-presentation";

type CartContextValue = {
  lines: CartLine[]; preview: CartPreviewItem[]; lineCount: number; isLoading: boolean; error: string;
  drawerOpen: boolean; addItem: (slug: string, maximum: number, variantId?: string) => void;
  removeItem: (slug: string, variantId?: string) => void;
  setQuantity: (slug: string, quantity: number, variantId?: string) => void;
  openDrawer: () => void; closeDrawer: () => void;
};
const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "desert-art-gallery:bag:v1";
const SYNCED_USER_STORAGE_KEY = "desert-art-gallery:bag-user:v1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider.");
  return value;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [preview, setPreview] = useState<CartPreviewItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const syncSequence = useRef(0);
  const syncedUserId = useRef<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setLines(normalizeCartLines(JSON.parse(stored)));
      const storedUserId = window.localStorage.getItem(SYNCED_USER_STORAGE_KEY);
      syncedUserId.current = storedUserId && UUID_PATTERN.test(storedUserId) ? storedUserId : null;
    } catch { window.localStorage.removeItem(STORAGE_KEY); window.localStorage.removeItem(SYNCED_USER_STORAGE_KEY); }
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
      if (!response.ok) throw new Error(result.error || "Could not update your bag. Please try again.");
      setPreview(Array.isArray(result.items) ? result.items as CartPreviewItem[] : []);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update your bag. Please try again.");
      setPreview([]);
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { if (hydrated) void refresh(lines); }, [hydrated, lines, refresh]);

  useEffect(() => {
    if (!hydrated) return;
    const sequence = ++syncSequence.current;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/cart/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lines, syncedUserId: syncedUserId.current }),
        });
        if (!response.ok) return;
        const result = await response.json();
        if (sequence !== syncSequence.current || !result.authenticated || !Array.isArray(result.lines) || typeof result.userId !== "string") return;
        syncedUserId.current = result.userId;
        window.localStorage.setItem(SYNCED_USER_STORAGE_KEY, result.userId);
        const merged = normalizeCartLines(result.lines);
        if (JSON.stringify(merged) !== JSON.stringify(lines)) setLines(merged);
      } catch {
        // Keep the guest bag intact when an account sync is unavailable.
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [hydrated, lines, pathname]);

  const addItem = useCallback((slug: string, maximum: number, variantId?: string) => {
    if (maximum < 1) { setError("This item is currently unavailable."); return; }
    setLines((current) => mergeCartLine(current, slug, 1, Math.min(99, maximum), variantId));
    setDrawerOpen(true);
  }, []);
  const removeItem = useCallback((slug: string, variantId?: string) => setLines((current) =>
    current.filter((line) => cartLineKey(line.slug, line.variantId) !== cartLineKey(slug, variantId))), []);
  const setQuantity = useCallback((slug: string, quantity: number, variantId?: string) => setLines((current) =>
    setCartLineQuantity(current, slug, quantity, variantId)), []);
  const openDrawer = useCallback(() => { setDrawerOpen(true); if (hydrated) void refresh(lines); }, [hydrated, lines, refresh]);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const lineCount = useMemo(() => lines.reduce((total, line) => total + line.quantity, 0), [lines]);

  const value: CartContextValue = { lines, preview, lineCount, isLoading, error, drawerOpen, addItem, removeItem, setQuantity, openDrawer, closeDrawer };
  return <CartContext.Provider value={value}>{children}<CartDrawer /></CartContext.Provider>;
}

function CartDrawer() {
  const { lines, preview, isLoading, error, drawerOpen, closeDrawer, removeItem, setQuantity } = useCart();
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const rows = getCartDisplayRows(lines, preview);
  const totals: Record<string, number> = {};
  for (const { line, item } of rows) {
    if (item?.priceMinor !== null && item?.priceMinor !== undefined && item.currency) {
      totals[item.currency] = (totals[item.currency] ?? 0) + item.priceMinor * line.quantity;
    }
  }

  useEffect(() => {
    if (!drawerOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      const focusIsInside = dialogRef.current?.contains(activeElement) ?? false;
      if (event.shiftKey && (activeElement === first || !focusIsInside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || !focusIsInside)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [drawerOpen, closeDrawer]);

  if (!drawerOpen) return null;

  return (
    <div
      className="cart-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDrawer();
      }}
    >
      <aside
        ref={dialogRef}
        className="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        tabIndex={-1}
      >
        <div className="cart-drawer-header">
          <div>
            <div className="section-kicker">YOUR BAG</div>
            <h2 id="cart-drawer-title">Your bag</h2>
          </div>
          <button ref={closeButtonRef} className="icon-button" type="button" onClick={closeDrawer} aria-label="Close shopping bag">×</button>
        </div>
        {isLoading && <p className="cart-state" role="status">Checking product details and availability…</p>}
        {error && <p className="cart-error" role="alert">{error}</p>}
        {!lines.length ? (
          <div className="empty-note">Your bag is empty.<br /><Link href="/shop" className="empty-link" onClick={closeDrawer}>Continue shopping</Link></div>
        ) : (
          <div className="cart-drawer-lines">
            {rows.map(({ line, item }) => {
              const name = item?.name ?? formatCartFallbackName(line.slug);
              const imageAlt = item?.imageAlt?.trim() || (item ? name : "Product image pending review");
              return (
                <article className="cart-line" key={cartLineKey(line.slug, line.variantId)}>
                  <div className="cart-line-media cart-line-media--compact">
                    {item?.image ? (
                      <StorefrontImage src={item.image} alt={imageAlt} fill sizes="80px" />
                    ) : (
                      <div className="cart-line-placeholder" role="img" aria-label={"Product image pending review for " + name}>
                        <span>Image pending review</span>
                      </div>
                    )}
                  </div>
                  <div className="cart-line-details">
                    <h3>{name}</h3>
                    {item?.variantLabel && <p className="cart-variant-label">{item.variantLabel}</p>}
                    {item ? (
                      <p>{item.priceMinor !== null && item.currency ? formatMoneyFromMinor(item.priceMinor, item.currency) : "Price unavailable"}</p>
                    ) : (
                      <p className="cart-preview-pending">Product details are being checked.</p>
                    )}
                    <div className="cart-quantity">
                      <button type="button" aria-label={"Decrease quantity for " + name} onClick={() => setQuantity(line.slug, line.quantity - 1, line.variantId)}>−</button>
                      <span aria-live="polite">{line.quantity}</span>
                      <button
                        type="button"
                        aria-label={"Increase quantity for " + name}
                        disabled={!item?.available || line.quantity >= (item?.availableQuantity ?? 0)}
                        onClick={() => setQuantity(line.slug, line.quantity + 1, line.variantId)}
                      >
                        +
                      </button>
                      <button className="cart-remove" type="button" onClick={() => removeItem(line.slug, line.variantId)}>Remove</button>
                    </div>
                    {item && !item.available && <small className="cart-error">Only {item.availableQuantity} available. Please adjust the quantity.</small>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {!!Object.keys(totals).length && (
          <div className="cart-drawer-total">
            <span>Subtotal</span>
            <strong>{Object.entries(totals).map(([currency, amount]) => formatMoneyFromMinor(amount, currency)).join(" · ")}</strong>
          </div>
        )}
        <div className="cart-drawer-footer">
          <Link href="/cart" className="button-primary dark-button" onClick={closeDrawer}>View bag</Link>
          <p>Shipping and taxes are not included. Checkout will be available once delivery, tax and payment settings have been configured.</p>
        </div>
      </aside>
    </div>
  );
}
