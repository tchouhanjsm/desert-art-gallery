"use client";

import Link from "next/link";
import { StorefrontImage } from "@/components/StorefrontImage";
import { useCart } from "@/components/CartProvider";
import { cartLineKey } from "@/lib/cart";
import { formatMoneyFromMinor } from "@/lib/money";
import { formatCartFallbackName, getCartDisplayRows } from "@/lib/cart-presentation";

export function CartPageClient() {
  const { lines, preview, isLoading, error, removeItem, setQuantity } = useCart();
  const rows = getCartDisplayRows(lines, preview);
  const totals: Record<string, number> = {};
  for (const { line, item } of rows) {
    if (item?.priceMinor !== null && item?.priceMinor !== undefined && item.currency) {
      totals[item.currency] = (totals[item.currency] ?? 0) + item.priceMinor * line.quantity;
    }
  }
  const canContinue = !isLoading && !error && rows.length > 0
    && rows.every(({ item }) => item?.available && item.priceMinor !== null && Boolean(item.currency))
    && Object.keys(totals).length === 1;

  if (!lines.length) {
    return (
      <div className="empty-note cart-empty-state">
        <p>Your bag is empty.</p>
        <p>Explore the collection to find a piece worth keeping.</p>
        <Link href="/shop" className="button-outline">Continue shopping</Link>
      </div>
    );
  }

  return (
    <div className="cart-page-layout">
      <section className="cart-page-lines" aria-label="Items in your bag">
        {isLoading && <p className="cart-state" role="status">Checking product details and availability…</p>}
        {error && <p className="cart-error" role="alert">{error}</p>}
        {rows.map(({ line, item }) => {
          const name = item?.name ?? formatCartFallbackName(line.slug);
          const imageAlt = item?.imageAlt?.trim() || (item ? name : "Product image pending review");
          return (
            <article className="cart-page-line" key={cartLineKey(line.slug, line.variantId)}>
              <div className="cart-line-media">
                {item?.image ? (
                  <StorefrontImage src={item.image} alt={imageAlt} fill sizes="(max-width: 520px) 95px, 130px" />
                ) : (
                  <div className="cart-line-placeholder" role="img" aria-label={"Product image pending review for " + name}>
                    <span>Image pending review</span>
                  </div>
                )}
              </div>
              <div className="cart-line-details">
                <div className="section-kicker">DESERT ART GALLERY</div>
                <h2>{name}</h2>
                {item ? (
                  <p>{item.priceMinor !== null && item.currency ? formatMoneyFromMinor(item.priceMinor, item.currency) : "Price unavailable"}</p>
                ) : (
                  <p className="cart-preview-pending">Product details are being checked.</p>
                )}
                {item?.variantLabel && <p className="cart-variant-label">{item.variantLabel}</p>}
                <div className="cart-quantity">
                  <button
                    type="button"
                    aria-label={"Decrease quantity for " + name}
                    onClick={() => setQuantity(line.slug, line.quantity - 1, line.variantId)}
                  >
                    −
                  </button>
                  <span aria-live="polite">{line.quantity}</span>
                  <button
                    type="button"
                    aria-label={"Increase quantity for " + name}
                    disabled={!item?.available || line.quantity >= (item?.availableQuantity ?? 0)}
                    onClick={() => setQuantity(line.slug, line.quantity + 1, line.variantId)}
                  >
                    +
                  </button>
                  <button
                    className="cart-remove"
                    type="button"
                    onClick={() => removeItem(line.slug, line.variantId)}
                  >
                    Remove
                  </button>
                </div>
                {item && !item.available && (
                  <small className="cart-error">Only {item.availableQuantity} available. Please adjust the quantity.</small>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <aside className="cart-summary" aria-labelledby="cart-summary-heading">
        <div className="section-kicker">ORDER SUMMARY</div>
        <h2 id="cart-summary-heading">Items in your bag</h2>
        {Object.entries(totals).map(([currency, amount]) => (
          <div className="cart-summary-row" key={currency}>
            <span>Subtotal ({currency})</span>
            <strong>{formatMoneyFromMinor(amount, currency)}</strong>
          </div>
        ))}
        <p>Shipping, taxes and duties vary by destination.</p>
        <div className="checkout-notice">
          The next step creates an unpaid order draft only. No payment is taken until an approved payment provider and its webhook have been configured.
        </div>
        {canContinue ? (
          <Link href="/checkout" className="button-primary dark-button">Continue to delivery details</Link>
        ) : (
          <span className="button-outline checkout-disabled" aria-disabled="true">Check availability before continuing</span>
        )}
      </aside>
    </div>
  );
}
