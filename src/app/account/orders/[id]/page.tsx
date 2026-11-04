import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatMoneyFromMinor } from "@/lib/money";

function formatOrderStatus(status: string) {
  const labels: Record<string, string> = {
    draft: "注文案", pending_payment: "お支払い待ち", paid: "お支払い済み",
    processing: "準備中", shipped: "発送済み", delivered: "お届け済み",
    cancelled: "キャンセル", refunded: "返金済み", expired: "期限切れ",
  };
  return labels[status] ?? "注文状況を確認中";
}
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentCustomer, isMySqlCustomerAuthEnabled } from "@/server/auth/local-customer";
import { getMySqlCustomerOrder } from "@/server/checkout/mysql-orders";

type 税金Component = { name: string; rate_basis_points: number; amount_minor: number };
type LegacyOrder = {
  id: string; order_number: string; status: string; currency: string;
  subtotal_minor: number; shipping_minor: number; tax_minor: number; discount_minor: number; total_minor: number;
  created_at: string; expires_at: string | null; shipping_zone_name: string | null; shipping_rate_name: string | null;
  shipping_delivery_min_days: number | null; shipping_delivery_max_days: number | null;
  duties_disclosure: string | null; tax_breakdown: 税金Component[]; tax_disclosure: string | null;
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
      <div className="breadcrumb"><Link href="/account">マイページ</Link> / 注文番号 {order.orderNumber}</div>
      <div className="page-heading"><div className="section-kicker">注文詳細</div><h1>{order.orderNumber}</h1><p>注文日：{new Date(order.createdAt).toLocaleDateString("ja-JP")}</p><span className={"admin-status status-" + order.status}>{formatOrderStatus(order.status)}</span></div>
      {order.status === "draft" && <div className="checkout-notice" role="status">こちらはお支払い前の注文案です。決済は行われていません。注文案と一時的な在庫確保の期限：{new Date(order.expiresAt).toLocaleString("ja-JP")}.</div>}
      {order.status === "expired" && <div className="checkout-notice" role="status">この注文案は期限切れです。一時的な在庫確保は終了しています。商品が引き続き購入可能な場合は、新しい注文手続きを行ってください。</div>}
      <div className="order-detail-layout">
        <section className="order-item-list">
          <h2>ご注文の商品</h2>
          {items.map((item) => <article className="order-item" key={item.id}><div><strong>{item.productTitle}</strong><small>{item.variantLabel}</small>{item.productSku && <small>SKU {item.productSku}</small>}<p>数量：{item.quantity}</p></div><strong>{formatMoneyFromMinor(item.line合計Minor, order.currency)}</strong></article>)}
          <section className="account-section"><div className="section-kicker">お届け先</div><h2>配送先住所</h2><p>{typeof address.recipient_name === "string" ? address.recipient_name : order.email}<br/>{addressLine}</p></section>
          <section className="account-section"><div className="section-kicker">配送・税金の内容</div><h2>{order.shippingRateName}</h2><p>配送地域：{order.shippingZoneName}</p>
            {order.shippingDeliveryMinDays !== null && order.shippingDeliveryMaxDays !== null
              ? <p>設定済みのお届け目安：{order.shippingDeliveryMinDays}–{order.shippingDeliveryMaxDays}日</p>
              : <p>この配送方法のお届け目安は設定されていません。</p>}
            <p>{order.dutiesDisclosure}</p>
            {taxes.map((tax, index) => <p key={tax.name + index}>{tax.name}: {formatMoneyFromMinor(tax.amount_minor, order.currency)} ({tax.rate_basis_points} bps)</p>)}
            <p>{order.taxDisclosure}</p>
          </section>
        </section>
        <aside className="cart-summary"><div className="section-kicker">ご注文内容</div>
          <div className="cart-summary-row"><span>商品小計</span><strong>{formatMoneyFromMinor(order.subtotalMinor, order.currency)}</strong></div>
          <div className="cart-summary-row"><span>送料</span><strong>{formatMoneyFromMinor(order.shippingMinor, order.currency)}</strong></div>
          <div className="cart-summary-row"><span>税金</span><strong>{formatMoneyFromMinor(order.taxMinor, order.currency)}</strong></div>
          <div className="cart-summary-row"><span>割引</span><strong>−{formatMoneyFromMinor(order.discountMinor, order.currency)}</strong></div>
          <div className="cart-summary-row"><span>合計</span><strong>{formatMoneyFromMinor(order.totalMinor, order.currency)}</strong></div>
          {trackingUrl && <p><a href={trackingUrl} target="_blank" rel="noreferrer">配送状況を確認</a></p>}
          {order.trackingNumber && <p>追跡番号：{order.trackingNumber}</p>}
          {order.status === "draft" && <p>この注文案には決済方法が接続されていません。ギャラリーが承認した決済手続き以外でのお支払いはお控えください。</p>}
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
  if (itemError) throw new Error("注文商品を読み込めませんでした。");
  const items = (itemData ?? []) as LegacyItem[];
  const row = order as unknown as LegacyOrder;
  const taxComponents = Array.isArray(row.tax_breakdown) ? row.tax_breakdown : [];
  const trackingUrl = (() => {
    try { const url = row.tracking_url ? new URL(row.tracking_url) : null; return url && url.protocol === "https:" ? url.toString() : null; }
    catch { return null; }
  })();

  return <div className="page-shell">
    <div className="breadcrumb"><Link href="/account">マイページ</Link> / 注文番号 {row.order_number}</div>
    <div className="page-heading"><div className="section-kicker">注文詳細</div><h1>{row.order_number}</h1><p>注文日：{new Date(row.created_at).toLocaleDateString("ja-JP")}</p><span className={"admin-status status-" + row.status}>{formatOrderStatus(row.status)}</span></div>
    {row.status === "draft" && <div className="checkout-notice" role="status">This is an unpaid order draft. No payment has been requested or taken. The draft and its inventory hold expire {row.expires_at ? new Date(row.expires_at).toLocaleString("ja-JP") : "when the reservation expires"}.</div>}
    {row.status === "expired" && <div className="checkout-notice" role="status">この注文案は期限切れです。一時的な在庫確保は終了しています。商品が引き続き購入可能な場合は、カートから新しい注文手続きを行ってください。</div>}
    <div className="order-detail-layout">
      <section className="order-item-list"><h2>ご注文の商品</h2>
        {items.map((item) => <article className="order-item" key={item.id}><div><strong>{item.product_title}</strong>{item.variant_label && <small>{item.variant_label}</small>}{item.product_sku && <small>SKU {item.product_sku}</small>}<p>数量：{item.quantity}</p></div><strong>{formatMoneyFromMinor(item.line_total_minor, row.currency)}</strong></article>)}
        <section className="account-section"><div className="section-kicker">配送・税金に関するご案内</div><h2>{row.shipping_rate_name ?? "送料 details"}</h2>
          {row.shipping_zone_name && <p>配送地域：{row.shipping_zone_name}</p>}
          {row.shipping_delivery_min_days !== null && row.shipping_delivery_max_days !== null ? <p>設定済みのお届け目安：{row.shipping_delivery_min_days}–{row.shipping_delivery_max_days}日</p> : <p>この配送方法のお届け目安は設定されていません。</p>}
          {row.duties_disclosure && <p>{row.duties_disclosure}</p>}{taxComponents.map((tax,index)=><p key={tax.name+index}>{tax.name}: {formatMoneyFromMinor(tax.amount_minor,row.currency)}</p>)}{row.tax_disclosure && <p>{row.tax_disclosure}</p>}
        </section>
      </section>
      <aside className="cart-summary"><div className="section-kicker">ご注文内容</div>
        <div className="cart-summary-row"><span>商品小計</span><strong>{formatMoneyFromMinor(row.subtotal_minor,row.currency)}</strong></div>
        <div className="cart-summary-row"><span>送料</span><strong>{formatMoneyFromMinor(row.shipping_minor,row.currency)}</strong></div>
        <div className="cart-summary-row"><span>税金</span><strong>{formatMoneyFromMinor(row.tax_minor,row.currency)}</strong></div>
        <div className="cart-summary-row"><span>割引</span><strong>−{formatMoneyFromMinor(row.discount_minor,row.currency)}</strong></div>
        <div className="cart-summary-row"><span>合計</span><strong>{formatMoneyFromMinor(row.total_minor,row.currency)}</strong></div>
        {trackingUrl && <p><a href={trackingUrl} target="_blank" rel="noreferrer">配送状況を確認</a></p>}{row.tracking_number && <p>追跡番号：{row.tracking_number}</p>}
        {row.status === "draft" && <p>この注文案には決済方法が接続されていません。ギャラリーが承認した決済手続き以外でのお支払いはお控えください。</p>}
      </aside>
    </div>
  </div>;
}
