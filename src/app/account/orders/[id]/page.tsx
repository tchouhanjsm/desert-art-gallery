import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatMoneyFromMinor } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentCustomer, isMySqlCustomerAuthEnabled } from "@/server/auth/local-customer";
import { getMySqlCustomerOrder } from "@/server/checkout/mysql-orders";

function formatOrderStatus(status: string) {
  const labels: Record<string, string> = {
    draft: "Order draft",
    pending_payment: "Awaiting payment",
    paid: "Paid",
    processing: "Processing",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
    refunded: "Refunded",
    expired: "Expired",
  };
  return labels[status] ?? "Status pending";
}


type TaxComponent = { name: string; rate_basis_points: number; amount_minor: number };
type LegacyOrder = {
  id: string; order_number: string; status: string; currency: string;
  subtotal_minor: number; shipping_minor: number; tax_minor: number; discount_minor: number; total_minor: number;
  created_at: string; expires_at: string | null; shipping_zone_name: string | null; shipping_rate_name: string | null;
  shipping_delivery_min_days: number | null; shipping_delivery_max_days: number | null;
  duties_disclosure: string | null; tax_breakdown: TaxComponent[]; tax_disclosure: string | null;
  tracking_carrier: string | null; tracking_number: string | null; tracking_url: string | null;
};
type LegacyItem = { id: string; product_title: string; product_sku: string | null; variant_label: string | null; quantity: number; unit_price_minor: number; line_total_minor: number };

