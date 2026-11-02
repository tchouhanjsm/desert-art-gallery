import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createDraftProduct } from "../actions";

export const metadata = { title: "Create product" };

export default async function NewAdminProductPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <div className="page-shell"><div className="page-heading"><h1>New product</h1><p>Connect Supabase to manage the catalogue.</p></div></div>;

  const { data: categories, error } = await supabase.from("categories")
    .select("id,name").order("sort_order", { ascending: true });
  if (error) throw new Error("Unable to load product categories.");

  return <div className="page-shell admin-editor">
    <div className="breadcrumb"><Link href="/admin/products">PRODUCT CATALOGUE</Link> / NEW PRODUCT</div>
    <div className="page-heading"><div className="section-kicker">CATALOGUE MANAGEMENT</div><h1>Create a product</h1><p>New records are saved as drafts and cannot appear in the public shop until verified and published. Opening stock is recorded separately in the inventory ledger.</p></div>
    <form action={createDraftProduct} className="admin-form">
      <div className="admin-form-grid">
        <label>Product title<input name="title" required minLength={3} maxLength={180} /></label>
        <label>URL slug<input name="slug" placeholder="Generated from the title when empty" maxLength={180} /></label>
        <label>SKU<input name="sku" maxLength={80} /></label>
        <label>Category<select name="category_id"><option value="">Unassigned</option>{(categories ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label>Currency<input name="currency" defaultValue="USD" pattern="[A-Za-z]{3}" maxLength={3} required /></label>
        <label>Price<input name="price" inputMode="decimal" placeholder="Leave blank until verified" /></label>
        <label>Compare-at price<input name="compare_at_price" inputMode="decimal" /></label>
        <label className="admin-form-wide">Short description<input name="short_description" maxLength={240} /></label>
        <label className="admin-form-wide">Full description<textarea name="description" rows={5} maxLength={12000} /></label>
        <label>Materials (comma separated)<input name="materials" /></label>
        <label>Sizes (comma separated)<input name="sizes" /></label>
        <label className="admin-form-wide">Measurements (JSON object)<textarea name="measurements" rows={3} placeholder='{"chest":"...","length":"..."}' /></label>
        <label className="admin-form-wide">Condition notes<textarea name="condition_notes" rows={3} maxLength={4000} /></label>
        <label className="admin-form-wide">Provenance<textarea name="provenance" rows={3} maxLength={4000} /></label>
        <label className="admin-form-wide">Craft story<textarea name="craft_story" rows={3} maxLength={5000} /></label>
        <label>SEO title<input name="seo_title" maxLength={180} /></label>
        <label>SEO description<input name="seo_description" maxLength={320} /></label>
      </div>
      <div className="admin-form-actions"><button className="button-primary dark-button" type="submit">SAVE DRAFT PRODUCT</button><Link href="/admin/products" className="text-link">CANCEL</Link></div>
    </form>
  </div>;
}
