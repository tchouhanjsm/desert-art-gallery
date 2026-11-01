"use client";
import Image from "next/image";
import Link from "next/link";
import { formatMoneyFromMinor } from "@/lib/money";
import { useCart } from "@/components/CartProvider";

export function CartPageClient() {
  const { lines, preview, isLoading, error, removeItem, setQuantity } = useCart();
  const totals: Record<string, number> = {};
  for (const item of preview) {
    if (item.priceMinor !== null && item.currency) totals[item.currency] = (totals[item.currency] ?? 0) + item.priceMinor * item.quantityRequested;
  }
  if (!lines.length) return <div className="empty-note">Your bag is currently empty.<br/><Link href="/shop" className="empty-link">EXPLORE THE COLLECTION ↗</Link></div>;
  return <div className="cart-page-layout">
    <section className="cart-page-lines">
      {isLoading && <p className="cart-state">Refreshing current product and stock details…</p>}
      {error && <p className="cart-error" role="status">{error}</p>}
      {preview.map((item) => <article className="cart-page-line" key={item.slug}>
        {item.image ? <Image src={item.image} alt={item.imageAlt} width={160} height={210} unoptimized /> : <div className="cart-line-placeholder" />}
        <div className="cart-line-details"><div className="section-kicker">DESERT ART GALLERY</div><h2>{item.name}</h2>
          <p>{item.priceMinor !== null && item.currency ? formatMoneyFromMinor(item.priceMinor, item.currency) : "Price unavailable"}</p>
          <div className="cart-quantity"><button aria-label="Decrease quantity" onClick={() => setQuantity(item.slug, item.quantityRequested - 1)}>−</button><span>{item.quantityRequested}</span><button aria-label="Increase quantity" disabled={item.quantityRequested >= item.availableQuantity} onClick={() => setQuantity(item.slug, item.quantityRequested + 1)}>+</button><button className="cart-remove" onClick={() => removeItem(item.slug)}>REMOVE</button></div>
          {!item.available && <small className="cart-error">Only {item.availableQuantity} currently available. Please adjust this line.</small>}
        </div>
      </article>)}
    </section>
    <aside className="cart-summary"><div className="section-kicker">ORDER SUMMARY</div><h2>Your selection</h2>
      {Object.entries(totals).map(([currency, amount]) => <div className="cart-summary-row" key={currency}><span>Item subtotal ({currency})</span><strong>{formatMoneyFromMinor(amount, currency)}</strong></div>)}
      <p>Shipping and duties depend on the delivery destination and are not calculated yet.</p>
      <div className="checkout-notice">Secure checkout is not active yet. We will not accept payment until the gateway and shipping calculations are configured and verified.</div>
      <Link href="/contact" className="button-outline">ASK ABOUT YOUR SELECTION</Link>
    </aside>
  </div>;
}
