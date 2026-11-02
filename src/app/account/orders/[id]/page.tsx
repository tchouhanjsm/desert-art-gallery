import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { formatMoneyFromMinor } from "@/lib/money";
import { requireUser } from "@/server/auth/session";
import { getMySqlDb } from "@/server/db";
import { orderItems, orders } from "@/server/db/schema";

export const metadata = { title: "Order details" };
export default async function CustomerOrderDetailPage({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;const user=await requireUser();const db=getMySqlDb();
 const [row]=await db.select().from(orders).where(and(eq(orders.id,id),eq(orders.userId,user.id))).limit(1);
 if(!row)notFound();
 const itemRows=await db.select().from(orderItems).where(eq(orderItems.orderId,id));
 const tax=Array.isArray(row.taxBreakdown)?row.taxBreakdown:[];
 const address=row.shippingAddress??{};
 const tracking=(()=>{try{const url=row.trackingUrl?new URL(row.trackingUrl):null;return url&&url.protocol==="https:"?url.toString():null;}catch{return null;}})();
 const createdAt=row.createdAt;
 return <div className="page-shell">
  <div className="breadcrumb"><Link href="/account">MY ACCOUNT</Link> / ORDER {row.orderNumber}</div>
  <div className="page-heading"><div className="section-kicker">ORDER DETAILS</div><h1>{row.orderNumber}</h1><p>Created {createdAt.toLocaleDateString("en-IN")}</p><span className={"admin-status status-"+row.status}>{row.status.replaceAll("_"," ")}</span></div>
  {row.status==="draft"&&<div className="checkout-notice" role="status">This is an unpaid order draft. No payment has been requested or taken. The draft and inventory hold expire {row.expiresAt?row.expiresAt.toLocaleString("en-IN"):"when the reservation expires"}.</div>}
  {row.status==="expired"&&<div className="checkout-notice" role="status">This unpaid order draft expired. Its temporary inventory reservation is no longer active. Prepare a new order from your current bag if the pieces remain available.</div>}
  <div className="order-detail-layout">
   <section className="order-item-list"><h2>Items in this order</h2>
    {itemRows.map(item=><article className="order-item" key={item.id}><div><strong>{item.productTitle}</strong>{item.variantLabel&&<small>{item.variantLabel}</small>}{item.productSku&&<small>SKU {item.productSku}</small>}<p>Quantity: {item.quantity}</p></div><strong>{formatMoneyFromMinor(item.lineTotalMinor,row.currency)}</strong></article>)}
    <section className="account-section"><div className="section-kicker">DELIVERY AND TAX DISCLOSURES</div><h2>{row.shippingRateName??"Shipping details"}</h2>
      {row.shippingZoneName&&<p>Delivery zone: {row.shippingZoneName}</p>}
      {row.shippingDeliveryMinDays!==null&&row.shippingDeliveryMaxDays!==null?<p>Configured delivery window: {row.shippingDeliveryMinDays}–{row.shippingDeliveryMaxDays} days</p>:<p>No delivery window was configured for this option.</p>}
      {row.dutiesDisclosure&&<p>{row.dutiesDisclosure}</p>}
      {tax.map((part,index)=>{const item=part as {name?:string;amount_minor?:number};return <p key={(item.name??"tax")+index}>{item.name??"Tax"}: {formatMoneyFromMinor(item.amount_minor??0,row.currency)}</p>;})}
      {row.taxDisclosure&&<p>{row.taxDisclosure}</p>}
    </section>
   </section>
   <aside className="cart-summary"><div className="section-kicker">ORDER SUMMARY</div>
    <div className="cart-summary-row"><span>Subtotal</span><strong>{formatMoneyFromMinor(row.subtotalMinor,row.currency)}</strong></div>
    <div className="cart-summary-row"><span>Shipping</span><strong>{formatMoneyFromMinor(row.shippingMinor,row.currency)}</strong></div>
    <div className="cart-summary-row"><span>Tax</span><strong>{formatMoneyFromMinor(row.taxMinor,row.currency)}</strong></div>
    <div className="cart-summary-row"><span>Discount</span><strong>−{formatMoneyFromMinor(row.discountMinor,row.currency)}</strong></div>
    <div className="cart-summary-row"><span>Total</span><strong>{formatMoneyFromMinor(row.totalMinor,row.currency)}</strong></div>
    {tracking&&<p><a href={tracking} target="_blank" rel="noreferrer">TRACK SHIPMENT ↗</a></p>}
    {row.trackingNumber&&<p>Tracking number: {row.trackingNumber}</p>}
    {row.status==="draft"&&<p>No payment method is connected to this draft. Do not send payment outside an approved gallery checkout flow.</p>}
   </aside>
  </div>
 </div>;
}
