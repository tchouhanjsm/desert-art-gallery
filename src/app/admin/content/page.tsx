import Image from "next/image";
import Link from "next/link";
import { AlertCircle, BookOpen, Images, Layers3, Users } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { getMySqlDb } from "@/server/db";
import { products } from "@/server/db/schema";
import { getCollectionProductSlugsByCollection, getEditorialWorkspace } from "@/server/editorial/repository";
import { getAdminEditorialMediaUrl } from "@/server/media/storage";
import {
  confirmEditorialImageRights,
  saveArtisanProfile,
  saveCollection,
  saveCollectionProducts,
  saveHomepageContent,
  saveJournalPost,
  uploadEditorialImage,
} from "./actions";

export const metadata = { title: "Website content", robots: { index: false, follow: false } };

type ContentBody = Record<string, unknown>;
type HomeRecord = { id: string; title: string; body: ContentBody; is_published: boolean; updated_at: Date | string };
type ProductOption = { slug: string; title: string };
type CollectionRecord = {
  id: string; name: string; slug: string; description: string; hero_image_path: string | null;
  hero_image_alt: string; hero_image_rights_confirmed: boolean; hero_image_rights_evidence: string;
  sort_order: number; is_published: boolean;
};
type ArtisanRecord = {
  id: string; full_name: string; role_title: string; short_bio: string; biography: string;
  craft_specialties: string[]; years_experience: number | null; portrait_path: string | null;
  portrait_alt_text: string; portrait_rights_confirmed: boolean; portrait_rights_evidence: string;
  sort_order: number; is_published: boolean;
};
type JournalRecord = {
  id: string; title: string; slug: string; excerpt: string; content_markdown: string; category: string;
  cover_image_path: string | null; cover_image_alt: string; cover_image_rights_confirmed: boolean;
  cover_image_rights_evidence: string; status: "draft" | "published" | "archived";
};

function bodyString(body: ContentBody, key: string, fallback = "") {
  const value = body[key];
  return typeof value === "string" ? value : fallback;
}

function RightsControl({ target, id, confirmed, evidence }: {
  target: "homepage" | "collection" | "artisan" | "journal";
  id: string;
  confirmed: boolean;
  evidence: string;
}) {
  if (confirmed) {
    return <div className="owner-cms-rights owner-cms-rights--confirmed"><span>Usage rights confirmed</span><small>{evidence}</small></div>;
  }
  return (
    <form action={confirmEditorialImageRights} className="owner-cms-rights-form">
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="id" value={id} />
      <label>Rights evidence reference
        <input name="rights_evidence" required minLength={12} maxLength={1000} placeholder="Owner confirmation or licence reference" />
      </label>
      <label className="owner-cms-confirm"><input type="checkbox" name="confirm_rights" value="yes" required /> I confirm the gallery is authorized to use this exact image.</label>
      <button className="owner-secondary-action" type="submit">Confirm image rights</button>
    </form>
  );
}

function EditorialUpload({ target, id, label, altText }: {
  target: "homepage" | "collection" | "artisan" | "journal";
  id: string;
  label: string;
  altText: string;
}) {
  return (
    <form action={uploadEditorialImage} className="owner-cms-upload">
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="id" value={id} />
      <label>{label}
        <input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/avif" required />
        <small>JPEG, PNG, WebP or AVIF · maximum 12 MB</small>
      </label>
      <label>Image description
        <input name="alt_text" defaultValue={altText} required maxLength={300} placeholder="Describe the visible image" />
      </label>
      <button className="owner-primary-action" type="submit"><Images size={15} /> Upload image</button>
    </form>
  );
}

