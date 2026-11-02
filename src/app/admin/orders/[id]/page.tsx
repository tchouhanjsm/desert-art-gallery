import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoneyFromMinor } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { transitionOrder } from "../actions";

export const metadata = { title: "Order details" };
type TaxComponent = { name: string; rate_basis_points: number; amount_minor: number };
type OrderRow = {
  id: string; order_number: string; email: string; status: string; currency: string;
  subtotal_minor: number; shipping_minor: number; tax_minor: number; discount_minor: number; total_minor: number;
  shipping_address: Record<string, unknown>; billing_address: Record<string, unknown> | null; created_at: string;
  expires_at: string | null; shipping_zone_name: string | null; shipping_rate_name: string | null;
  shipping_delivery_min_days: number | null; shipping_delivery_max_days: number | null;
  duties_disclosure: string | null; tax_breakdown: TaxComponent[]; tax_disclosure: string | null;
  tracking_carrier: string | null; tracking_number: string | null; tracking_url: string | null;
};
type ItemRow = { id: string; product_title: string; product_sku: string | null; variant_label: string | null; quantity: number; unit_price_minor: number; line_total_minor: number };

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <div className="page-shell"><div className="page-heading"><h1>Order details</h1><p>Connect Supabase to manage orders.</p></div></div>;
  const [orderResult, itemResult] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle(),
    supabase.from("order_items").select("id,product_title,product_sku,variant_label,quantity,unit_price_minor,line_total_minor").eq("order_id", id),
  ]);
  if (orderResult.error || !orderResult.data) notFound();
  if (itemResult.error) throw new Error("Unable to load order items.");
  const order = orderResult.data as unknown as OrderRow;
  const items = (itemResult.data ?? []) as ItemRow[];
  const address = order.shipping_address ?? {};
  const addressLine = [address.address_line_1,address.address_line_2,address.city,address.region,address.postal_code,address.country_code].filter((part) => typeof part === "string" && part.trim()).join(", ");
  const taxComponents = Array.isArray(order.tax_breakdown) ? order.tax_breakdown : [];
  const nextStatus = order.status === "paid" ? "processing" : order.status === "processing" ? "shipped" : order.status === "shipped" ? "delivered" : null;

  return <div className="page-shell">
    <div className="breadcrumb"><Link href="/admin/orders">ORDERS</Link> / {order.order_number}</div>
    <div className="admin-page-heading"><div><div className="section-kicker">COMMERCE OPERATIONS</div><h1>{order.order_number}</h1><p>{order.email} · {new Date(order.created_at).toLocaleString("en-IN")}</p></div><span className={"admin-status status-" + order.status}>{order.status.replaceAll("_"," ")}</span></div>
    {order.status === "draft" && <div className="checkout-notice">Unpaid draft only. No payment has been requested or taken. Expires {order.expires_at ? new Date(order.expires_at).toLocaleString("en-IN") : "with its inventory reservation"}.</div>}
    <div className="order-detail-layout">
      <section className="order-item-list">
        <h2>Items</h2>
        {items.map((item) => <article className="order-item" key={item.id}><div><strong>{item.product_title}</strong>{item.variant_label && <small>{item.variant_label}</small>}{item.product_sku && <small>SKU {item.product_sku}</small>}<p>Quantity: {item.quantity} · Unit {formatMoneyFromMinor(item.unit_price_minor,order.currency)}</p></div><strong>{formatMoneyFromMinor(item.line_total_minor,order.currency)}</strong></article>)}
        <section className="account-section"><div className="section-kicker">DELIVERY DESTINATION</div><h2>Shipping address</h2><p>{typeof address.recipient_name === "string" ? address.recipient_name : order.email}<br/>{addressLine}</p></section>
        <section className="account-section"><div className="section-kicker">SHIPPING AND TAX SNAPSHOT</div><h2>{order.shipping_rate_name ?? "Shipping option"}</h2>
          {order.shipping_zone_name && <p>Zone: {order.shipping_zone_name}</p>}
          {order.shipping_delivery_min_days !== null && order.shipping_delivery_max_days !== null ? <p>Configured delivery window: {order.shipping_delivery_min_days}–{order.shipping_delivery_max_days} days</p> : <p>No delivery window configured.</p>}
          {order.duties_disclosure && <p>{order.duties_disclosure}</p>}
          {taxComponents.map((tax,index) => <p key={tax.name + index}>{tax.name}: {formatMoneyFromMinor(tax.amount_minor,order.currency)}</p>)}
          {order.tax_disclosure && <p>{order.tax_disclosure}</p>}
        </section>
        <section className="account-section"><div className="section-kicker">FULFILMENT</div><h2>Order lifecycle</h2>
          {nextStatus ? <form action={transitionOrder} className="shipment-form">
            <input type="hidden" name="id" value={order.id}/>
            <input type="hidden" name="next_status" value={nextStatus}/>
            {order.status === "processing" && <>
              <label>Carrier<input name="tracking_carrier" maxLength={100} required/></label>
              <label>Tracking number<input name="tracking_number" maxLength={160} required/></label>
              <label className="admin-form-wide">HTTPS tracking URL<input name="tracking_url" type="url" maxLength={1000} placeholder="https://…"/></label>
            </>}
            <button className="button-primary dark-button" type="submit">{nextStatus === "processing" ? "MARK PROCESSING" : nextStatus === "shipped" ? "SAVE SHIPMENT & MARK SHIPPED" : "MARK DELIVERED"}</button>
          </form> : <p>No fulfilment transition is available for the current order state.</p>}
        </section>
      </section>
      <aside className="cart-summary"><div className="section-kicker">ORDER SUMMARY</div>
        <div className="cart-summary-row"><span>Subtotal</span><strong>{formatMoneyFromMinor(order.subtotal_minor,order.currency)}</strong></div>
        <div className="cart-summary-row"><span>Shipping</span><strong>{formatMoneyFromMinor(order.shipping_minor,order.currency)}</strong></div>
        <div className="cart-summary-row"><span>Tax</span><strong>{formatMoneyFromMinor(order.tax_minor,order.currency)}</strong></div>
        <div className="cart-summary-row"><span>Discount</span><strong>−{formatMoneyFromMinor(order.discount_minor,order.currency)}</strong></div>
        <div className="cart-summary-row"><span>Total</span><strong>{formatMoneyFromMinor(order.total_minor,order.currency)}</strong></div>
        <p>Payment state can only be changed by a verified provider webhook. This workspace cannot mark an order paid or issue a refund.</p>
      </aside>
    </div>
  </div>;
}
