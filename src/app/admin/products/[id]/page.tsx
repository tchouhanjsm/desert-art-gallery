import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateProduct, archiveProduct, publishProduct, uploadProductImage, confirmProductImageRights } from "../actions";

export const metadata = { title: "Edit product" };

type ProductRow = {
  id: string; title: string; slug: string; sku: string | null; category_id: string | null;
  short_description: string; description: string; currency: string; price_minor: number | null;
  compare_at_price_minor: number | null; quantity_on_hand: number; status: string;
  materials: string[]; sizes: string[]; measurements: Record<string, unknown>;
  condition_notes: string; provenance: string; craft_story: string; seo_title: string | null; seo_description: string | null;
};
type ImageRow = { id: string; storage_path: string; alt_text: string; rights_confirmed: boolean; rights_evidence: string; sort_order: number };

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

  const [productResult, categoryResult, imageResult] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("id,name").order("sort_order", { ascending: true }),
    supabase.from("product_images").select("id,storage_path,alt_text,rights_confirmed,rights_evidence,sort_order").eq("product_id", id).order("sort_order", { ascending: true }),
  ]);
  if (productResult.error || !productResult.data) notFound();
  if (categoryResult.error || imageResult.error) throw new Error("Unable to load product editor data.");
  const product = productResult.data as ProductRow;
  const imageRows = (imageResult.data ?? []) as ImageRow[];
  const images = await Promise.all(imageRows.map(async (image) => {
    const { data } = await supabase.storage.from("product-media").createSignedUrl(image.storage_path, 900);
    return { ...image, url: data?.signedUrl ?? null };
  }));

  return <div className="page-shell admin-editor">
    <div className="breadcrumb"><Link href="/admin/products">PRODUCT CATALOGUE</Link> / EDIT PRODUCT</div>
    <div className="admin-page-heading"><div><div className="section-kicker">CATALOGUE MANAGEMENT</div><h1>{product.title}</h1><p>Update verified details, stock and editorial information.</p></div><span className={"admin-status status-" + product.status}>{product.status}</span></div>

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
        <label>Stock quantity<input name="quantity_on_hand" type="number" min="0" step="1" defaultValue={product.quantity_on_hand} required /></label>
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
      <div className="section-kicker">PRODUCT PHOTOGRAPHY</div><h2>Images & usage rights</h2>
      <p>Uploads stay in private storage. An image remains unavailable to the public until an administrator records its rights evidence and confirms permission.</p>
      {images.length ? <div className="admin-image-grid">{images.map((image) => <article className="admin-image-card" key={image.id}>
        {image.url ? <Image src={image.url} alt={image.alt_text} width={500} height={620} unoptimized /> : <div className="admin-image-placeholder">IMAGE PREVIEW UNAVAILABLE</div>}
        <strong>{image.alt_text}</strong>
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