export default async function CustomerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isMySqlCustomerAuthEnabled()) {
    const customer = await getCurrentCustomer();
    if (!customer) redirect("/login");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) notFound();
    const result = await getMySqlCustomerOrder(customer.id, id);
    if (!result) notFound();
    const { order, items } = result;
    const address = order.shippingAddress ?? {};
    const addressLine = [
      address.address_line_1, address.address_line_2, address.city,
      address.region, address.postal_code, address.country_code,
    ].filter((value): value is string => typeof value === "string" && Boolean(value.trim())).join(", ");
    const taxes = Array.isArray(order.taxBreakdown) ? order.taxBreakdown : [];
    let trackingUrl: string | null = null;
    try {
      const parsed = order.trackingUrl ? new URL(order.trackingUrl) : null;
      if (parsed?.protocol === "https:") trackingUrl = parsed.toString();
    } catch { trackingUrl = null; }

    return <div className="page-shell">
      <div className="breadcrumb"><Link href="/account">My account</Link> / ORDER {order.orderNumber}</div>
      <div className="page-heading"><div className="section-kicker">ORDER DETAILS</div><h1>{order.orderNumber}</h1><p>Order date: {new Date(order.createdAt).toLocaleDateString("en-IN")}</p><span className={"admin-status status-" + order.status}>{formatOrderStatus(order.status)}</span></div>
      {order.status === "draft" && <div className="checkout-notice" role="status">This is an unpaid order draft. No payment has been collected. The draft and temporary stock reservation expire at {new Date(order.expiresAt).toLocaleString("en-IN")}..</div>}
      {order.status === "expired" && <div className="checkout-notice" role="status">This order draft has expired and its temporary stock reservation has ended. If the item is still available, start a new order.</div>}
      <div className="order-detail-layout">
        <section className="order-item-list">
          <h2>ORDER ITEMS</h2>
          {items.map((item) => <article className="order-item" key={item.id}><div><strong>{item.productTitle}</strong><small>{item.variantLabel}</small>{item.productSku && <small>SKU {item.productSku}</small>}<p>Quantity: {item.quantity}</p></div><strong>{formatMoneyFromMinor(item.lineTotalMinor, order.currency)}</strong></article>)}
          <section className="account-section"><div className="section-kicker">DELIVERY TO</div><h2>Delivery address</h2><p>{typeof address.recipient_name === "string" ? address.recipient_name : order.email}<br/>{addressLine}</p></section>
          <section className="account-section"><div className="section-kicker">SHIPPING & TAX DETAILS</div><h2>{order.shippingRateName}</h2><p>Shipping zone: {order.shippingZoneName}</p>
            {order.shippingDeliveryMinDays !== null && order.shippingDeliveryMaxDays !== null
              ? <p>Configured delivery estimate: {order.shippingDeliveryMinDays}–{order.shippingDeliveryMaxDays} days</p>
              : <p>No delivery estimate is configured for this shipping method.</p>}
            <p>{order.dutiesDisclosure}</p>
            {taxes.map((tax, index) => <p key={tax.name + index}>{tax.name}: {formatMoneyFromMinor(tax.amount_minor, order.currency)} ({tax.rate_basis_points} bps)</p>)}
            <p>{order.taxDisclosure}</p>
          </section>
        </section>
        <aside className="cart-summary"><div className="section-kicker">ORDER SUMMARY</div>
          <div className="cart-summary-row"><span>Subtotal</span><strong>{formatMoneyFromMinor(order.subtotalMinor, order.currency)}</strong></div>
          <div className="cart-summary-row"><span>Shipping</span><strong>{formatMoneyFromMinor(order.shippingMinor, order.currency)}</strong></div>
          <div className="cart-summary-row"><span>Tax</span><strong>{formatMoneyFromMinor(order.taxMinor, order.currency)}</strong></div>
          <div className="cart-summary-row"><span>Discount</span><strong>−{formatMoneyFromMinor(order.discountMinor, order.currency)}</strong></div>
          <div className="cart-summary-row"><span>Total</span><strong>{formatMoneyFromMinor(order.totalMinor, order.currency)}</strong></div>
          {trackingUrl && <p><a href={trackingUrl} target="_blank" rel="noreferrer">Track shipment</a></p>}
          {order.trackingNumber && <p>Tracking number: {order.trackingNumber}</p>}
          {order.status === "draft" && <p>No payment method is connected to this order draft. Do not pay through a method that has not been approved by the gallery.</p>}
        </aside>
      </div>
    </div>;
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) notFound();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");
  const { data: order, error } = await supabase.from("orders")
    .select("id,order_number,status,currency,subtotal_minor,shipping_minor,tax_minor,discount_minor,total_minor,created_at,expires_at,shipping_zone_name,shipping_rate_name,shipping_delivery_min_days,shipping_delivery_max_days,duties_disclosure,tax_breakdown,tax_disclosure,tracking_carrier,tracking_number,tracking_url")
    .eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error || !order) notFound();
  const { data: itemData, error: itemError } = await supabase.from("order_items")
    .select("id,product_title,product_sku,variant_label,quantity,unit_price_minor,line_total_minor").eq("order_id", id);
  if (itemError) throw new Error("Unable to load order items.");
  const items = (itemData ?? []) as LegacyItem[];
  const row = order as unknown as LegacyOrder;
  const taxComponents = Array.isArray(row.tax_breakdown) ? row.tax_breakdown : [];
  const trackingUrl = (() => {
    try { const url = row.tracking_url ? new URL(row.tracking_url) : null; return url && url.protocol === "https:" ? url.toString() : null; }
    catch { return null; }
  })();

  return <div className="page-shell">
    <div className="breadcrumb"><Link href="/account">My account</Link> / ORDER {row.order_number}</div>
    <div className="page-heading"><div className="section-kicker">ORDER DETAILS</div><h1>{row.order_number}</h1><p>Order date: {new Date(row.created_at).toLocaleDateString("en-IN")}</p><span className={"admin-status status-" + row.status}>{formatOrderStatus(row.status)}</span></div>
    {row.status === "draft" && <div className="checkout-notice" role="status">This is an unpaid order draft. No payment has been requested or received. The order draft and temporary stock reservation expire at {row.expires_at ? new Date(row.expires_at).toLocaleString("en-IN") : "the stock reservation expiry time"}.</div>}
    {row.status === "expired" && <div className="checkout-notice" role="status">This order draft has expired and its temporary stock reservation has ended. If the item is still available, start a new order from your cart.</div>}
    <div className="order-detail-layout">
      <section className="order-item-list"><h2>ORDER ITEMS</h2>
        {items.map((item) => <article className="order-item" key={item.id}><div><strong>{item.product_title}</strong>{item.variant_label && <small>{item.variant_label}</small>}{item.product_sku && <small>SKU {item.product_sku}</small>}<p>Quantity: {item.quantity}</p></div><strong>{formatMoneyFromMinor(item.line_total_minor, row.currency)}</strong></article>)}
        <section className="account-section"><div className="section-kicker">SHIPPING & TAX INFORMATION</div><h2>{row.shipping_rate_name ?? "Shipping information"}</h2>
          {row.shipping_zone_name && <p>Shipping zone: {row.shipping_zone_name}</p>}
          {row.shipping_delivery_min_days !== null && row.shipping_delivery_max_days !== null ? <p>Configured delivery estimate: {row.shipping_delivery_min_days}–{row.shipping_delivery_max_days} days</p> : <p>No delivery estimate is configured for this shipping method.</p>}
          {row.duties_disclosure && <p>{row.duties_disclosure}</p>}{taxComponents.map((tax,index)=><p key={tax.name+index}>{tax.name}: {formatMoneyFromMinor(tax.amount_minor,row.currency)}</p>)}{row.tax_disclosure && <p>{row.tax_disclosure}</p>}
        </section>
      </section>
      <aside className="cart-summary"><div className="section-kicker">ORDER SUMMARY</div>
        <div className="cart-summary-row"><span>Subtotal</span><strong>{formatMoneyFromMinor(row.subtotal_minor,row.currency)}</strong></div>
        <div className="cart-summary-row"><span>Shipping</span><strong>{formatMoneyFromMinor(row.shipping_minor,row.currency)}</strong></div>
        <div className="cart-summary-row"><span>Tax</span><strong>{formatMoneyFromMinor(row.tax_minor,row.currency)}</strong></div>
        <div className="cart-summary-row"><span>Discount</span><strong>−{formatMoneyFromMinor(row.discount_minor,row.currency)}</strong></div>
        <div className="cart-summary-row"><span>Total</span><strong>{formatMoneyFromMinor(row.total_minor,row.currency)}</strong></div>
        {trackingUrl && <p><a href={trackingUrl} target="_blank" rel="noreferrer">Track shipment</a></p>}{row.tracking_number && <p>Tracking number: {row.tracking_number}</p>}
        {row.status === "draft" && <p>No payment method is connected to this order draft. Do not pay through a method that has not been approved by the gallery.</p>}
      </aside>
    </div>
  </div>;
}
