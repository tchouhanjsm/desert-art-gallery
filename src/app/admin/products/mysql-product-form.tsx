"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { CatalogueActionResult } from "./mysql-actions";
import {
  createMySqlDraftProductState,
  updateMySqlDraftProductState,
} from "./mysql-actions";

export type MySqlProductFormValues = {
  id?: string;
  title?: string;
  slug?: string;
  currency?: string;
  price?: string;
  compareAtPrice?: string;
  shortDescription?: string;
  description?: string;
  productType?: string;
  categorySlugs?: string[];
  materials?: string[];
  sizes?: string[];
  measurements?: Record<string, unknown> | null;
  conditionNotes?: string | null;
  provenance?: string | null;
  craftStory?: string | null;
  isOneOfAKind?: boolean;
  featured?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

const initialState: CatalogueActionResult = { ok: false, error: "" };

export function MySqlProductForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: MySqlProductFormValues;
}) {
  const [createState, createFormAction, createPending] = useActionState(createMySqlDraftProductState, initialState);
  const [updateState, updateFormAction, updatePending] = useActionState(updateMySqlDraftProductState, initialState);
  const state = mode === "create" ? createState : updateState;
  const formAction = mode === "create" ? createFormAction : updateFormAction;
  const pending = mode === "create" ? createPending : updatePending;

  return (
    <form action={formAction} className="admin-form">
      {mode === "edit" && <input type="hidden" name="id" value={initial?.id ?? ""} />}
      <div className="admin-form-grid">
        <label>Product title<input name="title" required minLength={3} maxLength={240} defaultValue={initial?.title ?? ""} /></label>
        <label>URL slug<input name="slug" maxLength={180} defaultValue={initial?.slug ?? ""} placeholder="Generated from title when empty" /></label>
        <label>Currency<input name="currency" required pattern="[A-Za-z]{3}" maxLength={3} defaultValue={initial?.currency ?? "USD"} /></label>
        <label>Price<input name="price" required inputMode="decimal" defaultValue={initial?.price ?? ""} placeholder="Enter verified price" /></label>
        <label>Compare-at price<input name="compare_at_price" inputMode="decimal" defaultValue={initial?.compareAtPrice ?? ""} /></label>
        <label>Product type<input name="product_type" maxLength={100} defaultValue={initial?.productType ?? ""} /></label>
        <label>Category slugs (comma separated)<input name="category_slugs" maxLength={2000} defaultValue={(initial?.categorySlugs ?? []).join(", ")} placeholder="Use existing active MySQL category slugs" /></label>
        <label className="admin-form-wide">Short description<input name="short_description" maxLength={240} defaultValue={initial?.shortDescription ?? ""} /></label>
        <label className="admin-form-wide">Full description<textarea name="description" rows={5} maxLength={12000} defaultValue={initial?.description ?? ""} /></label>
        <label>Materials (comma separated)<input name="materials" defaultValue={(initial?.materials ?? []).join(", ")} /></label>
        <label>Sizes (comma separated)<input name="sizes" defaultValue={(initial?.sizes ?? []).join(", ")} /></label>
        <label className="admin-form-wide">Measurements (JSON object)<textarea name="measurements" rows={3} defaultValue={initial?.measurements ? JSON.stringify(initial.measurements, null, 2) : ""} placeholder='{"chest":"...","length":"..."}' /></label>
        <label className="admin-form-wide">Condition notes<textarea name="condition_notes" rows={3} maxLength={4000} defaultValue={initial?.conditionNotes ?? ""} /></label>
        <label className="admin-form-wide">Provenance<textarea name="provenance" rows={3} maxLength={4000} defaultValue={initial?.provenance ?? ""} /></label>
        <label className="admin-form-wide">Craft story<textarea name="craft_story" rows={3} maxLength={5000} defaultValue={initial?.craftStory ?? ""} /></label>
        <label>SEO title<input name="seo_title" maxLength={255} defaultValue={initial?.seoTitle ?? ""} /></label>
        <label>SEO description<input name="seo_description" maxLength={500} defaultValue={initial?.seoDescription ?? ""} /></label>
        <label className="owner-confirm-check"><input name="one_of_a_kind" type="checkbox" value="yes" defaultChecked={initial?.isOneOfAKind ?? false} /> One-of-a-kind piece (maximum one unit in stock)</label>
        <label className="owner-confirm-check"><input name="featured" type="checkbox" value="yes" defaultChecked={initial?.featured ?? false} /> Feature in curated highlights</label>
      </div>

      {state.ok === false && <p className="owner-inline-warning" role="alert">{state.error}</p>}
      {state.ok && <p className="catalogue-import-note" role="status">Product details saved successfully.</p>}
      <div className="admin-form-actions">
        <button className="button-primary dark-button" type="submit" disabled={pending}>
          {pending ? "SAVING…" : mode === "create" ? "SAVE DRAFT PRODUCT" : "SAVE PRODUCT DETAILS"}
        </button>
        {state.ok && state.id && <Link className="text-link" href={"/admin/products/" + state.id}>OPEN PRODUCT</Link>}
        <Link className="text-link" href="/admin/products">CANCEL</Link>
      </div>
    </form>
  );
}
