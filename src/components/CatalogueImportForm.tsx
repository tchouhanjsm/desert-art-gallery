"use client";

import { useRef, useState } from "react";
import { formatMoneyFromMinor } from "@/lib/money";
import {
  importCatalogueProducts,
  previewCatalogueImport,
  type CatalogueImportCommitResult,
  type CatalogueImportPreview,
} from "@/app/admin/products/actions";

export function CatalogueImportForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<CatalogueImportPreview | null>(null);
  const [result, setResult] = useState<CatalogueImportCommitResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function resetPreview() {
    setPreview(null);
    setResult(null);
    setConfirmed(false);
    setError("");
  }

  async function handlePreview() {
    const form = formRef.current;
    if (!form || !form.reportValidity()) return;
    const formData = new FormData(form);
    setError("");
    setResult(null);
    setConfirmed(false);
    setPending(true);
    try {
      const response = await previewCatalogueImport(formData);
      setPreview(response);
      if (response.error) setError(response.error);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Preview failed.");
    } finally {
      setPending(false);
    }
  }

  async function handleImport() {
    const form = formRef.current;
    if (!form || !preview?.ok || !preview.sha256 || !confirmed || !form.reportValidity()) return;
    const formData = new FormData(form);
    formData.set("expected_sha256", preview.sha256);
    formData.set("confirm_import", "yes");
    setError("");
    setPending(true);
    try {
      const response = await importCatalogueProducts(formData);
      setResult(response);
      if (response.ok) {
        setPreview(null);
        setConfirmed(false);
        form.reset();
      } else {
        setError(response.error);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Import failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="catalogue-import">
      <form ref={formRef} className="admin-form" onSubmit={(event) => event.preventDefault()}>
        <label className="catalogue-import-file">
          CSV file
          <input type="file" name="file" accept=".csv,text/csv" required onChange={resetPreview} />
        </label>
        <div className="catalogue-import-actions">
          <button className="button-outline" type="button" disabled={pending} onClick={handlePreview}>
            {pending ? "VALIDATING…" : "VALIDATE & PREVIEW"}
          </button>
          <a className="text-link" href="/product-import-template.csv" download>
            DOWNLOAD CSV TEMPLATE
          </a>
        </div>
      </form>

      <p className="catalogue-import-note">
        Imports create draft products only. Every product starts unpublished, and images must be uploaded from merchant-authorized originals with separate rights evidence. CSV image URLs are not accepted.
      </p>

      {error ? <p className="catalogue-import-error" role="alert">{error}</p> : null}

      {preview ? (
        <section className="catalogue-import-preview" aria-live="polite">
          <div className="catalogue-import-summary">
            <strong>{preview.validRows} of {preview.totalRows} rows valid</strong>
            <span>{preview.ok ? "Ready for draft import" : "Correct the issues before importing"}</span>
          </div>
          {preview.errors.length ? (
            <ul className="catalogue-import-errors">
              {preview.errors.map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          ) : null}
          {preview.rows.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>LINE / PRODUCT</th><th>SKU</th><th>PRICE</th><th>INITIAL STOCK</th><th>VALIDATION</th></tr></thead>
                <tbody>
                  {preview.rows.slice(0, 12).map((row) => (
                    <tr key={row.line}>
                      <td><strong>{row.title || "Untitled row"}</strong><small>Line {row.line} · {row.slug}</small></td>
                      <td>{row.sku || "—"}</td>
                      <td>{row.price_minor === null ? "Inquiry only" : formatMoneyFromMinor(row.price_minor, row.currency)}</td>
                      <td>{row.quantity_on_hand}</td>
                      <td>
                        {row.errors.length
                          ? <span className="admin-status status-draft">{row.errors.length} issue(s)</span>
                          : <span className="admin-status status-active">Valid</span>}
                        {row.errors.length ? <small>{row.errors.join(" ")}</small> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length > 12 ? <p className="catalogue-import-note">Showing the first 12 rows. All {preview.totalRows} rows were validated.</p> : null}
            </div>
          ) : null}

          {preview.ok ? (
            <div className="catalogue-import-confirm">
              <label>
                <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                I have verified the source catalogue data and confirm these records should be imported as unpublished drafts. Initial stock counts are factual opening balances.
              </label>
              <button className="button-primary dark-button" type="button" disabled={!confirmed || pending} onClick={handleImport}>
                {pending ? "IMPORTING…" : "IMPORT VERIFIED DRAFTS"}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {result?.ok ? (
        <div className="catalogue-import-success" role="status">
          <strong>Catalogue import completed.</strong>
          <p>{result.productsCreated} draft products created; {result.stockUnitsAdded} opening stock units recorded.</p>
          <small>Import batch: {result.batchId}</small>
          <a href="/admin/products">VIEW PRODUCT CATALOGUE</a>
        </div>
      ) : null}
    </div>
  );
}
