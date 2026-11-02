import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoneyFromMinor } from "@/lib/money";
import { eq } from "drizzle-orm";
import { getMySqlDb } from "@/server/db";
import { orderItems, orders } from "@/server/db/schema";
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

export default async function AdminOrderDetailPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const [order]=await getMySqlDb().select().from(orders).where(eq(orders.id,id)).limit(1);
 if(!order)notFound();
 const itemRows=await getMySqlDb().select().from(orderItems).where(eq(orderItems.orderId,id));
 const address=order.shippingAddress??{};
 const addressLine=[address.address_line_1,address.address_line_2,address.city,address.region,address.postal_code,address.country_code].filter(part=>typeof part==="string"&&part.trim()).join(", ");
 const tax=Array.isArray(order.taxBreakdown)?order.taxBreakdown:[];
 const nextStatus=order.status==="paid"?"processing":order.status==="processing"?"shipped":order.status==="shipped"?"delivered":null;

  return <div className="page-shell">
    <div className="breadcrumb"><Link href="/admin/orders">ORDERS</Link> / {order.orderNumber}</div>
    <div className="admin-page-heading"><div><div className="section-kicker">COMMERCE OPERATIONS</div><h1>{order.orderNumber}</h1><p>{order.email} · {new Date(order.createdAt.toISOString()).toLocaleString("en-IN")}</p></div><span className={"admin-status status-" + order.status}>{order.status.replaceAll("_"," ")}</span></div>
    {order.status === "draft" && <div className="checkout-notice">Unpaid draft only. No payment has been requested or taken. Expires {order.expiresAt?.toISOString() ?? null ? new Date(order.expiresAt?.toISOString() ?? null).toLocaleString("en-IN") : "with its inventory reservation"}.</div>}
    <div className="order-detail-layout">
      <section className="order-item-list">
        <h2>Items</h2>
        {itemRows.map((item) => <article className="order-item" key={item.id}><div><strong>{item.productTitle}</strong>{item.variantLabel && <small>{item.variantLabel}</small>}{item.productSku && <small>SKU {item.productSku}</small>}<p>Quantity: {item.quantity} · Unit {formatMoneyFromMinor(item.unitPriceMinor,order.currency)}</p></div><strong>{formatMoneyFromMinor(item.lineTotalMinor,order.currency)}</strong></article>)}
        <section className="account-section"><div className="section-kicker">DELIVERY DESTINATION</div><h2>Shipping address</h2><p>{typeof address.recipient_name === "string" ? address.recipient_name : order.email}<br/>{addressLine}</p></section>
        <section className="account-section"><div className="section-kicker">SHIPPING AND TAX SNAPSHOT</div><h2>{order.shippingRateName ?? "Shipping option"}</h2>
          {order.shippingZoneName && <p>Zone: {order.shippingZoneName}</p>}
          {order.shippingDeliveryMinDays !== null && order.shippingDeliveryMaxDays !== null ? <p>Configured delivery window: {order.shippingDeliveryMinDays}–{order.shippingDeliveryMaxDays} days</p> : <p>No delivery window configured.</p>}
          {order.dutiesDisclosure && <p>{order.dutiesDisclosure}</p>}
          {tax.map((tax,index) => <p key={String((tax as {name?:string}).name ?? "tax") + index}>{tax.name}: {formatMoneyFromMinor(Number((tax as {amount_minor?:number}).amount_minor ?? 0),order.currency)}</p>)}
          {order.taxDisclosure && <p>{order.taxDisclosure}</p>}
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
        <div className="cart-summary-row"><span>Subtotal</span><strong>{formatMoneyFromMinor(order.subtotalMinor,order.currency)}</strong></div>
        <div className="cart-summary-row"><span>Shipping</span><strong>{formatMoneyFromMinor(order.shippingMinor,order.currency)}</strong></div>
        <div className="cart-summary-row"><span>Tax</span><strong>{formatMoneyFromMinor(order.taxMinor,order.currency)}</strong></div>
        <div className="cart-summary-row"><span>Discount</span><strong>−{formatMoneyFromMinor(order.discountMinor,order.currency)}</strong></div>
        <div className="cart-summary-row"><span>Total</span><strong>{formatMoneyFromMinor(order.totalMinor,order.currency)}</strong></div>
        <p>Payment state can only be changed by a verified provider webhook. This workspace cannot mark an order paid or issue a refund.</p>
      </aside>
    </div>
  </div>;
}
