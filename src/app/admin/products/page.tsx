import Link from "next/link";
import { ArrowUpRight, Package, Plus, Upload } from "lucide-react";
import { formatMoneyFromMinor } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Products" };

type ProductRow = { id: string; title: string; slug: string; sku: string | null; status: string; price_minor: number | null; currency: string; quantity_on_hand: number; updated_at: string };

export default async function AdminProductsPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return (
    <section className="owner-page">
      <div className="owner-page-heading"><div><span className="owner-eyebrow">CATALOGUE</span><h1>Products</h1><p>Connect the database to manage live catalogue records.</p></div></div>
      <div className="owner-setup-card"><Package size={22} /><div><h2>Catalogue connection required</h2><p>Configure the current database environment to activate product management.</p></div></div>
    </section>
  );

  const [productResult, activeResult, draftResult] = await Promise.all([
    supabase.from("products").select("id,title,slug,sku,status,price_minor,currency,quantity_on_hand,updated_at").order("updated_at", { ascending: false }).limit(250),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("status", "draft"),
  ]);
  if (productResult.error) throw new Error("Unable to load the product catalogue.");
  const products = (productResult.data ?? []) as ProductRow[];

  return (
    <section className="owner-page">
      <div className="owner-page-heading">
        <div><span className="owner-eyebrow">MERCHANDISING</span><h1>Products</h1><p>Keep the catalogue accurate, well presented and ready to publish.</p></div>
        <div className="owner-page-actions">
          <Link className="owner-secondary-action" href="/admin/products/import"><Upload size={16} /> Import CSV</Link>
          <Link className="owner-primary-action" href="/admin/products/new"><Plus size={17} /> Create product</Link>
        </div>
      </div>
      <div className="owner-inline-stats">
        <span><strong>{products.length}</strong> recent records shown</span>
        <span><strong>{activeResult.count ?? "—"}</strong> published</span>
        <span><strong>{draftResult.count ?? "—"}</strong> drafts</span>
      </div>
      <section className="owner-panel">
        <div className="owner-panel-heading"><div><span className="owner-eyebrow">CATALOGUE RECORDS</span><h2>All products</h2></div><Link href="/admin/media">Open media library <ArrowUpRight size={15} /></Link></div>
        <div className="owner-product-table-wrap">
          <table className="owner-product-table">
            <thead><tr><th>PRODUCT</th><th>SKU</th><th>STATUS</th><th>PRICE</th><th>STOCK</th><th /></tr></thead>
            <tbody>{products.map((product) => (
              <tr key={product.id}>
                <td><strong>{product.title}</strong><small>/{product.slug}</small></td>
                <td>{product.sku || "—"}</td>
                <td><span className={"owner-status owner-status-" + product.status}>{product.status}</span></td>
                <td>{product.price_minor === null ? "Price not set" : formatMoneyFromMinor(product.price_minor, product.currency)}</td>
                <td>{product.quantity_on_hand}</td>
                <td><Link href={"/admin/products/" + product.id}>Edit ↗</Link></td>
              </tr>
            ))}</tbody>
          </table>
          {!products.length && <div className="owner-panel-empty"><Package size={22} /><strong>No products yet</strong><p>Create a draft product or import a verified catalogue CSV.</p><Link className="owner-text-action" href="/admin/products/new">Create your first product ↗</Link></div>}
        </div>
      </section>
    </section>
  );
}
