import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAllowedEtsyImageUrl } from "@/lib/etsy-listings-import";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { getMySqlDb, isMySqlCatalogueEnabled } from "@/server/db";
import { inventoryMovements, productCategories, productCategoryLinks, productMedia, products, productVariants } from "@/server/db/schema";
import { getProductMediaUrl } from "@/server/media/product-storage";
import { MySqlProductForm } from "../mysql-product-form";
import { MySqlProductManagement } from "../mysql-product-management";
import { updateProduct, archiveProduct, publishProduct, uploadProductImage, confirmProductImageRights, adjustProductInventory, updateProductImageOrder, setProductImagePrimary, createProductVariant, updateProductVariant, adjustProductVariantInventory } from "../actions";

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
type VariantRow = {
  id: string; sku: string | null; label: string; attributes: Record<string, unknown>;
  price_override_minor: number | null; quantity_on_hand: number; status: "draft" | "active" | "archived";
};

function displayMoneyInput(value: number | null, currency: string) {
  if (value === null) return "";
  try {
    const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
    return (value / (10 ** digits)).toFixed(digits);
  } catch { return ""; }
}

export default async function EditAdminProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isMySqlCatalogueEnabled()) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
    const db = getMySqlDb();
    const [mysqlProduct] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!mysqlProduct) notFound();
    const [variantRows, mediaRows, categoryRows] = await Promise.all([
      db.select().from(productVariants).where(eq(productVariants.productId, id))
        .orderBy(asc(productVariants.sortOrder), asc(productVariants.createdAt)),
      db.select().from(productMedia).where(eq(productMedia.productId, id))
        .orderBy(asc(productMedia.position), asc(productMedia.createdAt)),
      db.select({ slug: productCategories.slug }).from(productCategoryLinks)
        .innerJoin(productCategories, eq(productCategories.id, productCategoryLinks.categoryId))
        .where(eq(productCategoryLinks.productId, id))
        .orderBy(asc(productCategories.sortOrder), asc(productCategories.name)),
    ]);
    const variantIds = variantRows.map((variant) => variant.id);
    const movementRows = variantIds.length
      ? await db.select().from(inventoryMovements).where(inArray(inventoryMovements.variantId, variantIds))
        .orderBy(desc(inventoryMovements.createdAt)).limit(60)
      : [];
    const variantById = new Map(variantRows.map((variant) => [variant.id, variant.label]));
    const movements = movementRows.map((movement) => ({
      id: movement.id,
      quantityDelta: movement.quantityDelta,
      reason: movement.reason,
      referenceKey: movement.referenceKey,
      createdAt: movement.createdAt.toISOString(),
      variantLabel: variantById.get(movement.variantId) ?? "Unknown variant",
    }));
    const media = mediaRows.map((item) => ({
      id: item.id,
      url: getProductMediaUrl(item.storageKey),
      altText: item.altText,
      rightsConfirmed: item.rightsConfirmed,
      rightsEvidence: item.rightsEvidence,
      position: item.position,
      isPrimary: item.isPrimary,
    }));
    const rawSourceImageUrls = mysqlProduct.sourceMetadata?.imageUrls;
    const sourceImages = Array.isArray(rawSourceImageUrls)
      ? rawSourceImageUrls
        .filter((url): url is string => typeof url === "string" && isAllowedEtsyImageUrl(url))
        .map((url, position) => ({ url, position }))
      : [];
    const initial = {
      id: mysqlProduct.id,
      title: mysqlProduct.title,
      slug: mysqlProduct.slug,
      currency: mysqlProduct.currency,
      price: displayMoneyInput(mysqlProduct.priceMinor, mysqlProduct.currency),
      compareAtPrice: displayMoneyInput(mysqlProduct.compareAtPriceMinor, mysqlProduct.currency),
      shortDescription: mysqlProduct.shortDescription,
      description: mysqlProduct.description ?? "",
      productType: mysqlProduct.productType,
      categorySlugs: categoryRows.map((category) => category.slug),
      materials: mysqlProduct.materials ?? [],
      sizes: mysqlProduct.sizes ?? [],
      measurements: mysqlProduct.measurements,
      conditionNotes: mysqlProduct.conditionNotes,
      provenance: mysqlProduct.provenance,
      craftStory: mysqlProduct.craftStory,
      isOneOfAKind: mysqlProduct.isOneOfAKind,
      featured: mysqlProduct.featured,
      seoTitle: mysqlProduct.seoTitle,
      seoDescription: mysqlProduct.seoDescription,
    };
    return <div className="page-shell admin-editor">
      <div className="breadcrumb"><Link href="/admin/products">PRODUCT CATALOGUE</Link> / MYSQL PRODUCT</div>
      <div className="admin-page-heading">
        <div><div className="section-kicker">SELF-HOSTED CATALOGUE</div><h1>{mysqlProduct.title}</h1>
          <p>Manage verified product facts, options, stock movements and rights-approved photographs.</p></div>
        <span className={"admin-status status-" + mysqlProduct.status}>{mysqlProduct.status}</span>
      </div>
      <MySqlProductForm mode="edit" initial={initial} />
      <MySqlProductManagement
        productId={id}
        productStatus={mysqlProduct.status}
        media={media}
        sourceImages={sourceImages}
        variants={variantRows.map((variant) => ({
          id: variant.id, sku: variant.sku, label: variant.label,
          attributes: variant.attributes, stockQuantity: variant.stockQuantity,
          isActive: variant.isActive, sortOrder: variant.sortOrder,
        }))}
        movements={movements}
      />
    </div>;
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <div className="page-shell"><div className="page-heading"><h1>Edit product</h1><p>Connect Supabase to manage the catalogue.</p></div></div>;

  const [productResult, categoryResult, imageResult, movementResult, variantResult] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("id,name").order("sort_order", { ascending: true }),
    supabase.from("product_images").select("id,storage_path,alt_text,rights_confirmed,rights_evidence,sort_order,is_primary,created_at").eq("product_id", id).order("is_primary", { ascending: false }).order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    supabase.from("inventory_movements").select("id,quantity_delta,reason,reference,created_at").eq("product_id", id).is("variant_id", null).order("created_at", { ascending: false }).limit(25),
    supabase.from("product_variants").select("id,sku,label,attributes,price_override_minor,quantity_on_hand,status").eq("product_id", id).order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
  ]);
  if (productResult.error || !productResult.data) notFound();
  if (categoryResult.error || imageResult.error || variantResult.error) throw new Error("Unable to load product editor data.");
  const product = productResult.data as ProductRow;
  const imageRows = (imageResult.data ?? []) as ImageRow[];
  const movements = (movementResult.data ?? []) as MovementRow[];
  const variants = (variantResult.data ?? []) as VariantRow[];
  const hasActiveVariants = variants.some((variant) => variant.status === "active");
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
      <div className="section-kicker">PURCHASABLE OPTIONS</div>
      <h2>Product variants</h2>
      <p>Enter only options confirmed by the merchant. Each active option has its own SKU, price override and stock ledger. When active variants exist, checkout reservation uses variant stock instead of product-level stock.</p>
      {variants.length ? <div className="admin-variant-list">{variants.map((variant) => (
        <article className="admin-variant-card" key={variant.id}>
          <form action={updateProductVariant} className="admin-form">
            <input type="hidden" name="product_id" value={product.id} />
            <input type="hidden" name="product_slug" value={product.slug} />
            <input type="hidden" name="variant_id" value={variant.id} />
            <div className="admin-form-grid">
              <label>Option label<input name="label" defaultValue={variant.label} required maxLength={120} /></label>
              <label>Variant SKU<input name="sku" defaultValue={variant.sku ?? ""} maxLength={80} /></label>
              <label>Price override (optional)<input name="price_override" inputMode="decimal" defaultValue={displayMoneyInput(variant.price_override_minor, product.currency)} /></label>
              <label>Status<select name="status" defaultValue={variant.status}><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></label>
              <label className="admin-form-wide">Merchant-supplied attributes (JSON object)<textarea name="attributes" rows={2} defaultValue={JSON.stringify(variant.attributes, null, 2)} required /></label>
            </div>
            <div className="admin-form-actions"><button className="button-outline" type="submit">SAVE VARIANT</button><span className={"admin-status status-" + variant.status}>{variant.status}</span></div>
          </form>
          <p>Variant stock on hand: <strong>{variant.quantity_on_hand}</strong></p>
          <form action={adjustProductVariantInventory} className="shipment-form">
            <input type="hidden" name="product_id" value={product.id} />
            <input type="hidden" name="product_slug" value={product.slug} />
            <input type="hidden" name="variant_id" value={variant.id} />
            <label>Quantity change<input name="quantity_delta" type="number" step="1" required placeholder="Positive to add, negative to remove" /></label>
            <label>Reason<select name="reason" required defaultValue="correction"><option value="restock">Restock</option><option value="correction">Stock correction</option><option value="damage">Damage / write-off</option><option value="return">Customer return</option><option value="other">Other</option></select></label>
            <label>Reference (optional)<input name="reference" maxLength={120} /></label>
            <button className="button-outline" type="submit">RECORD VARIANT STOCK MOVEMENT</button>
          </form>
        </article>
      ))}</div> : <p className="empty-note">No variants are configured. This product currently uses its product-level stock record.</p>}
      <h3>Add a verified option</h3>
      <form action={createProductVariant} className="admin-form">
        <input type="hidden" name="product_id" value={product.id} />
        <input type="hidden" name="product_slug" value={product.slug} />
        <div className="admin-form-grid">
          <label>Option label<input name="label" required maxLength={120} placeholder="Merchant-supplied option name" /></label>
          <label>Variant SKU<input name="sku" maxLength={80} /></label>
          <label>Price override (optional)<input name="price_override" inputMode="decimal" /></label>
          <label className="admin-form-wide">Attributes (JSON object)<textarea name="attributes" rows={3} required placeholder='{"attribute": "merchant-supplied value"}' /></label>
        </div>
        <div className="admin-form-actions"><button className="button-primary dark-button" type="submit">CREATE DRAFT VARIANT</button></div>
      </form>
      {hasActiveVariants && <p className="catalogue-import-note">Active variants are selected individually on the product page. Product-level stock is not used for those options.</p>}
    </section>

    <section className="admin-media-section">
      <div className="section-kicker">INVENTORY CONTROL</div>
      <h2>Stock ledger</h2>
      <p>Current on-hand quantity: <strong>{product.quantity_on_hand}</strong>. Every adjustment is written atomically to the inventory movement ledger. Product detail edits cannot silently overwrite stock.</p>
      {!hasActiveVariants && <form action={adjustProductInventory} className="shipment-form">
        <input type="hidden" name="product_id" value={product.id} />
        <label>Quantity change<input name="quantity_delta" type="number" step="1" required placeholder="Positive to add, negative to remove" /></label>
        <label>Reason<select name="reason" required defaultValue="correction"><option value="restock">Restock</option><option value="correction">Stock correction</option><option value="damage">Damage / write-off</option><option value="return">Customer return</option><option value="other">Other</option></select></label>
        <label>Reference (optional)<input name="reference" maxLength={120} placeholder="Supplier or stocktake reference" /></label>
        <button className="button-outline" type="submit">RECORD INVENTORY MOVEMENT</button>
      </form>}
      {hasActiveVariants && <p className="catalogue-import-note">Product-level stock adjustments are disabled while active variants exist. Use each variant&apos;s own ledger above.</p>}
      <h3>Recent product-level stock movements</h3>
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
