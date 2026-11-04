"use client";
import Image from "next/image";
import { galleryBlurDataUrl } from "@/lib/image";
import Link from "next/link";
import { formatMoneyFromMinor } from "@/lib/money";
import { useCart } from "@/components/CartProvider";
import { cartLineKey } from "@/lib/cart";

export function CartPageClient() {
  const { lines, preview, isLoading, error, removeItem, setQuantity } = useCart();
  const totals: Record<string, number> = {};
  for (const item of preview) {
    if (item.priceMinor !== null && item.currency) totals[item.currency] = (totals[item.currency] ?? 0) + item.priceMinor * item.quantityRequested;
  }
  const canContinue = !isLoading && !error && lines.length > 0 && preview.length === lines.length
    && preview.every((item) => item.available && item.priceMinor !== null && Boolean(item.currency))
    && Object.keys(totals).length === 1;
  if (!lines.length) return <div className="empty-note">Your bag is currently empty.<br/><Link href="/shop" className="empty-link">EXPLORE THE COLLECTION</Link></div>;
  return <div className="cart-page-layout">
    <section className="cart-page-lines">
      {isLoading && <p className="cart-state">Refreshing current product and stock details…</p>}
      {error && <p className="cart-error" role="status">{error}</p>}
      {preview.map((item) => <article className="cart-page-line" key={cartLineKey(item.slug, item.variantId ?? undefined)}>
        {item.image ? <Image placeholder="blur" blurDataURL={galleryBlurDataUrl} src={item.image} alt={item.imageAlt} width={160} height={210} /> : <div className="cart-line-placeholder" />}
        <div className="cart-line-details"><div className="section-kicker">DESERT ART GALLERY</div><h2>{item.name}</h2>
          <p>{item.priceMinor !== null && item.currency ? formatMoneyFromMinor(item.priceMinor, item.currency) : "Price unavailable"}</p>
          {item.variantLabel && <p className="cart-variant-label">{item.variantLabel}</p>}
          <div className="cart-quantity"><button aria-label="Decrease quantity" onClick={() => setQuantity(item.slug, item.quantityRequested - 1, item.variantId ?? undefined)}>−</button><span>{item.quantityRequested}</span><button aria-label="Increase quantity" disabled={item.quantityRequested >= item.availableQuantity} onClick={() => setQuantity(item.slug, item.quantityRequested + 1, item.variantId ?? undefined)}>+</button><button className="cart-remove" onClick={() => removeItem(item.slug, item.variantId ?? undefined)}>REMOVE</button></div>
          {!item.available && <small className="cart-error">Only {item.availableQuantity} currently available. Please adjust this line.</small>}
        </div>
      </article>)}
    </section>
    <aside className="cart-summary"><div className="section-kicker">ORDER SUMMARY</div><h2>Your selection</h2>
      {Object.entries(totals).map(([currency, amount]) => <div className="cart-summary-row" key={currency}><span>Item subtotal ({currency})</span><strong>{formatMoneyFromMinor(amount, currency)}</strong></div>)}
      <p>Shipping, configured taxes and duties disclosures depend on the delivery destination.</p>
      <div className="checkout-notice">The next step prepares an unpaid, expiring order draft only. No payment is requested or taken until an approved payment provider and signed webhook flow are enabled.</div>
      {canContinue ? <Link href="/checkout" className="button-primary dark-button">CONTINUE TO DELIVERY</Link> : <span className="button-outline checkout-disabled" aria-disabled="true">CHECK AVAILABILITY TO CONTINUE</span>}
    </aside>
  </div>;
}
