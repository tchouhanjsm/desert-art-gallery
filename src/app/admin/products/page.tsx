import Link from "next/link";
import { formatMoneyFromMinor } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Product catalogue" };

type ProductRow = { id: string; title: string; slug: string; sku: string | null; status: string; price_minor: number | null; currency: string; quantity_on_hand: number; updated_at: string };

export default async function AdminProductsPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <div className="page-shell"><div className="page-heading"><div className="section-kicker">PRIVATE WORKSPACE</div><h1>Product catalogue</h1><p>Connect Supabase to activate catalogue operations.</p></div></div>;

  const { data, error } = await supabase.from("products")
    .select("id,title,slug,sku,status,price_minor,currency,quantity_on_hand,updated_at")
    .order("updated_at", { ascending: false }).limit(250);
  if (error) throw new Error("Unable to load the product catalogue.");
  const products = (data ?? []) as ProductRow[];

  return <div className="page-shell">
    <div className="admin-page-heading">
      <div><div className="section-kicker">PRIVATE WORKSPACE</div><h1>Product catalogue</h1><p>Manage verified details, drafts and auditable stock movements.</p></div>
      <div className="admin-form-actions"><Link className="button-outline" href="/admin/products/import">IMPORT CSV</Link><Link className="button-primary dark-button" href="/admin/products/new">CREATE PRODUCT</Link></div>
    </div>
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead><tr><th>PRODUCT</th><th>SKU</th><th>STATUS</th><th>PRICE</th><th>STOCK</th><th></th></tr></thead>
        <tbody>{products.map((product) => <tr key={product.id}>
          <td><strong>{product.title}</strong><small>/{product.slug}</small></td>
          <td>{product.sku || "—"}</td>
          <td><span className={"admin-status status-" + product.status}>{product.status}</span></td>
          <td>{product.price_minor === null ? "Not set" : formatMoneyFromMinor(product.price_minor, product.currency)}</td>
          <td>{product.quantity_on_hand}</td>
          <td><Link href={"/admin/products/" + product.id}>EDIT</Link></td>
        </tr>)}</tbody>
      </table>
      {!products.length && <div className="empty-note">No products are in the database yet. Create a draft to begin.</div>}
    </div>
  </div>;
}
