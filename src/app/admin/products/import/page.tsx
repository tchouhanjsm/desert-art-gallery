import { redirect } from "next/navigation";
import { isMySqlCatalogueEnabled } from "@/server/db";
import Link from "next/link";
import { CatalogueImportForm } from "@/components/CatalogueImportForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Import product catalogue" };

type ImportBatch = {
  id: string;
  row_count: number;
  products_created: number;
  stock_units_added: number;
  created_at: string;
};

export default async function AdminCatalogueImportPage() {
  if (isMySqlCatalogueEnabled()) redirect("/admin/products");
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return <div className="page-shell"><div className="page-heading"><h1>Import catalogue</h1><p>Connect Supabase to activate secure catalogue imports.</p></div></div>;
  }

  const { data, error } = await supabase.from("catalogue_import_batches")
    .select("id,row_count,products_created,stock_units_added,created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  const batches = (data ?? []) as ImportBatch[];

  return (
    <div className="page-shell admin-editor">
      <div className="breadcrumb"><Link href="/admin/products">PRODUCT CATALOGUE</Link> / CSV IMPORT</div>
      <div className="page-heading">
        <div className="section-kicker">CATALOGUE OPERATIONS</div>
        <h1>Import verified records</h1>
        <p>Validate a merchant-supplied CSV, review row-level issues, then atomically create unpublished product drafts and opening inventory movements.</p>
      </div>

      <section className="admin-media-section">
        <div className="section-kicker">SAFE INGESTION</div>
        <h2>CSV validation & preview</h2>
        <p>Maximum 2 MB and 500 rows per batch. Slugs, SKUs, category references, currency precision, stock quantities and measurements are checked before any database write. A file hash binds the import to the exact previewed file.</p>
        <CatalogueImportForm />
      </section>

      <section className="admin-media-section">
        <div className="section-kicker">AUDITABLE OPERATIONS</div>
        <h2>Recent import batches</h2>
        {error ? <p className="catalogue-import-note">Import history is unavailable. Apply the catalogue import migration before using this register.</p> : batches.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>IMPORTED</th><th>ROWS</th><th>DRAFTS CREATED</th><th>OPENING STOCK UNITS</th><th>BATCH</th></tr></thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id}>
                    <td>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(batch.created_at))}</td>
                    <td>{batch.row_count}</td>
                    <td>{batch.products_created}</td>
                    <td>{batch.stock_units_added}</td>
                    <td><small>{batch.id}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="empty-note">No catalogue import batches have been recorded.</p>}
      </section>
    </div>
  );
}
