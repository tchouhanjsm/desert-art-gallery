import Link from "next/link";
import { desc } from "drizzle-orm";
import { formatMoneyFromMinor } from "@/lib/money";
import { getMySqlDb } from "@/server/db";
import { orders } from "@/server/db/schema";

export const metadata={title:"Orders"};
export default async function AdminOrdersPage(){
 const rows=await getMySqlDb().select().from(orders).orderBy(desc(orders.createdAt)).limit(250);
 return <div className="page-shell">
  <div className="admin-page-heading"><div><div className="section-kicker">COMMERCE OPERATIONS</div><h1>Orders</h1><p>Payment-state changes are restricted to verified payment-provider webhooks.</p></div><Link className="text-link" href="/admin">DASHBOARD</Link></div>
  <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>STATUS</th><th>TOTAL</th><th>TRACKING</th><th>PLACED</th></tr></thead><tbody>
   {rows.map(order=><tr key={order.id}><td><Link href={"/admin/orders/"+order.id}><strong>{order.orderNumber}</strong></Link></td><td>{order.email}</td><td><span className={"admin-status status-"+order.status}>{order.status.replaceAll("_"," ")}</span></td><td>{formatMoneyFromMinor(order.totalMinor,order.currency)}</td><td>{order.trackingNumber??"—"}</td><td>{order.createdAt.toLocaleDateString("en-IN")}</td></tr>)}
  </tbody></table>{!rows.length&&<div className="empty-note">No orders have been created yet.</div>}</div>
 </div>;
}
