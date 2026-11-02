import { redirect } from "next/navigation";
import { isMySqlCatalogueEnabled } from "@/server/db";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Customers" };

export default async function AdminCustomersPage() {
  if (isMySqlCatalogueEnabled()) redirect("/admin/products");
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <div className="page-shell"><div className="page-heading"><h1>Customers</h1><p>Connect Supabase to view customer records.</p></div></div>;
  const { data, error } = await supabase.from("profiles")
    .select("id,email,full_name,phone,role,created_at")
    .order("created_at", { ascending: false }).limit(250);
  if (error) throw new Error("Unable to load customer profiles.");
  return <div className="page-shell">
    <div className="admin-page-heading"><div><div className="section-kicker">RELATIONSHIP MANAGEMENT</div><h1>Customers</h1><p>Customer contact details and account roles.</p></div><Link className="text-link" href="/admin">DASHBOARD</Link></div>
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>CUSTOMER</th><th>EMAIL</th><th>PHONE</th><th>ROLE</th><th>JOINED</th></tr></thead><tbody>
      {(data ?? []).map((customer) => <tr key={customer.id}><td><strong>{customer.full_name || "Customer"}</strong></td><td>{customer.email || "—"}</td><td>{customer.phone || "—"}</td><td>{customer.role}</td><td>{new Date(customer.created_at).toLocaleDateString("en-IN")}</td></tr>)}
    </tbody></table>{!(data ?? []).length && <div className="empty-note">No customer profiles exist yet.</div>}</div>
  </div>;
}
