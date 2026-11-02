import Image from "next/image";
import Link from "next/link";
import { AlertCircle, Images, Package, ShieldCheck, Upload } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  confirmProductImageRights,
  setProductImagePrimary,
  updateProductImageOrder,
  uploadProductImage,
} from "../products/actions";

export const metadata = {
  title: "Media library",
  robots: { index: false, follow: false },
};

type ProductOption = { id: string; title: string; slug: string; status: string };
type RelatedProduct = ProductOption | ProductOption[] | null;
type MediaRow = {
  id: string;
  product_id: string;
  storage_path: string;
  alt_text: string;
  rights_confirmed: boolean;
  rights_evidence: string;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
  products: RelatedProduct;
};

function relatedProduct(value: RelatedProduct): ProductOption | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default async function AdminMediaPage() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <section className="owner-page">
        <header className="owner-page-heading">
          <div><span className="owner-eyebrow">VISUAL MERCHANDISING</span><h1>Media library</h1><p>Manage the photographs attached to your catalogue.</p></div>
        </header>
        <div className="owner-setup-card">
          <AlertCircle size={22} />
          <div><h2>Media storage is not connected</h2><p>Connect the configured database and private product-media storage to review and manage gallery photographs. This preview contains no live media.</p></div>
        </div>
      </section>
    );
  }

  const [productResult, mediaResult] = await Promise.all([
    supabase.from("products").select("id,title,slug,status").order("title", { ascending: true }).limit(500),
    supabase.from("product_images")
      .select("id,product_id,storage_path,alt_text,rights_confirmed,rights_evidence,sort_order,is_primary,created_at,products(id,title,slug,status)")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (productResult.error || mediaResult.error) {
    throw new Error("Unable to load the media library. Check the product-media migration and database permissions.");
  }

  const products = (productResult.data ?? []) as ProductOption[];
  const rows = (mediaResult.data ?? []) as unknown as MediaRow[];
  const media = await Promise.all(rows.map(async (row) => {
    const { data } = await supabase.storage.from("product-media").createSignedUrl(row.storage_path, 900);
    return { ...row, url: data?.signedUrl ?? null, product: relatedProduct(row.products) };
  }));
  const confirmedCount = media.filter((item) => item.rights_confirmed).length;
  const awaitingCount = media.length - confirmedCount;

  return (
    <section className="owner-page">
      <header className="owner-page-heading">
        <div>
          <span className="owner-eyebrow">VISUAL MERCHANDISING</span>
          <h1>Media library</h1>
          <p>Review product photography, upload new images and confirm usage rights before publication.</p>
        </div>
        <Link className="owner-primary-action" href="/admin/products"><Package size={16} /> Product catalogue</Link>
      </header>

      <div className="owner-media-metrics">
        <div><Images size={18} /><span><strong>{media.length}</strong><small>Images in catalogue</small></span></div>
        <div><ShieldCheck size={18} /><span><strong>{confirmedCount}</strong><small>Rights confirmed</small></span></div>
        <div><AlertCircle size={18} /><span><strong>{awaitingCount}</strong><small>Awaiting confirmation</small></span></div>
      </div>

      <section className="owner-upload-panel">
        <div className="owner-upload-heading">
          <span className="owner-eyebrow">ADD PHOTOGRAPHY</span>
          <h2>Bring a piece into focus.</h2>
          <p>Upload an original image, select its product and provide descriptive alt text. New images remain private until their usage rights are confirmed.</p>
        </div>
        <form action={uploadProductImage} className="owner-upload-form">
          <label>Product
            <select name="product_id" required defaultValue="">
              <option value="" disabled>Select a catalogue product</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.title} · {product.status}</option>)}
            </select>
          </label>
          <label>Photograph
            <input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/avif" required />
            <small>JPEG, PNG, WebP or AVIF · maximum 12 MB</small>
          </label>
          <label className="owner-upload-alt">Image description
            <input name="alt_text" required maxLength={300} placeholder="Describe the visible product and view" />
          </label>
          <button className="owner-primary-action" type="submit"><Upload size={16} /> Upload photograph</button>
        </form>
      </section>

      <div className="owner-media-section-heading">
        <div><span className="owner-eyebrow">CATALOGUE ASSETS</span><h2>Product photographs</h2></div>
        <span>{media.length} items · latest first</span>
      </div>

      {media.length ? (
        <div className="owner-media-grid">
          {media.map((item) => (
            <article className="owner-media-card" key={item.id}>
              <div className="owner-media-preview">
                {item.url
                  ? <Image src={item.url} alt={item.alt_text || ""} fill sizes="(max-width: 640px) 88vw, (max-width: 1050px) 42vw, 260px" unoptimized />
                  : <div className="owner-media-unavailable"><Images size={24} /><span>PREVIEW UNAVAILABLE</span></div>}
                {item.is_primary && <span className="owner-media-primary">PRIMARY IMAGE</span>}
              </div>
              <div className="owner-media-card-body">
                <div className="owner-media-product">
                  <strong>{item.product?.title ?? "Unlinked product"}</strong>
                  {item.product && <Link href={"/admin/products/" + item.product.id}>Edit product ↗</Link>}
                </div>
                <p>{item.alt_text || "No alt text recorded."}</p>
                <span className={item.rights_confirmed ? "owner-media-rights is-confirmed" : "owner-media-rights is-pending"}>
                  {item.rights_confirmed ? "Usage rights confirmed" : "Awaiting rights confirmation"}
                </span>
                {item.rights_confirmed ? (
                  <>
                    <small className="owner-media-evidence">{item.rights_evidence}</small>
                    {!item.is_primary && item.product && <form action={setProductImagePrimary}>
                      <input type="hidden" name="product_id" value={item.product_id} />
                      <input type="hidden" name="image_id" value={item.id} />
                      <button className="owner-media-action" type="submit">Set as primary image</button>
                    </form>}
                  </>
                ) : (
                  <form action={confirmProductImageRights} className="owner-media-rights-form">
                    <input type="hidden" name="product_id" value={item.product_id} />
                    <input type="hidden" name="image_id" value={item.id} />
                    <label>Rights evidence reference
                      <input name="rights_evidence" required minLength={12} maxLength={1000} placeholder="Owner confirmation or licence reference" />
                    </label>
                    <label className="owner-confirm-check"><input type="checkbox" name="confirm_rights" value="yes" required /> I confirm the gallery is authorized to use this image.</label>
                    <button className="owner-media-action" type="submit">Confirm usage rights</button>
                  </form>
                )}
                <form action={updateProductImageOrder} className="owner-media-order-form">
                  <input type="hidden" name="product_id" value={item.product_id} />
                  <input type="hidden" name="image_id" value={item.id} />
                  <label>Order <input name="sort_order" type="number" min="0" max="9999" step="1" defaultValue={item.sort_order} required /></label>
                  <button className="owner-media-action owner-media-order-button" type="submit">Save order</button>
                </form>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="owner-panel-empty"><Images size={24} /><strong>No photographs yet</strong><p>Upload the first approved product image using the form above.</p></div>
      )}
    </section>
  );
}
