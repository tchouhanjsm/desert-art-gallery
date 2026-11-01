import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatMoneyFromMinor } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Order = { id: string; order_number: string; status: string; currency: string; subtotal_minor: number; shipping_minor: number; tax_minor: number; discount_minor: number; total_minor: number; created_at: string; tracking_carrier: string | null; tracking_number: string | null; tracking_url: string | null };
type Item = { id: string; product_title: string; product_sku: string | null; quantity: number; unit_price_minor: number; line_total_minor: number };

export default async function CustomerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) notFound();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");
  const { data: order, error } = await supabase.from("orders").select("id,order_number,status,currency,subtotal_minor,shipping_minor,tax_minor,discount_minor,total_minor,created_at,tracking_carrier,tracking_number,tracking_url").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error || !order) notFound();
  const { data: itemData, error: itemError } = await supabase.from("order_items").select("id,product_title,product_sku,quantity,unit_price_minor,line_total_minor").eq("order_id", id);
  if (itemError) throw new Error("Unable to load order line items.");
  const items = (itemData ?? []) as Item[];
  const row = order as Order;
  const trackingUrl = (() => { try { const url = row.tracking_url ? new URL(row.tracking_url) : null; return url && ["http:", "https:"].includes(url.protocol) ? url.toString() : null; } catch { return null; } })();

  return <div className="page-shell">
    <div className="breadcrumb"><Link href="/account">MY ACCOUNT</Link> / ORDER {row.order_number}</div>
    <div className="page-heading"><div className="section-kicker">ORDER DETAILS</div><h1>{row.order_number}</h1><p>Placed {new Date(row.created_at).toLocaleDateString("en-IN")}</p><span className={"admin-status status-" + row.status}>{row.status.replaceAll("_", " ")}</span></div>
    <div className="order-detail-layout"><section className="order-item-list"><h2>Items in this order</h2>{items.map((item) => <article className="order-item" key={item.id}><div><strong>{item.product_title}</strong>{item.product_sku && <small>SKU {item.product_sku}</small>}<p>Quantity: {item.quantity}</p></div><strong>{formatMoneyFromMinor(item.line_total_minor, row.currency)}</strong></article>)}</section>
      <aside className="cart-summary"><div className="section-kicker">PAYMENT SUMMARY</div><div className="cart-summary-row"><span>Subtotal</span><strong>{formatMoneyFromMinor(row.subtotal_minor, row.currency)}</strong></div><div className="cart-summary-row"><span>Shipping</span><strong>{formatMoneyFromMinor(row.shipping_minor, row.currency)}</strong></div><div className="cart-summary-row"><span>Tax</span><strong>{formatMoneyFromMinor(row.tax_minor, row.currency)}</strong></div><div className="cart-summary-row"><span>Discount</span><strong>−{formatMoneyFromMinor(row.discount_minor, row.currency)}</strong></div><div className="cart-summary-row"><span>Total</span><strong>{formatMoneyFromMinor(row.total_minor, row.currency)}</strong></div>
        {trackingUrl && <p><a href={trackingUrl} target="_blank" rel="noreferrer">TRACK SHIPMENT ↗</a></p>}{row.tracking_number && <p>Tracking number: {row.tracking_number}</p>}
      </aside></div>
  </div>;
}
