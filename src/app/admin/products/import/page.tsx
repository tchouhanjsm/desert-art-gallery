import { redirect } from "next/navigation";
import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { CatalogueImportForm } from "@/components/CatalogueImportForm";
import { MySqlCatalogueImportForm } from "@/components/MySqlCatalogueImportForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMySqlDb, isMySqlCatalogueEnabled } from "@/server/db";
import { catalogueImportBatches, products } from "@/server/db/schema";

export const metadata = { title: "Import product catalogue" };

type ImportBatch = {
  id: string;
  row_count: number;
  products_created: number;
  stock_units_added: number;
  created_at: string;
};

async function MySqlCatalogueImportPage() {
  const db = getMySqlDb();
  const [countRows, batches] = await Promise.all([
    db.select({ count: sql<number>`COUNT(*)` }).from(products),
    db.select({
      id: catalogueImportBatches.id,
      rowCount: catalogueImportBatches.rowCount,
      productsCreated: catalogueImportBatches.productsCreated,
      stockUnitsAdded: catalogueImportBatches.stockUnitsAdded,
      createdAt: catalogueImportBatches.createdAt,
    }).from(catalogueImportBatches).orderBy(desc(catalogueImportBatches.createdAt)).limit(10),
  ]);
  const productCount = Number(countRows[0]?.count ?? 0);
  const allowCommit = process.env.NODE_ENV !== "production" ||
    (process.env.APP_ENV === "staging" && process.env.STAGING_CATALOGUE_IMPORT_ENABLED === "true");

  return (
    <section className="owner-page">
      <div className="owner-page-heading">
        <div>
          <span className="owner-eyebrow">MERCHANDISING · MYSQL CATALOGUE</span>
          <h1>Import catalogue</h1>
          <p>Review a merchant export and create draft products with opening stock in one atomic MySQL transaction.</p>
        </div>
        <div className="owner-page-actions">
          <Link className="owner-secondary-action" href="/admin/products">Back to products</Link>
        </div>
      </div>

      <div className="owner-inline-stats">
        <span><strong>{productCount}</strong> existing products</span>
        <span><strong>{batches.length}</strong> recent import batches shown</span>
        <span><strong>1,000</strong> maximum Etsy rows per file</span>
      </div>

      <section className="owner-panel">
        <div className="owner-panel-heading">
          <div><span className="owner-eyebrow">SAFE INGESTION</span><h2>Validate & preview</h2></div>
          <span>Read-only until confirmed</span>
        </div>
        {productCount > 0 ? (
          <p className="catalogue-import-note">
            This protected seed importer only accepts an empty product catalogue. {productCount} products already exist, so it will not overwrite, merge or duplicate the current catalogue.
          </p>
        ) : (
          <p className="catalogue-import-note">
            The catalogue is empty and ready for its first verified seed. The parser accepts Etsy Listings Download and the standard product template; exact file hash, currency, prices, slugs, SKU collisions and stock quantities are validated before a write.
          </p>
        )}
        <MySqlCatalogueImportForm allowCommit={allowCommit} />
      </section>

      <section className="owner-panel">
        <div className="owner-panel-heading">
          <div><span className="owner-eyebrow">AUDITABLE OPERATIONS</span><h2>Recent import batches</h2></div>
          <span>{batches.length} shown · newest first</span>
        </div>
        {batches.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>IMPORTED</th><th>ROWS</th><th>DRAFTS CREATED</th><th>OPENING STOCK</th><th>BATCH</th></tr></thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id}>
                    <td>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(batch.createdAt)}</td>
                    <td>{batch.rowCount}</td>
                    <td>{batch.productsCreated}</td>
                    <td>{batch.stockUnitsAdded}</td>
                    <td><small>{batch.id}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="empty-note">No catalogue import batches have been recorded.</p>}
      </section>
    </section>
  );
}

export default async function AdminCatalogueImportPage() {
  if (isMySqlCatalogueEnabled()) return <MySqlCatalogueImportPage />;

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
