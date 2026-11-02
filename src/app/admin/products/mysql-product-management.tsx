"use client";

import Image from "next/image";
import { useActionState } from "react";
import type { CatalogueActionResult } from "./mysql-actions";
import {
  adjustMySqlVariantInventoryState,
  archiveMySqlProductState,
  confirmMySqlProductImageRightsState,
  createMySqlProductVariantState,
  publishMySqlProductState,
  revokeMySqlProductImageRightsState,
  updateMySqlProductVariantState,
  uploadMySqlProductImageState,
} from "./mysql-actions";

const initialState: CatalogueActionResult = { ok: false, error: "" };

type Variant = {
  id: string;
  sku: string | null;
  label: string;
  attributes: Record<string, string>;
  stockQuantity: number;
  isActive: boolean;
  sortOrder: number;
};

type Media = {
  id: string;
  url: string;
  altText: string;
  rightsConfirmed: boolean;
  rightsEvidence: string;
  position: number;
  isPrimary: boolean;
};

type SourceImage = { url: string; position: number };

type Movement = {
  id: string;
  quantityDelta: number;
  reason: string;
  referenceKey: string;
  createdAt: string;
  variantLabel: string;
};

function EtsySourceImageReview({ images }: { images: SourceImage[] }) {
  if (!images.length) return null;
  return (
    <section className="admin-media-section etsy-source-review">
      <div className="section-kicker">ETSY LISTING SOURCE</div>
      <h2>Imported listing photographs</h2>
      <p>These are external image references retained from the Etsy export. They have not been copied into gallery storage and are not rights-approved. Download only images you are authorized to reuse, then upload the original file in the private media section below and record usage-rights evidence before publishing.</p>
      <div className="etsy-source-image-grid">
        {images.map((image) => (
          <article className="etsy-source-image-card" key={image.url + image.position}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={"Etsy source photograph " + (image.position + 1)} loading="lazy" referrerPolicy="no-referrer" />
            <strong>Source image {image.position + 1}</strong>
            <a href={image.url} target="_blank" rel="noreferrer noopener">Open original image ↗</a>
          </article>
        ))}
      </div>
    </section>
  );
}

function ResultMessage({ state }: { state: CatalogueActionResult }) {
  if (state.ok === false) {
    return <p className="owner-inline-warning" role="alert">{state.error}</p>;
  }
  if (state.ok === true) {
    return <p className="catalogue-import-note" role="status">Saved successfully.</p>;
  }
  return null;
}

