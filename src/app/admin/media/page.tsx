import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Images, ShieldCheck, ShieldAlert, Upload } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Media library" };

type MediaRow = {
  id: string;
  product_id: string;
  storage_path: string;
  alt_text: string | null;
  rights_confirmed: boolean;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
  products: { title: string; slug: string; status: string } | null;
};

export default async function AdminMediaPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return (
    <section className="owner-page">
      <div className="owner-page-heading"><div><span className="owner-eyebrow">GALLERY ASSETS</span><h1>Media library</h1><p>Review product photographs and their publication permissions.</p></div></div>
      <div className="owner-setup-card"><Images size={22} /><div><h2>Media storage connection required</h2><p>Connect the configured media storage to review uploaded product photographs.</p></div></div>
    </section>
  );

  const { data, error } = await supabase.from("product_images")
    .select("id,product_id,storage_path,alt_text,rights_confirmed,is_primary,sort_order,created_at,products!inner(title,slug,status)")
    .order("created_at", { ascending: false })
    .limit(120);

  if (error) throw new Error("Unable to load the media library.");
  const rows = (data ?? []) as unknown as MediaRow[];
  const paths = [...new Set(rows.map((row) => row.storage_path).filter(Boolean))];
  const signedResult = paths.length
    ? await supabase.storage.from("product-media").createSignedUrls(paths, 900)
    : { data: [], error: null };
  const signedMap = new Map((signedResult.data ?? []).flatMap((item) => item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : []));
  const imageCount = rows.length;
  const rightsPending = rows.filter((row) => !row.rights_confirmed).length;
  const unpublished = rows.filter((row) => row.products?.status !== "active").length;

  return (
    <section className="owner-page">
      <div className="owner-page-heading">
        <div><span className="owner-eyebrow">GALLERY ASSETS</span><h1>Media library</h1><p>Review uploaded product photographs, alt text and usage-rights status.</p></div>
        <Link className="owner-primary-action" href="/admin/products"><Upload size={16} /> Add to a product</Link>
      </div>
      <div className="owner-inline-stats">
        <span><strong>{imageCount}</strong> images in the latest 120 records</span>
        <span><strong>{rightsPending}</strong> awaiting rights confirmation</span>
        <span><strong>{unpublished}</strong> attached to unpublished products</span>
      </div>
      {signedResult.error && <div className="owner-inline-warning"><ShieldAlert size={16} /> Some image previews could not be generated. Open the product editor to review the original record.</div>}
      <div className="owner-media-grid">
        {rows.map((image) => {
          const product = image.products;
          return (
            <article className="owner-media-card" key={image.id}>
              <div className="owner-media-preview">
                {signedMap.has(image.storage_path)
                  ? <Image src={signedMap.get(image.storage_path)!} alt={image.alt_text || product?.title || "Product photograph"} fill sizes="(max-width: 640px) 44vw, (max-width: 1100px) 30vw, 22vw" unoptimized />
                  : <div className="owner-media-missing"><Images size={24} /><span>PREVIEW UNAVAILABLE</span></div>}
                {image.is_primary && <span className="owner-media-primary">PRIMARY IMAGE</span>}
              </div>
              <div className="owner-media-card-body">
                <div className="owner-media-product">{product?.title ?? "Unknown product"}</div>
                <p>{image.alt_text || "Alt text has not been provided."}</p>
                <div className="owner-media-status-row">
                  {image.rights_confirmed
                    ? <span className="owner-status owner-status-active"><ShieldCheck size={13} /> Rights confirmed</span>
                    : <span className="owner-status owner-status-draft"><ShieldAlert size={13} /> Rights pending</span>}
                  <span className="owner-media-order">Order {image.sort_order}</span>
                </div>
                {product && <Link className="owner-media-edit" href={"/admin/products/" + image.product_id}>Manage image & product <ArrowUpRight size={14} /></Link>}
              </div>
            </article>
          );
        })}
      </div>
      {!rows.length && <div className="owner-panel-empty owner-empty-media"><Images size={25} /><strong>Your media library is empty</strong><p>Upload original, gallery-approved photographs from an individual product editor. They will appear here for review.</p><Link className="owner-primary-action" href="/admin/products/new">Create your first product</Link></div>}
    </section>
  );
}
