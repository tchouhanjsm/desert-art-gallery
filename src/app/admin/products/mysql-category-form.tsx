"use client";

import { useActionState } from "react";
import type { CatalogueActionResult } from "./mysql-actions";
import { createMySqlCategoryState } from "./mysql-actions";

const initial: CatalogueActionResult = { ok: false, error: "" };

export function MySqlCategoryForm() {
  const [state, action, pending] = useActionState(createMySqlCategoryState, initial);
  return (
    <section className="owner-panel">
      <div className="owner-panel-heading"><div><span className="owner-eyebrow">MERCHANDISING TAXONOMY</span><h2>Add category</h2></div></div>
      <form action={action} className="admin-form">
        <div className="admin-form-grid">
          <label>Category name<input name="name" required minLength={2} maxLength={160} /></label>
          <label>Category slug<input name="slug" maxLength={180} placeholder="Generated from name when empty" /></label>
          <label className="admin-form-wide">Description<input name="description" maxLength={2000} /></label>
          <label>Display order<input name="sort_order" type="number" min="0" max="999999" step="1" defaultValue="0" /></label>
        </div>
        {state.ok === false && <p className="owner-inline-warning" role="alert">{state.error}</p>}
        {state.ok && <p className="catalogue-import-note" role="status">Category created.</p>}
        <div className="admin-form-actions">
          <button className="button-outline" type="submit" disabled={pending}>{pending ? "SAVING…" : "CREATE CATEGORY"}</button>
        </div>
      </form>
    </section>
  );
}
