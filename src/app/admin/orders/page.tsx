import Link from "next/link";
import { formatMoneyFromMinor } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Orders" };

export default async function AdminOrdersPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <div className="page-shell"><div className="page-heading"><h1>Orders</h1><p>Connect Supabase to view order operations.</p></div></div>;
  const { data, error } = await supabase.from("orders")
    .select("id,order_number,email,status,currency,total_minor,created_at,tracking_number")
    .order("created_at", { ascending: false }).limit(250);
  if (error) throw new Error("Unable to load orders.");
  return <div className="page-shell">
    <div className="admin-page-heading"><div><div className="section-kicker">COMMERCE OPERATIONS</div><h1>Orders</h1><p>Payment-state changes are handled only by verified provider webhooks.</p></div><Link className="text-link" href="/admin">DASHBOARD</Link></div>
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>STATUS</th><th>TOTAL</th><th>TRACKING</th><th>PLACED</th></tr></thead><tbody>
      {(data ?? []).map((order) => <tr key={order.id}><td><Link href={"/admin/orders/" + order.id}><strong>{order.order_number}</strong></Link></td><td>{order.email}</td><td><span className={"admin-status status-" + order.status}>{order.status.replaceAll("_", " ")}</span></td><td>{formatMoneyFromMinor(order.total_minor, order.currency)}</td><td>{order.tracking_number ?? "—"}</td><td>{new Date(order.created_at).toLocaleDateString("en-IN")}</td></tr>)}
    </tbody></table>{!(data ?? []).length && <div className="empty-note">No orders have been created yet.</div>}</div>
  </div>;
}