function UploadMediaForm({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState(uploadMySqlProductImageState, initialState);
  return (
    <form action={action} className="admin-upload-form">
      <input type="hidden" name="product_id" value={productId} />
      <label>Original product photograph<input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/avif" required /></label>
      <label>Descriptive alt text<input name="alt_text" maxLength={300} required placeholder="Describe the visible object and view" /></label>
      <button className="button-outline" type="submit" disabled={pending}>{pending ? "UPLOADING…" : "UPLOAD PRIVATE IMAGE"}</button>
      <ResultMessage state={state} />
    </form>
  );
}

function MediaRightsForm({ productId, media }: { productId: string; media: Media }) {
  const [state, action, pending] = useActionState(
    media.rightsConfirmed ? revokeMySqlProductImageRightsState : confirmMySqlProductImageRightsState,
    initialState,
  );
  return (
    <form action={action} className="rights-form">
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="image_id" value={media.id} />
      {media.rightsConfirmed ? (
        <>
          <small>{media.rightsEvidence}</small>
          <button className="button-outline" type="submit" disabled={pending}>
            {pending ? "SAVING…" : "REVOKE PUBLIC USE"}
          </button>
        </>
      ) : (
        <>
          <label>Rights evidence reference<input name="rights_evidence" required minLength={12} maxLength={1000} placeholder="Owner confirmation or licence reference" /></label>
          <label className="rights-confirm"><input type="checkbox" name="confirm_rights" value="yes" required /> I confirm the gallery owns or is authorized to use this exact photograph.</label>
          <button className="button-outline" type="submit" disabled={pending}>{pending ? "SAVING…" : "CONFIRM IMAGE RIGHTS"}</button>
        </>
      )}
      <ResultMessage state={state} />
    </form>
  );
}

function VariantEditor({ productId, variant }: { productId: string; variant: Variant }) {
  const [state, action, pending] = useActionState(updateMySqlProductVariantState, initialState);
  const [stockState, stockAction, stockPending] = useActionState(adjustMySqlVariantInventoryState, initialState);
  return (
    <article className="admin-variant-card">
      <form action={action} className="admin-form">
        <input type="hidden" name="product_id" value={productId} />
        <input type="hidden" name="variant_id" value={variant.id} />
        <div className="admin-form-grid">
          <label>Option label<input name="label" defaultValue={variant.label} maxLength={180} required /></label>
          <label>SKU (optional)<input name="sku" defaultValue={variant.sku ?? ""} maxLength={100} /></label>
          <label className="admin-form-wide">Merchant-supplied attributes (JSON)<textarea name="attributes" rows={2} defaultValue={JSON.stringify(variant.attributes, null, 2)} /></label>
          <label className="owner-confirm-check"><input type="checkbox" name="is_active" value="yes" defaultChecked={variant.isActive} /> Active and available for sale</label>
        </div>
        <div className="admin-form-actions">
          <button className="button-outline" type="submit" disabled={pending}>{pending ? "SAVING…" : "SAVE VARIANT"}</button>
          <span className={variant.isActive ? "owner-status owner-status-active" : "owner-status owner-status-draft"}>{variant.isActive ? "Active" : "Draft"}</span>
        </div>
        <ResultMessage state={state} />
      </form>
      <p>Current stock on hand: <strong>{variant.stockQuantity}</strong></p>
      <form action={stockAction} className="shipment-form">
        <input type="hidden" name="product_id" value={productId} />
        <input type="hidden" name="variant_id" value={variant.id} />
        <label>Quantity change<input name="quantity_delta" type="number" step="1" required placeholder="Positive to add; negative to remove" /></label>
        <label>Reason<select name="reason" defaultValue="stocktake" required><option value="restock">Restock</option><option value="stocktake">Stocktake / correction</option><option value="damage">Damage / write-off</option><option value="return">Customer return</option><option value="other">Other</option></select></label>
        <label>Reference (optional)<input name="reference_key" maxLength={180} /></label>
        <button className="button-outline" type="submit" disabled={stockPending}>{stockPending ? "RECORDING…" : "RECORD STOCK MOVEMENT"}</button>
        <ResultMessage state={stockState} />
      </form>
    </article>
  );
}

function NewVariantForm({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState(createMySqlProductVariantState, initialState);
  return (
    <form action={action} className="admin-form">
      <input type="hidden" name="product_id" value={productId} />
      <div className="admin-form-grid">
        <label>Option label<input name="label" maxLength={180} required placeholder="Merchant-confirmed size, style or option" /></label>
        <label>SKU (optional)<input name="sku" maxLength={100} /></label>
        <label className="admin-form-wide">Attributes (JSON object)<textarea name="attributes" rows={2} placeholder='{"size":"M","colour":"..."}' /></label>
      </div>
      <div className="admin-form-actions"><button className="button-outline" type="submit" disabled={pending}>{pending ? "CREATING…" : "CREATE DRAFT VARIANT"}</button></div>
      <ResultMessage state={state} />
    </form>
  );
}

function PublicationControls({ productId, status }: { productId: string; status: string }) {
  const [publishState, publishAction, publishPending] = useActionState(publishMySqlProductState, initialState);
  const [archiveState, archiveAction, archivePending] = useActionState(archiveMySqlProductState, initialState);
  return (
    <section className="admin-publish-section">
      <div><div className="section-kicker">PUBLICATION</div><h2>Catalogue status</h2><p>Publication requires a verified non-zero price, at least one active option and an image with confirmed rights evidence and alt text.</p></div>
      {status === "published" ? (
        <form action={archiveAction}><input type="hidden" name="id" value={productId} /><button className="button-outline" type="submit" disabled={archivePending}>{archivePending ? "ARCHIVING…" : "ARCHIVE PRODUCT"}</button><ResultMessage state={archiveState} /></form>
      ) : status === "archived" ? (
        <span className="owner-status owner-status-archived">Archived products cannot be published from this screen.</span>
      ) : (
        <form action={publishAction}><input type="hidden" name="id" value={productId} /><button className="button-primary dark-button" type="submit" disabled={publishPending}>{publishPending ? "PUBLISHING…" : "PUBLISH PRODUCT"}</button><ResultMessage state={publishState} /></form>
      )}
    </section>
  );
}

export function MySqlProductManagement({
  productId,
  productStatus,
  media,
  sourceImages = [],
  variants,
  movements,
}: {
  productId: string;
  productStatus: string;
  media: Media[];
  sourceImages?: SourceImage[];
  variants: Variant[];
  movements: Movement[];
}) {
  return (
    <>
      <section className="admin-media-section">
        <div className="section-kicker">PURCHASABLE OPTIONS</div>
        <h2>Variants and stock</h2>
        <p>Each active variant owns its stock balance. Reservations and owner adjustments are serialized against variant rows and written to the inventory ledger.</p>
        {variants.length ? <div className="admin-variant-list">{variants.map((variant) =>
          <VariantEditor key={variant.id} productId={productId} variant={variant} />
        )}</div> : <p className="empty-note">No variant records are available. Create the first option below.</p>}
        <h3>Add an option</h3>
        <NewVariantForm productId={productId} />
      </section>

      <EtsySourceImageReview images={sourceImages} />

      <section className="admin-media-section">
        <div className="section-kicker">PRODUCT PHOTOGRAPHY</div>
        <h2>Images and usage rights</h2>
        <p>Uploaded bytes are stored under the separate product-media namespace. Public delivery requires this exact image record to remain rights-approved while its product is published.</p>
        <UploadMediaForm productId={productId} />
        {media.length ? <div className="admin-image-grid">
          {media.map((image) => (
            <article className="admin-image-card" key={image.id}>
              <Image src={image.url} alt={image.altText} width={500} height={620} unoptimized />
              <strong>{image.altText}</strong>
              {image.isPrimary && <span className="admin-status status-active">Primary image</span>}
              <span className={image.rightsConfirmed ? "admin-status status-active" : "admin-status status-draft"}>
                {image.rightsConfirmed ? "Rights confirmed" : "Private · rights pending"}
              </span>
              <MediaRightsForm productId={productId} media={image} />
            </article>
          ))}
        </div> : <p className="empty-note">No product photographs uploaded yet.</p>}
      </section>

      <section className="admin-media-section">
        <div className="section-kicker">INVENTORY AUDIT</div>
        <h2>Recent stock movements</h2>
        {movements.length ? <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>DATE</th><th>VARIANT</th><th>REASON</th><th>CHANGE</th><th>REFERENCE</th></tr></thead>
            <tbody>{movements.map((movement) => (
              <tr key={movement.id}>
                <td>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(movement.createdAt))}</td>
                <td>{movement.variantLabel}</td>
                <td>{movement.reason}</td>
                <td>{movement.quantityDelta > 0 ? "+" : ""}{movement.quantityDelta}</td>
                <td>{movement.referenceKey}</td>
              </tr>
            ))}</tbody>
          </table>
        </div> : <p className="empty-note">No inventory movements have been recorded.</p>}
      </section>

      <PublicationControls productId={productId} status={productStatus} />
    </>
  );
}
