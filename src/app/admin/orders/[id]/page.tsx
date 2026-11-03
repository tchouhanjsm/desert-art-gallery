import Link from "next/link";
import { notFound } from "next/navigation";
import { isMySqlCatalogueEnabled } from "@/server/db";
import { getCurrentLocalAdmin } from "@/server/auth/local-admin";
import { formatMoneyFromMinor } from "@/lib/money";
import { getMySqlAdminOrder } from "@/server/checkout/mysql-orders";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { transitionOrder } from "../actions";

export const metadata = { title: "Order details" };

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isMySqlCatalogueEnabled()) {
    const admin = await getCurrentLocalAdmin();
    if (!admin || !["owner", "admin"].includes(admin.role)) {
      return <div className="page-shell"><h1>Order details</h1><p>Administrator sign-in is required.</p><Link className="text-link" href="/owner/login">OWNER SIGN IN</Link></div>;
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) notFound();
    const result = await getMySqlAdminOrder(id);
    if (!result) notFound();
    const { order, items, events } = result;
    const address = order.shippingAddress ?? {};
    const addressLine = [
      address.address_line_1, address.address_line_2, address.city,
      address.region, address.postal_code, address.country_code,
    ].filter((value): value is string => typeof value === "string" && Boolean(value.trim())).join(", ");
    const nextStatus = order.status === "paid" ? "processing" : order.status === "processing" ? "shipped" : order.status === "shipped" ? "delivered" : null;
    return <div className="page-shell">
      <div className="breadcrumb"><Link href="/admin/orders">ORDERS</Link> / {order.orderNumber}</div>
      <div className="admin-page-heading"><div><div className="section-kicker">COMMERCE OPERATIONS</div><h1>{order.orderNumber}</h1><p>{order.email} · {new Date(order.createdAt).toLocaleString("en-IN")}</p></div><span className={"admin-status status-" + order.status}>{order.status.replaceAll("_", " ")}</span></div>
      {order.status === "draft" && <div className="checkout-notice">Unpaid order draft only. No payment has been requested or taken. Expires {new Date(order.expiresAt).toLocaleString("en-IN")}.</div>}
      <div className="order-detail-layout">
        <section className="order-item-list"><h2>Items</h2>
          {items.map((item) => <article className="order-item" key={item.id}><div><strong>{item.productTitle}</strong><small>{item.variantLabel}</small>{item.productSku && <small>SKU {item.productSku}</small>}<p>Quantity: {item.quantity} · Unit {formatMoneyFromMinor(item.unitPriceMinor, order.currency)}</p></div><strong>{formatMoneyFromMinor(item.lineTotalMinor, order.currency)}</strong></article>)}
          <section className="account-section"><div className="section-kicker">DELIVERY DESTINATION</div><h2>Shipping address</h2><p>{typeof address.recipient_name === "string" ? address.recipient_name : order.email}<br/>{addressLine}</p></section>
          <section className="account-section"><div className="section-kicker">SHIPPING & TAX SNAPSHOT</div><h2>{order.shippingRateName}</h2><p>Zone: {order.shippingZoneName}</p><p>{order.dutiesDisclosure}</p>
            {order.taxBreakdown.map((tax, index) => <p key={tax.name + index}>{tax.name}: {formatMoneyFromMinor(tax.amount_minor, order.currency)} ({tax.rate_basis_points} bps)</p>)}
            <p>{order.taxDisclosure}</p>
          </section>
          <section className="account-section"><div className="section-kicker">ORDER EVENT LEDGER</div><h2>History</h2>
            {events.map((event) => <p key={event.id}>{new Date(event.createdAt).toLocaleString("en-IN")} · {event.eventType.replaceAll("_", " ")}{event.fromStatus ? " · " + event.fromStatus + " → " + event.toStatus : ""}</p>)}
          </section>
        </section>
        <aside className="cart-summary"><div className="section-kicker">ORDER SUMMARY</div>
          <div className="cart-summary-row"><span>Subtotal</span><strong>{formatMoneyFromMinor(order.subtotalMinor, order.currency)}</strong></div>
          <div className="cart-summary-row"><span>Shipping</span><strong>{formatMoneyFromMinor(order.shippingMinor, order.currency)}</strong></div>
          <div className="cart-summary-row"><span>Tax</span><strong>{formatMoneyFromMinor(order.taxMinor, order.currency)}</strong></div>
          <div className="cart-summary-row"><span>Total</span><strong>{formatMoneyFromMinor(order.totalMinor, order.currency)}</strong></div>
          {order.trackingNumber && <p>Carrier: {order.trackingCarrier ?? "—"}<br/>Tracking: {order.trackingNumber}</p>}
          {order.trackingUrl && <p><a href={order.trackingUrl} target="_blank" rel="noreferrer">TRACK SHIPMENT ↗</a></p>}
          {nextStatus && <form action={transitionOrder} className="shipment-form">
            <input type="hidden" name="id" value={order.id}/><input type="hidden" name="next_status" value={nextStatus}/>
            {nextStatus === "shipped" && <><label>Carrier<input name="tracking_carrier" required maxLength={100}/></label><label>Tracking number<input name="tracking_number" required maxLength={160}/></label><label className="admin-form-wide">HTTPS tracking URL<input name="tracking_url" type="url" maxLength={1000}/></label></>}
            <button className="button-primary dark-button" type="submit">MARK {nextStatus.toUpperCase()}</button>
          </form>}
          {!nextStatus && <p>Fulfilment becomes available only after a verified payment event marks the order paid. Payment events are not active yet.</p>}
        </aside>
      </div>
    </div>;
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return <div className="page-shell"><div className="page-heading"><h1>Order details</h1><p>Connect Supabase to manage orders.</p></div></div>;
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return <div className="page-shell"><h1>Order details</h1><p>Administrator sign-in is required.</p></div>;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !["admin", "owner"].includes(profile.role)) return <div className="page-shell"><h1>Order details</h1><p>Administrator permissions are required.</p></div>;
  const [orderResult, itemResult] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle(),
    supabase.from("order_items").select("id,product_title,product_sku,variant_label,quantity,unit_price_minor,line_total_minor").eq("order_id", id),
  ]);
  if (orderResult.error || !orderResult.data) notFound();
  if (itemResult.error) throw new Error("Unable to load order items.");
  const order = orderResult.data;
  const items = itemResult.data ?? [];
  const address = order.shipping_address ?? {};
  const addressLine = [address.address_line_1,address.address_line_2,address.city,address.region,address.postal_code,address.country_code].filter((part) => typeof part === "string" && part.trim()).join(", ");
  const nextStatus = order.status === "paid" ? "processing" : order.status === "processing" ? "shipped" : order.status === "shipped" ? "delivered" : null;
  return <div className="page-shell">
    <div className="breadcrumb"><Link href="/admin/orders">ORDERS</Link> / {order.order_number}</div>
    <div className="admin-page-heading"><div><div className="section-kicker">COMMERCE OPERATIONS</div><h1>{order.order_number}</h1><p>{order.email} · {new Date(order.created_at).toLocaleString("en-IN")}</p></div><span className={"admin-status status-" + order.status}>{order.status.replaceAll("_", " ")}</span></div>
    <div className="order-detail-layout"><section className="order-item-list"><h2>Items</h2>{items.map((item) => <article className="order-item" key={item.id}><div><strong>{item.product_title}</strong>{item.variant_label && <small>{item.variant_label}</small>}{item.product_sku && <small>SKU {item.product_sku}</small>}<p>Quantity: {item.quantity}</p></div><strong>{formatMoneyFromMinor(item.line_total_minor,order.currency)}</strong></article>)}<p>{addressLine}</p></section><aside className="cart-summary"><div className="cart-summary-row"><span>Total</span><strong>{formatMoneyFromMinor(order.total_minor,order.currency)}</strong></div>{nextStatus && <form action={transitionOrder}><input type="hidden" name="id" value={order.id}/><input type="hidden" name="next_status" value={nextStatus}/>{nextStatus==="shipped" && <><label>Carrier<input name="tracking_carrier" required/></label><label>Tracking number<input name="tracking_number" required/></label></>}<button className="button-primary dark-button" type="submit">MARK {nextStatus.toUpperCase()}</button></form>}</aside></div>
  </div>;
}
