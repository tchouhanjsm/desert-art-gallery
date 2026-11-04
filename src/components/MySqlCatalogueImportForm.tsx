"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoneyFromMinor } from "@/lib/money";
import {
  commitMySqlCatalogueImport,
  previewMySqlCatalogueImport,
} from "@/app/admin/products/mysql-import-actions";
import type {
  LocalCatalogueImportPreview,
  LocalCatalogueImportResult,
} from "@/server/catalogue/import-csv";

const MAX_CSV_BYTES = 2 * 1024 * 1024;

export function MySqlCatalogueImportForm({ allowCommit }: { allowCommit: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [preview, setPreview] = useState<LocalCatalogueImportPreview | null>(null);
  const [result, setResult] = useState<LocalCatalogueImportResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function resetPreview() {
    setPreview(null);
    setResult(null);
    setConfirmed(false);
    setError("");
  }

  async function handlePreview() {
    const form = formRef.current;
    if (!form || !form.reportValidity()) return;
    const file = (new FormData(form)).get("file");
    if (!(file instanceof File)) {
      setError("Choose an Etsy Listings Download CSV or the standard product template.");
      return;
    }
    if (file.size < 1 || file.size > MAX_CSV_BYTES) {
      setError("Choose a CSV between 1 byte and 2 MB.");
      return;
    }

    setError("");
    setResult(null);
    setPreview(null);
    setConfirmed(false);
    setPending(true);
    try {
      const response = await previewMySqlCatalogueImport(new FormData(form));
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setPreview(response.preview);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Catalogue preview failed.");
    } finally {
      setPending(false);
    }
  }

  async function handleCommit() {
    const form = formRef.current;
    if (!form || !preview?.canCommit || !confirmed || !allowCommit || !form.reportValidity()) return;

    const formData = new FormData(form);
    formData.set("expected_sha256", preview.sourceSha256);
    formData.set("confirm_import", "yes");
    setError("");
    setPending(true);
    try {
      const response = await commitMySqlCatalogueImport(formData);
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setResult(response.result);
      setPreview(null);
      setConfirmed(false);
      form.reset();
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Catalogue import failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="catalogue-import">
      <form ref={formRef} className="admin-form" onSubmit={(event) => event.preventDefault()}>
        <label className="catalogue-import-file">
          Etsy Listings Download or product-template CSV
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            onChange={resetPreview}
          />
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
        Preview is read-only. A confirmed import creates draft products and Standard variants with opening inventory movements. Etsy image links remain source references; image files are not downloaded and image rights are not approved.
      </p>

      {error ? <p className="catalogue-import-error" role="alert">{error}</p> : null}

      {preview ? (
        <section className="catalogue-import-preview" aria-live="polite">
          <div className="catalogue-import-summary">
            <strong>{preview.validRows} of {preview.totalRows} rows valid</strong>
            <span>{preview.sourceType === "etsy" ? "Etsy Listings Download detected" : "Product template detected"}</span>
            <small>{preview.sourceName} · SHA-256 {preview.sourceSha256.slice(0, 16)}…</small>
          </div>

          {preview.productsInTarget > 0 ? (
            <p className="catalogue-import-error" role="status">
              The target already contains {preview.productsInTarget} products. This importer is deliberately limited to a one-time empty-catalogue seed; it will not merge or overwrite products.
            </p>
          ) : null}
          {preview.alreadyImported ? (
            <p className="catalogue-import-error" role="alert">
              This exact file has already been imported. Re-import is blocked by its source hash.
            </p>
          ) : null}
          {preview.errors.length ? (
            <ul className="catalogue-import-errors">
              {preview.errors.map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          ) : null}
          {preview.warnings.length ? (
            <ul className="catalogue-import-errors">
              {preview.warnings.map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          ) : null}

          {preview.rows.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>LINE / PRODUCT</th><th>SKU</th><th>PRICE</th><th>STOCK</th><th>SOURCE MEDIA</th><th>VALIDATION</th></tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 16).map((row) => (
                    <tr key={row.line}>
                      <td><strong>{row.title || "Untitled row"}</strong><small>Line {row.line} · {row.slug}</small></td>
                      <td>{row.sku || "—"}{row.sourceSkuDuplicated ? <small>Duplicate source SKU retained for review</small> : null}</td>
                      <td>{row.priceMinor === null ? "Missing price" : formatMoneyFromMinor(row.priceMinor, row.currency)}</td>
                      <td>{row.quantityOnHand}</td>
                      <td>{row.imageCount} URLs · {row.tagCount} tags</td>
                      <td>
                        {row.errors.length
                          ? <span className="admin-status status-draft">{row.errors.length} issue(s)</span>
                          : <span className="admin-status status-active">Valid</span>}
                        {row.errors.length ? <small>{row.errors.join(" ")}</small> : null}
                        {row.warnings.length ? <small>{row.warnings.join(" ")}</small> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length > 16 ? (
                <p className="catalogue-import-note">Showing 16 rows. All {preview.totalRows} records were validated.</p>
              ) : null}
            </div>
          ) : null}

          {preview.canCommit && allowCommit ? (
            <div className="catalogue-import-confirm">
              <label>
                <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                I verified the listing data, currency and opening stock. I confirm that every accepted listing should be created as an unpublished draft in this empty catalogue.
              </label>
              <button className="button-primary dark-button" type="button" disabled={!confirmed || pending} onClick={handleCommit}>
                {pending ? "IMPORTING…" : "IMPORT VERIFIED DRAFTS"}
              </button>
            </div>
          ) : null}

          {preview.canCommit && !allowCommit ? (
            <p className="catalogue-import-note">
              This deployment is preview-only. Catalogue writes are disabled in production unless the staging import gate is explicitly enabled.
            </p>
          ) : null}
        </section>
      ) : null}

      {result ? (
        <div className="catalogue-import-success" role="status">
          <strong>Catalogue import completed.</strong>
          <p>{result.productsCreated} draft products created; {result.stockUnitsAdded} opening stock units recorded.</p>
          <small>Import batch: {result.batchId}</small>
        </div>
      ) : null}
    </div>
  );
}
