import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatMoneyFromMinor } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentCustomer, isMySqlCustomerAuthEnabled } from "@/server/auth/local-customer";

type TaxComponent = { name: string; rate_basis_points: number; amount_minor: number };
type Order = {
  id: string; order_number: string; status: string; currency: string;
  subtotal_minor: number; shipping_minor: number; tax_minor: number; discount_minor: number; total_minor: number;
  created_at: string; expires_at: string | null; shipping_zone_name: string | null; shipping_rate_name: string | null;
  shipping_delivery_min_days: number | null; shipping_delivery_max_days: number | null;
  duties_disclosure: string | null; tax_breakdown: TaxComponent[]; tax_disclosure: string | null;
  tracking_carrier: string | null; tracking_number: string | null; tracking_url: string | null;
};
type Item = { id: string; product_title: string; product_sku: string | null; variant_label: string | null; quantity: number; unit_price_minor: number; line_total_minor: number };

export default async function CustomerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isMySqlCustomerAuthEnabled()) {
    const customer = await getCurrentCustomer();
    if (!customer) redirect("/login");
    return <div className="page-shell"><div className="breadcrumb"><Link href="/account">MY ACCOUNT</Link></div><div className="page-heading"><div className="section-kicker">ORDER DETAILS</div><h1>Order history is the next phase</h1><p>MySQL customer identity and saved addresses are ready for local acceptance. Customer orders and order detail records have not been migrated yet.</p></div><div className="checkout-notice">This route does not read legacy Supabase orders in MySQL customer mode.</div></div>;
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
    .select("id,product_title,product_sku,variant_label,quantity,unit_price_minor,line_total_minor")
    .eq("order_id", id);
  if (itemError) throw new Error("Unable to load order line items.");
  const items = (itemData ?? []) as Item[];
  const row = order as unknown as Order;
  const taxComponents = Array.isArray(row.tax_breakdown) ? row.tax_breakdown : [];
  const trackingUrl = (() => {
    try { const url = row.tracking_url ? new URL(row.tracking_url) : null; return url && url.protocol === "https:" ? url.toString() : null; }
    catch { return null; }
  })();

  return <div className="page-shell">
    <div className="breadcrumb"><Link href="/account">MY ACCOUNT</Link> / ORDER {row.order_number}</div>
    <div className="page-heading"><div className="section-kicker">ORDER DETAILS</div><h1>{row.order_number}</h1><p>Created {new Date(row.created_at).toLocaleDateString("en-IN")}</p><span className={"admin-status status-" + row.status}>{row.status.replaceAll("_", " ")}</span></div>
    {row.status === "draft" && <div className="checkout-notice" role="status">This is an unpaid order draft. No payment has been requested or taken. The draft and its inventory hold expire {row.expires_at ? new Date(row.expires_at).toLocaleString("en-IN") : "when the reservation expires"}.</div>}
    {row.status === "expired" && <div className="checkout-notice" role="status">This unpaid order draft expired. Its temporary inventory reservation is no longer active. Prepare a new order from your current bag if the pieces remain available.</div>}
    <div className="order-detail-layout">
      <section className="order-item-list">
        <h2>Items in this order</h2>
        {items.map((item) => <article className="order-item" key={item.id}><div><strong>{item.product_title}</strong>{item.variant_label && <small>{item.variant_label}</small>}{item.product_sku && <small>SKU {item.product_sku}</small>}<p>Quantity: {item.quantity}</p></div><strong>{formatMoneyFromMinor(item.line_total_minor, row.currency)}</strong></article>)}
        <section className="account-section">
          <div className="section-kicker">DELIVERY AND TAX DISCLOSURES</div>
          <h2>{row.shipping_rate_name ?? "Shipping details"}</h2>
          {row.shipping_zone_name && <p>Delivery zone: {row.shipping_zone_name}</p>}
          {row.shipping_delivery_min_days !== null && row.shipping_delivery_max_days !== null
            ? <p>Configured delivery window: {row.shipping_delivery_min_days}–{row.shipping_delivery_max_days} days</p>
            : <p>No delivery window was configured for this option.</p>}
          {row.duties_disclosure && <p>{row.duties_disclosure}</p>}
          {taxComponents.map((tax, index) => <p key={tax.name + index}>{tax.name}: {formatMoneyFromMinor(tax.amount_minor, row.currency)}</p>)}
          {row.tax_disclosure && <p>{row.tax_disclosure}</p>}
        </section>
      </section>
      <aside className="cart-summary">
        <div className="section-kicker">ORDER SUMMARY</div>
        <div className="cart-summary-row"><span>Subtotal</span><strong>{formatMoneyFromMinor(row.subtotal_minor, row.currency)}</strong></div>
        <div className="cart-summary-row"><span>Shipping</span><strong>{formatMoneyFromMinor(row.shipping_minor, row.currency)}</strong></div>
        <div className="cart-summary-row"><span>Tax</span><strong>{formatMoneyFromMinor(row.tax_minor, row.currency)}</strong></div>
        <div className="cart-summary-row"><span>Discount</span><strong>−{formatMoneyFromMinor(row.discount_minor, row.currency)}</strong></div>
        <div className="cart-summary-row"><span>Total</span><strong>{formatMoneyFromMinor(row.total_minor, row.currency)}</strong></div>
        {trackingUrl && <p><a href={trackingUrl} target="_blank" rel="noreferrer">TRACK SHIPMENT ↗</a></p>}
        {row.tracking_number && <p>Tracking number: {row.tracking_number}</p>}
        {row.status === "draft" && <p>No payment method is connected to this draft. Do not send payment outside an approved gallery checkout flow.</p>}
      </aside>
    </div>
  </div>;
}
