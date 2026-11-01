import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateProduct, archiveProduct, publishProduct, uploadProductImage, confirmProductImageRights, adjustProductInventory, updateProductImageOrder, setProductImagePrimary } from "../actions";

export const metadata = { title: "Edit product" };

type ProductRow = {
  id: string; title: string; slug: string; sku: string | null; category_id: string | null;
  short_description: string; description: string; currency: string; price_minor: number | null;
  compare_at_price_minor: number | null; quantity_on_hand: number; status: string;
  materials: string[]; sizes: string[]; measurements: Record<string, unknown>;
  condition_notes: string; provenance: string; craft_story: string; seo_title: string | null; seo_description: string | null;
};
type ImageRow = { id: string; storage_path: string; alt_text: string; rights_confirmed: boolean; rights_evidence: string; sort_order: number; is_primary: boolean; created_at: string };
type MovementRow = { id: string; quantity_delta: number; reason: string; reference: string | null; created_at: string };

function displayMoneyInput(value: number | null, currency: string) {
  if (value === null) return "";
  try {
    const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
    return (value / (10 ** digits)).toFixed(digits);
  } catch { return ""; }
}

export default async function EditAdminProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <div className="page-shell"><div className="page-heading"><h1>Edit product</h1><p>Connect Supabase to manage the catalogue.</p></div></div>;

  const [productResult, categoryResult, imageResult, movementResult] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("id,name").order("sort_order", { ascending: true }),
    supabase.from("product_images").select("id,storage_path,alt_text,rights_confirmed,rights_evidence,sort_order,is_primary,created_at").eq("product_id", id).order("is_primary", { ascending: false }).order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    supabase.from("inventory_movements").select("id,quantity_delta,reason,reference,created_at").eq("product_id", id).order("created_at", { ascending: false }).limit(25),
  ]);
  if (productResult.error || !productResult.data) notFound();
  if (categoryResult.error || imageResult.error) throw new Error("Unable to load product editor data.");
  const product = productResult.data as ProductRow;
  const imageRows = (imageResult.data ?? []) as ImageRow[];
  const movements = (movementResult.data ?? []) as MovementRow[];
  const images = await Promise.all(imageRows.map(async (image) => {
    const { data } = await supabase.storage.from("product-media").createSignedUrl(image.storage_path, 900);
    return { ...image, url: data?.signedUrl ?? null };
  }));

  return <div className="page-shell admin-editor">
    <div className="breadcrumb"><Link href="/admin/products">PRODUCT CATALOGUE</Link> / EDIT PRODUCT</div>
    <div className="admin-page-heading"><div><div className="section-kicker">CATALOGUE MANAGEMENT</div><h1>{product.title}</h1><p>Update verified details and editorial information. Stock is managed through the inventory ledger below.</p></div><span className={"admin-status status-" + product.status}>{product.status}</span></div>

    <form action={updateProduct} className="admin-form">
      <input type="hidden" name="id" value={product.id} />
      <div className="admin-form-grid">
        <label>Product title<input name="title" required defaultValue={product.title} maxLength={180} /></label>
        <label>URL slug<input name="slug" required defaultValue={product.slug} maxLength={180} /></label>
        <label>SKU<input name="sku" defaultValue={product.sku ?? ""} maxLength={80} /></label>
        <label>Category<select name="category_id" defaultValue={product.category_id ?? ""}><option value="">Unassigned</option>{(categoryResult.data ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label>Currency<input name="currency" defaultValue={product.currency} pattern="[A-Za-z]{3}" maxLength={3} required /></label>
        <label>Price<input name="price" inputMode="decimal" defaultValue={displayMoneyInput(product.price_minor, product.currency)} /></label>
        <label>Compare-at price<input name="compare_at_price" inputMode="decimal" defaultValue={displayMoneyInput(product.compare_at_price_minor, product.currency)} /></label>
        <label className="admin-form-wide">Short description<input name="short_description" defaultValue={product.short_description} maxLength={240} /></label>
        <label className="admin-form-wide">Full description<textarea name="description" rows={5} defaultValue={product.description} maxLength={12000} /></label>
        <label>Materials (comma separated)<input name="materials" defaultValue={product.materials.join(", ")} /></label>
        <label>Sizes (comma separated)<input name="sizes" defaultValue={product.sizes.join(", ")} /></label>
        <label className="admin-form-wide">Measurements (JSON object)<textarea name="measurements" rows={3} defaultValue={JSON.stringify(product.measurements, null, 2)} /></label>
        <label className="admin-form-wide">Condition notes<textarea name="condition_notes" rows={3} defaultValue={product.condition_notes} maxLength={4000} /></label>
        <label className="admin-form-wide">Provenance<textarea name="provenance" rows={3} defaultValue={product.provenance} maxLength={4000} /></label>
        <label className="admin-form-wide">Craft story<textarea name="craft_story" rows={3} defaultValue={product.craft_story} maxLength={5000} /></label>
        <label>SEO title<input name="seo_title" defaultValue={product.seo_title ?? ""} maxLength={180} /></label>
        <label>SEO description<input name="seo_description" defaultValue={product.seo_description ?? ""} maxLength={320} /></label>
      </div>
      <div className="admin-form-actions"><button className="button-primary dark-button" type="submit">SAVE PRODUCT</button><Link href="/admin/products" className="text-link">BACK TO CATALOGUE</Link></div>
    </form>

    <section className="admin-media-section">
      <div className="section-kicker">INVENTORY CONTROL</div>
      <h2>Stock ledger</h2>
      <p>Current on-hand quantity: <strong>{product.quantity_on_hand}</strong>. Every adjustment is written atomically to the inventory movement ledger. Product detail edits cannot silently overwrite stock.</p>
      <form action={adjustProductInventory} className="shipment-form">
        <input type="hidden" name="product_id" value={product.id} />
        <label>Quantity change<input name="quantity_delta" type="number" step="1" required placeholder="Positive to add, negative to remove" /></label>
        <label>Reason<select name="reason" required defaultValue="correction"><option value="restock">Restock</option><option value="correction">Stock correction</option><option value="damage">Damage / write-off</option><option value="return">Customer return</option><option value="other">Other</option></select></label>
        <label>Reference (optional)<input name="reference" maxLength={120} placeholder="Supplier or stocktake reference" /></label>
        <button className="button-outline" type="submit">RECORD INVENTORY MOVEMENT</button>
      </form>
      <h3>Recent stock movements</h3>
      {movementResult.error ? <p className="catalogue-import-note">Movement history is unavailable. Verify the catalogue inventory migration.</p> : movements.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>DATE</th><th>REASON</th><th>CHANGE</th><th>REFERENCE</th></tr></thead>
            <tbody>{movements.map((movement) => (
              <tr key={movement.id}>
                <td>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(movement.created_at))}</td>
                <td>{movement.reason.replace(/_/g, " ")}</td>
                <td>{movement.quantity_delta > 0 ? "+" : ""}{movement.quantity_delta}</td>
                <td>{movement.reference || "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p className="empty-note">No stock movements have been recorded for this product.</p>}
    </section>

    <section className="admin-media-section">
      <div className="section-kicker">PRODUCT PHOTOGRAPHY</div><h2>Images & usage rights</h2>
      <p>Uploads stay in private storage. An image remains unavailable to the public until an administrator records its rights evidence and confirms permission.</p>
      {images.length ? <div className="admin-image-grid">{images.map((image) => <article className="admin-image-card" key={image.id}>
        {image.url ? <Image src={image.url} alt={image.alt_text} width={500} height={620} unoptimized /> : <div className="admin-image-placeholder">IMAGE PREVIEW UNAVAILABLE</div>}
        <strong>{image.alt_text}</strong>
        {image.is_primary && <span className="admin-status status-active">Primary display image</span>}
        <div className="admin-image-actions">
          <form action={updateProductImageOrder} className="admin-image-order-form">
            <input type="hidden" name="product_id" value={product.id} />
            <input type="hidden" name="image_id" value={image.id} />
            <label>Display order<input type="number" name="sort_order" min="0" max="9999" step="1" defaultValue={image.sort_order} required /></label>
            <button type="submit">SAVE ORDER</button>
          </form>
          {image.rights_confirmed && !image.is_primary && (
            <form action={setProductImagePrimary}>
              <input type="hidden" name="product_id" value={product.id} />
              <input type="hidden" name="image_id" value={image.id} />
              <button type="submit">SET AS PRIMARY</button>
            </form>
          )}
        </div>
        <span className={image.rights_confirmed ? "admin-status status-active" : "admin-status status-draft"}>{image.rights_confirmed ? "Rights confirmed" : "Rights not confirmed"}</span>
        {image.rights_confirmed ? <small>{image.rights_evidence}</small> : <form action={confirmProductImageRights} className="rights-form">
          <input type="hidden" name="product_id" value={product.id} /><input type="hidden" name="image_id" value={image.id} />
          <label>Rights evidence reference<input name="rights_evidence" required minLength={12} maxLength={1000} placeholder="Owner confirmation / licence reference" /></label>
          <label className="rights-confirm"><input type="checkbox" name="confirm_rights" value="yes" required /> I confirm the business owns or is authorized to use this exact image.</label>
          <button type="submit">CONFIRM IMAGE RIGHTS</button>
        </form>}
      </article>)}</div> : <div className="empty-note">No product images uploaded yet.</div>}
      <form action={uploadProductImage} className="admin-upload-form">
        <input type="hidden" name="product_id" value={product.id} />
        <label>Upload an original product image<input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/avif" required /></label>
        <label>Descriptive image alt text<input name="alt_text" maxLength={300} required /></label>
        <button className="button-outline" type="submit">UPLOAD TO PRIVATE MEDIA</button>
      </form>
    </section>

    <section className="admin-publish-section">
      <div><div className="section-kicker">PUBLICATION</div><h2>Publish this product</h2><p>Publishing requires a valid price and at least one image with confirmed rights evidence. The database enforces this rule.</p></div>
      {product.status === "active" ? <form action={archiveProduct}><input type="hidden" name="id" value={product.id} /><button className="button-outline" type="submit">ARCHIVE PRODUCT</button></form> : <form action={publishProduct}><input type="hidden" name="id" value={product.id} /><button className="button-primary dark-button" type="submit">PUBLISH PRODUCT</button></form>}
    </section>
  </div>;
}