export default async function AdminContentPage() {
  let workspace: Awaited<ReturnType<typeof getEditorialWorkspace>>;
  try { workspace = await getEditorialWorkspace(); }
  catch {
    return (
      <section className="owner-page">
        <header className="owner-page-heading"><div><span className="owner-eyebrow">EDITORIAL WORKSPACE</span><h1>Website content</h1><p>The local MySQL editorial database could not be loaded.</p></div></header>
        <div className="owner-inline-warning"><AlertCircle size={18} /> Start the local database and apply the Drizzle migrations before opening this workspace.</div>
      </section>
    );
  }
  const home: HomeRecord | null = workspace.home ? {
    id: workspace.home.id, title: workspace.home.title, body: workspace.home.body,
    is_published: workspace.home.is_published, updated_at: workspace.home.updated_at,
  } : null;
  const homeBody: ContentBody = home?.body ?? {};
  const collections: CollectionRecord[] = workspace.collections;
  const artisans: ArtisanRecord[] = workspace.artisans;
  const journal: JournalRecord[] = workspace.journal;
  const homePath = bodyString(homeBody, "hero_image_path") || null;
  const homePreview = homePath ? getAdminEditorialMediaUrl(homePath) : null;
  const collectionAssignments = await getCollectionProductSlugsByCollection(collections.map(item => item.id));
  const collectionCards = collections.map(item => ({
    ...item, preview: item.hero_image_path ? getAdminEditorialMediaUrl(item.hero_image_path) : null,
    productSlugs: collectionAssignments.get(item.id) ?? [],
  }));
  const artisanCards = artisans.map(item => ({...item,preview:item.portrait_path?getAdminEditorialMediaUrl(item.portrait_path):null}));
  const journalCards = journal.map(item => ({...item,preview:item.cover_image_path?getAdminEditorialMediaUrl(item.cover_image_path):null}));
  let productOptions: ProductOption[] = [];
  let productOptionsError = false;
  try { productOptions = await getMySqlDb().select({slug:products.slug,title:products.title}).from(products).where(eq(products.status,"active")).orderBy(asc(products.title)).limit(500); }
  catch { productOptionsError = true; }

  return (
    <section className="owner-page owner-cms">
      <header className="owner-page-heading">
        <div><span className="owner-eyebrow">EDITORIAL WORKSPACE</span><h1>Website content</h1><p>Update the homepage, collections, maker profiles and journal. Changes go live only when you choose to publish them.</p></div>
        <Link className="owner-secondary-action" href="/" target="_blank" rel="noreferrer">Preview storefront ↗</Link>
      </header>

      <div className="owner-cms-summary">
        <a href="#homepage-content"><BookOpen size={17} /><span><strong>Homepage</strong><small>{home?.is_published ? "Published" : "Draft / not configured"}</small></span></a>
        <a href="#collections-content"><Layers3 size={17} /><span><strong>{collections.length} collections</strong><small>Manage collection pages and images</small></span></a>
        <a href="#makers-content"><Users size={17} /><span><strong>{artisans.length} maker profiles</strong><small>Manage approved biographies</small></span></a>
        <a href="#journal-content"><BookOpen size={17} /><span><strong>{journal.length} stories</strong><small>Draft, publish and archive articles</small></span></a>
      </div>

      <section className="owner-panel owner-cms-section" id="homepage-content">
        <div className="owner-panel-heading"><div><span className="owner-eyebrow">01 / HOMEPAGE</span><h2>Hero and first impression</h2></div><span className={home?.is_published ? "owner-status owner-status-active" : "owner-status owner-status-draft"}>{home?.is_published ? "Published" : "Draft"}</span></div>
        <p className="owner-cms-help">Edit the hero message and calls to action. The hero image is optional; when supplied it remains private until usage rights are confirmed.</p>
        <form action={saveHomepageContent} className="admin-form">
          <div className="admin-form-grid">
            <label className="admin-form-wide">Eyebrow<input name="eyebrow" maxLength={120} defaultValue={bodyString(homeBody, "eyebrow", "A CURATED GALLERY · JAISALMER, RAJASTHAN")} /></label>
            <label>Headline line one<input name="line_one" required maxLength={120} defaultValue={bodyString(homeBody, "line_one", "Objects with")} /></label>
            <label>Accent word one<input name="accent_one" required maxLength={80} defaultValue={bodyString(homeBody, "accent_one", "stories.")} /></label>
            <label>Headline line two<input name="line_two" required maxLength={120} defaultValue={bodyString(homeBody, "line_two", "Textiles with")} /></label>
            <label>Accent word two<input name="accent_two" required maxLength={80} defaultValue={bodyString(homeBody, "accent_two", "character.")} /></label>
            <label className="admin-form-wide">Description<textarea name="description" rows={3} required maxLength={600} defaultValue={bodyString(homeBody, "description", "Discover a considered collection of textiles and objects, presented with the detail and context each piece deserves.")} /></label>
            <label>Primary button<input name="primary_cta_label" maxLength={80} defaultValue={bodyString(homeBody, "primary_cta_label", "Explore the collection")} /></label>
            <label>Secondary button<input name="secondary_cta_label" maxLength={80} defaultValue={bodyString(homeBody, "secondary_cta_label", "Our story")} /></label>
          </div>
          <div className="admin-form-actions">
            <label className="owner-cms-publish"><input type="checkbox" name="is_published" value="yes" defaultChecked={Boolean(home?.is_published)} /> Publish homepage changes</label>
            <button className="owner-primary-action" type="submit">Save homepage</button>
          </div>
        </form>
        {home && (
          <div className="owner-cms-image-tools">
            {homePreview ? <div className="owner-cms-image-preview"><Image src={homePreview} alt={bodyString(homeBody, "hero_image_alt", "Homepage hero")} fill sizes="(max-width:700px) 90vw, 360px" unoptimized /></div> : <div className="owner-cms-image-empty">No approved homepage photograph</div>}
            <div className="owner-cms-image-actions">
              <EditorialUpload target="homepage" id={home.id} label="Homepage hero image" altText={bodyString(homeBody, "hero_image_alt")} />
              {bodyString(homeBody, "hero_image_path") && <RightsControl target="homepage" id={home.id} confirmed={homeBody.hero_image_rights_confirmed === true} evidence={bodyString(homeBody, "hero_image_rights_evidence")} />}
            </div>
          </div>
        )}
      </section>

      <section className="owner-panel owner-cms-section" id="collections-content">
        <div className="owner-panel-heading"><div><span className="owner-eyebrow">02 / MERCHANDISING</span><h2>Collections</h2></div><span>{collections.length} records</span></div>
        <p className="owner-cms-help">Collections group related products and provide image-led entry points into the shop. New collections are saved as drafts.</p>
        <details className="owner-cms-record owner-cms-new">
          <summary>Create a collection</summary>
          <form action={saveCollection} className="admin-form">
            <div className="admin-form-grid">
              <label>Collection name<input name="name" required minLength={2} maxLength={120} /></label>
              <label>URL slug<input name="slug" maxLength={120} placeholder="Generated from the name if blank" /></label>
              <label className="admin-form-wide">Description<textarea name="description" rows={3} required maxLength={1200} /></label>
              <label>Display order<input type="number" name="sort_order" min="0" max="9999" defaultValue="0" /></label>
            </div>
            <div className="admin-form-actions"><span className="owner-status owner-status-draft">New collections start as drafts</span><button className="owner-primary-action" type="submit">Create collection</button></div>
          </form>
        </details>
        {collectionCards.map((item) => (
          <details className="owner-cms-record" key={item.id}>
            <summary><span>{item.name}</span><span className={item.is_published ? "owner-status owner-status-active" : "owner-status owner-status-draft"}>{item.is_published ? "Published" : "Draft"}</span></summary>
            <form action={saveCollection} className="admin-form">
              <input type="hidden" name="id" value={item.id} />
              <div className="admin-form-grid">
                <label>Collection name<input name="name" required defaultValue={item.name} maxLength={120} /></label>
                <label>URL slug<input name="slug" required defaultValue={item.slug} maxLength={120} /></label>
                <label className="admin-form-wide">Description<textarea name="description" rows={3} required defaultValue={item.description} maxLength={1200} /></label>
                <label>Display order<input type="number" name="sort_order" min="0" max="9999" defaultValue={item.sort_order} /></label>
              </div>
              <div className="admin-form-actions"><label className="owner-cms-publish"><input type="checkbox" name="is_published" value="yes" defaultChecked={item.is_published} /> Publish collection</label><button className="owner-primary-action" type="submit">Save collection</button></div>
            </form>
            <div className="owner-cms-image-tools">
              {item.preview ? <div className="owner-cms-image-preview"><Image src={item.preview} alt={item.hero_image_alt || item.name} fill sizes="(max-width:700px) 90vw, 240px" unoptimized /></div> : <div className="owner-cms-image-empty">No collection image</div>}
              <div className="owner-cms-image-actions">
                <EditorialUpload target="collection" id={item.id} label="Collection image" altText={item.hero_image_alt || item.name} />
                {item.hero_image_path && <RightsControl target="collection" id={item.id} confirmed={item.hero_image_rights_confirmed} evidence={item.hero_image_rights_evidence} />}
              </div>
            </div>
            {mysqlMode && (
              <form action={saveCollectionProducts} className="owner-cms-product-assignments">
                <input type="hidden" name="collection_id" value={item.id} />
                <div>
                  <strong>Products in this collection</strong>
                  <small>{item.productSlugs?.length ?? 0} assigned · choose up to 200 active catalogue products</small>
                </div>
                {productOptionsError ? (
                  <p className="owner-inline-warning">The product catalogue could not be loaded. Refresh after checking the existing Supabase product service.</p>
                ) : productOptions.length ? (
                  <label>
                    Active catalogue products
                    <select name="product_slugs" multiple size={Math.min(Math.max(productOptions.length, 4), 10)} defaultValue={item.productSlugs ?? []}>
                      {productOptions.map((product) => <option key={product.slug} value={product.slug}>{product.title} · {product.slug}</option>)}
                    </select>
                    <small>Use Ctrl (Windows) or Command (Mac) to select multiple products.</small>
                  </label>
                ) : (
                  <p className="owner-cms-no-products">No active catalogue products were found.</p>
                )}
                <button className="owner-secondary-action" type="submit" disabled={productOptionsError}>Save product assignments</button>
              </form>
            )}
          </details>
        ))}
      </section>

      <section className="owner-panel owner-cms-section" id="makers-content">
        <div className="owner-panel-heading"><div><span className="owner-eyebrow">03 / PEOPLE & PROCESS</span><h2>Maker profiles</h2></div><span>{artisans.length} records</span></div>
        <p className="owner-cms-help">Publish only profiles and portraits that the people featured have reviewed and approved. Do not infer names, histories or experience.</p>
        <details className="owner-cms-record owner-cms-new">
          <summary>Add a maker profile</summary>
          <form action={saveArtisanProfile} className="admin-form">
            <div className="admin-form-grid">
              <label>Name approved for publication<input name="full_name" required minLength={2} maxLength={160} /></label>
              <label>Role / craft title<input name="role_title" maxLength={120} /></label>
              <label className="admin-form-wide">Short biography<textarea name="short_bio" rows={3} maxLength={360} /></label>
              <label className="admin-form-wide">Biography<textarea name="biography" rows={5} maxLength={10000} /></label>
              <label>Craft specialties (comma separated)<input name="craft_specialties" maxLength={1200} /></label>
              <label>Years of experience<input name="years_experience" type="number" min="0" max="100" /></label>
              <label>Display order<input name="sort_order" type="number" min="0" max="9999" defaultValue="0" /></label>
            </div>
            <div className="admin-form-actions"><span className="owner-status owner-status-draft">New profiles start as drafts</span><button className="owner-primary-action" type="submit">Save maker profile</button></div>
          </form>
        </details>
        {artisanCards.map((item) => (
          <details className="owner-cms-record" key={item.id}>
            <summary><span>{item.full_name}</span><span className={item.is_published ? "owner-status owner-status-active" : "owner-status owner-status-draft"}>{item.is_published ? "Published" : "Draft"}</span></summary>
            <form action={saveArtisanProfile} className="admin-form">
              <input type="hidden" name="id" value={item.id} />
              <div className="admin-form-grid">
                <label>Name approved for publication<input name="full_name" required defaultValue={item.full_name} maxLength={160} /></label>
                <label>Role / craft title<input name="role_title" defaultValue={item.role_title} maxLength={120} /></label>
                <label className="admin-form-wide">Short biography<textarea name="short_bio" rows={3} defaultValue={item.short_bio} maxLength={360} /></label>
                <label className="admin-form-wide">Biography<textarea name="biography" rows={5} defaultValue={item.biography} maxLength={10000} /></label>
                <label>Craft specialties<input name="craft_specialties" defaultValue={item.craft_specialties.join(", ")} maxLength={1200} /></label>
                <label>Years of experience<input name="years_experience" type="number" min="0" max="100" defaultValue={item.years_experience ?? ""} /></label>
                <label>Display order<input name="sort_order" type="number" min="0" max="9999" defaultValue={item.sort_order} /></label>
              </div>
              <div className="admin-form-actions"><label className="owner-cms-publish"><input type="checkbox" name="is_published" value="yes" defaultChecked={item.is_published} /> Publish profile</label><button className="owner-primary-action" type="submit">Save profile</button></div>
            </form>
            <div className="owner-cms-image-tools">
              {item.preview ? <div className="owner-cms-image-preview"><Image src={item.preview} alt={item.portrait_alt_text || "Approved maker portrait"} fill sizes="(max-width:700px) 90vw, 240px" unoptimized /></div> : <div className="owner-cms-image-empty">No approved portrait</div>}
              <div className="owner-cms-image-actions">
                <EditorialUpload target="artisan" id={item.id} label="Maker portrait" altText={item.portrait_alt_text || ("Portrait of " + item.full_name)} />
                {item.portrait_path && <RightsControl target="artisan" id={item.id} confirmed={item.portrait_rights_confirmed} evidence={item.portrait_rights_evidence} />}
              </div>
            </div>
          </details>
        ))}
      </section>

      <section className="owner-panel owner-cms-section" id="journal-content">
        <div className="owner-panel-heading"><div><span className="owner-eyebrow">04 / EDITORIAL</span><h2>Journal & stories</h2></div><span>{journal.length} records</span></div>
        <p className="owner-cms-help">Write and maintain gallery stories. Markdown headings and paragraphs are supported on the public article page.</p>
        <details className="owner-cms-record owner-cms-new">
          <summary>Create a journal story</summary>
          <form action={saveJournalPost} className="admin-form">
            <div className="admin-form-grid">
              <label>Story title<input name="title" required minLength={3} maxLength={180} /></label>
              <label>URL slug<input name="slug" maxLength={120} placeholder="Generated from the title if blank" /></label>
              <label>Category<input name="category" defaultValue="Stories" maxLength={100} /></label>
              <label className="admin-form-wide">Excerpt<textarea name="excerpt" rows={2} required minLength={20} maxLength={500} /></label>
              <label className="admin-form-wide">Story content (Markdown)<textarea name="content_markdown" rows={8} required minLength={40} maxLength={30000} /></label>
            </div>
            <div className="admin-form-actions"><span className="owner-status owner-status-draft">New stories start as drafts</span><button className="owner-primary-action" type="submit">Save story draft</button></div>
          </form>
        </details>
        {journalCards.map((item) => (
          <details className="owner-cms-record" key={item.id}>
            <summary><span>{item.title}</span><span className={"owner-status " + (item.status === "published" ? "owner-status-active" : "owner-status-draft")}>{item.status}</span></summary>
            <form action={saveJournalPost} className="admin-form">
              <input type="hidden" name="id" value={item.id} />
              <div className="admin-form-grid">
                <label>Story title<input name="title" required defaultValue={item.title} maxLength={180} /></label>
                <label>URL slug<input name="slug" required defaultValue={item.slug} maxLength={120} /></label>
                <label>Category<input name="category" defaultValue={item.category} maxLength={100} /></label>
                <label>Publication status<select name="status" defaultValue={item.status}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
                <label className="admin-form-wide">Excerpt<textarea name="excerpt" rows={2} required defaultValue={item.excerpt} maxLength={500} /></label>
                <label className="admin-form-wide">Story content (Markdown)<textarea name="content_markdown" rows={8} required defaultValue={item.content_markdown} maxLength={30000} /></label>
              </div>
              <div className="admin-form-actions"><button className="owner-primary-action" type="submit">Save story</button><Link className="owner-secondary-action" href={"/journal/" + item.slug} target="_blank" rel="noreferrer">Preview published page ↗</Link></div>
            </form>
            <div className="owner-cms-image-tools">
              {item.preview ? <div className="owner-cms-image-preview"><Image src={item.preview} alt={item.cover_image_alt || item.title} fill sizes="(max-width:700px) 90vw, 240px" unoptimized /></div> : <div className="owner-cms-image-empty">No cover image</div>}
              <div className="owner-cms-image-actions">
                <EditorialUpload target="journal" id={item.id} label="Journal cover image" altText={item.cover_image_alt || item.title} />
                {item.cover_image_path && <RightsControl target="journal" id={item.id} confirmed={item.cover_image_rights_confirmed} evidence={item.cover_image_rights_evidence} />}
              </div>
            </div>
          </details>
        ))}
      </section>
    </section>
  );
}
