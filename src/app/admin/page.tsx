import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Administration" };

async function countRows(client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, table: "products" | "orders" | "profiles") {
  const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
  return error ? null : count;
}

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return <section className="page-shell"><div className="page-heading"><div className="section-kicker">PRIVATE WORKSPACE</div><h1>Administration</h1><p>Connect the Supabase project to activate the protected dashboard.</p></div><div className="empty-note">Set the required server and public Supabase variables in the deployment environment. No service credentials belong in browser code.</div></section>;
  }

  const [products, orders, customers] = await Promise.all([
    countRows(supabase, "products"),
    countRows(supabase, "orders"),
    countRows(supabase, "profiles"),
  ]);

  return <section className="page-shell">
    <div className="page-heading"><div className="section-kicker">PRIVATE WORKSPACE</div><h1>Gallery overview</h1><p>Operational counts are read live from the connected database.</p></div>
    <div className="admin-metrics">
      {[["Catalogue records", products], ["Orders", orders], ["Customer profiles", customers]].map(([label,value])=><div className="admin-metric" key={String(label)}><span>{label}</span><strong>{value === null ? "Unavailable" : value}</strong></div>)}
    </div>
    <div className="admin-links"><Link href="/admin/products">Product catalogue</Link><Link href="/admin/orders">Orders</Link><Link href="/admin/customers">Customers</Link><Link href="/admin/content">Site content</Link><Link href="/admin/checkout">Shipping & tax</Link></div>
  </section>;
}
