"use client";

import Image from "next/image";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { formatMoneyFromMinor } from "@/lib/money";
import { cartLineKey, mergeCartLine, normalizeCartLines, setCartLineQuantity, type CartLine } from "@/lib/cart";

type CartPreviewItem = {
  slug: string; variantId: string | null; variantLabel: string | null; name: string;
  quantityRequested: number; availableQuantity: number; available: boolean;
  priceMinor: number | null; currency: string | null; image: string | null; imageAlt: string;
};
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
      if (!response.ok) throw new Error(result.error || "カートの情報を更新できませんでした。");
      setPreview(Array.isArray(result.items) ? result.items as CartPreviewItem[] : []);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "カートの情報を更新できませんでした。");
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
    if (maximum < 1) { setError("この商品は現在ご購入いただけません。"); return; }
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
  if (!drawerOpen) return null;
  const totals: Record<string, number> = {};
  for (const item of preview) {
    if (item.priceMinor !== null && item.currency) totals[item.currency] = (totals[item.currency] ?? 0) + item.priceMinor * item.quantityRequested;
  }
  return <div className="cart-overlay" role="presentation" onClick={closeDrawer}>
    <aside className="cart-drawer" role="dialog" aria-modal="true" aria-label="Shopping bag" onClick={(event) => event.stopPropagation()}>
      <div className="cart-drawer-header"><div><div className="section-kicker">カート</div><h2>カート</h2></div><button className="icon-button" onClick={closeDrawer} aria-label="カートを閉じる">×</button></div>
      {isLoading && <p className="cart-state">商品情報と在庫を確認しています…</p>}
      {error && <p className="cart-error" role="status">{error}</p>}
      {!lines.length ? <div className="empty-note">カート is waiting for its first piece.<br/><Link href="/shop" className="empty-link" onClick={closeDrawer}>商品を見る</Link></div> :
        <div className="cart-drawer-lines">{preview.map((item) => <article className="cart-line" key={cartLineKey(item.slug, item.variantId ?? undefined)}>
          {item.image ? <Image src={item.image} alt={item.imageAlt} width={88} height={116} unoptimized /> : <div className="cart-line-placeholder" aria-hidden="true" />}
          <div className="cart-line-details"><h3>{item.name}</h3>
            {item.variantLabel && <p className="cart-variant-label">{item.variantLabel}</p>}
            {item.priceMinor !== null && item.currency ? <p>{formatMoneyFromMinor(item.priceMinor, item.currency)}</p> : <p>価格を確認できません</p>}
            <div className="cart-quantity"><button aria-label="数量を1つ減らす" onClick={() => setQuantity(item.slug, item.quantityRequested - 1, item.variantId ?? undefined)}>−</button><span>{item.quantityRequested}</span><button aria-label="数量を1つ増やす" disabled={item.quantityRequested >= item.availableQuantity} onClick={() => setQuantity(item.slug, item.quantityRequested + 1, item.variantId ?? undefined)}>+</button><button className="cart-remove" onClick={() => removeItem(item.slug, item.variantId ?? undefined)}>削除</button></div>
            {!item.available && <small className="cart-error">現在の在庫は{item.availableQuantity}点です。数量を変更してください。</small>}
          </div>
        </article>)}</div>}
      {!!Object.keys(totals).length && <div className="cart-drawer-total"><span>商品小計</span><strong>{Object.entries(totals).map(([currency, amount]) => formatMoneyFromMinor(amount, currency)).join(" · ")}</strong></div>}
      <div className="cart-drawer-footer"><Link href="/cart" className="button-primary dark-button" onClick={closeDrawer}>カートを見る</Link><p>送料・税金は含まれていません。配送・税金・決済の設定が完了した後に注文手続きへ進めます。</p></div>
    </aside>
  </div>;
}
