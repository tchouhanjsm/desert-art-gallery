import type { RowDataPacket } from "mysql2";
import { closeMySqlPool, getMySqlPool } from "../src/server/db";
import { assertLocalMySqlTarget } from "../src/server/db/safety";

type TableRow = RowDataPacket & { table_name: string; table_type: string; engine: string | null; table_rows: number | string | null };
type ServerRow = RowDataPacket & {
  database_name: string;
  server_version: string;
  server_comment: string;
  server_host: string;
  server_port: number | string;
};
type CountRow = RowDataPacket & { total: number | string };
type StatusRow = RowDataPacket & { status: string; total: number | string };
type ProviderRow = RowDataPacket & { provider: string; total: number | string };
type MediaCountRow = RowDataPacket & { total: number | string; awaiting_rights: number | string | null };
type ImportRow = RowDataPacket & {
  source_name: string;
  row_count: number | string;
  products_created: number | string;
  created_at: Date | string;
};

async function main() {
  const configuredDatabase = assertLocalMySqlTarget();
  const pool = getMySqlPool();
  const [serverRows] = await pool.query<ServerRow[]>(
    "SELECT DATABASE() AS database_name, VERSION() AS server_version, @@version_comment AS server_comment, @@hostname AS server_host, @@port AS server_port",
  );
  const server = serverRows[0];
  if (!server) throw new Error("MySQL returned no server identity.");

  const [tableRows] = await pool.query<TableRow[]>(
    "SELECT table_name, table_type, engine, table_rows FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name",
  );
  const tables = new Set(tableRows.map((row) => row.table_name));
  const has = (name: string) => tables.has(name);

  const result: Record<string, unknown> = {
    readOnly: true,
    database: {
      configuredDatabase,
      connectedDatabase: server.database_name,
      serverVersion: server.server_version,
      serverComment: server.server_comment,
      serverHost: server.server_host,
      serverPort: Number(server.server_port),
      localTargetValidated: true,
    },
    schema: {
      tableCount: tables.size,
      existingTables: tableRows.map((row) => ({
        name: row.table_name,
        type: row.table_type,
        engine: row.engine,
        estimatedRows: row.table_rows === null ? null : Number(row.table_rows),
      })),
      migrationsApplied: has("__drizzle_migrations"),
      schemaInitializationGate: has("__drizzle_migrations")
        ? "migration_journal_present"
        : tables.size === 0
          ? "empty_database_ready_for_migration_review"
          : "blocked_existing_tables_without_migration_journal",
      productsTablePresent: has("products"),
      productVariantsTablePresent: has("product_variants"),
      productMediaTablePresent: has("product_media"),
      catalogueImportBatchesTablePresent: has("catalogue_import_batches"),
    },
  };

  if (has("__drizzle_migrations")) {
    const [rows] = await pool.query<CountRow[]>("SELECT COUNT(*) AS total FROM __drizzle_migrations");
    result.migrations = { appliedEntries: Number(rows[0]?.total ?? 0) };
  } else {
    result.migrations = { appliedEntries: null, status: "missing_migration_journal" };
  }

  if (has("products")) {
    const [counts] = await pool.query<CountRow[]>("SELECT COUNT(*) AS total FROM products");
    const productCount = Number(counts[0]?.total ?? 0);
    const [statuses] = await pool.query<StatusRow[]>(
      "SELECT status, COUNT(*) AS total FROM products GROUP BY status ORDER BY status",
    );
    const [providers] = await pool.query<ProviderRow[]>(
      "SELECT COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(source_metadata, '$.provider')), ''), 'unknown') AS provider, COUNT(*) AS total FROM products GROUP BY provider ORDER BY provider",
    );
    result.catalogue = {
      totalProducts: productCount,
      byStatus: Object.fromEntries(statuses.map((row) => [row.status, Number(row.total)])),
      bySourceProvider: Object.fromEntries(providers.map((row) => [row.provider, Number(row.total)])),
      photoMappingGate: productCount > 0 ? "catalogue_present" : "blocked_empty_catalogue",
    };
  } else {
    result.catalogue = { totalProducts: null, photoMappingGate: "blocked_products_table_missing" };
  }

  if (has("product_variants")) {
    const [rows] = await pool.query<CountRow[]>("SELECT COUNT(*) AS total FROM product_variants");
    result.productVariants = Number(rows[0]?.total ?? 0);
  }
  if (has("product_media")) {
    const [rows] = await pool.query<MediaCountRow[]>(
      "SELECT COUNT(*) AS total, SUM(CASE WHEN rights_confirmed = 0 THEN 1 ELSE 0 END) AS awaiting_rights FROM product_media",
    );
    result.productMedia = {
      total: Number(rows[0]?.total ?? 0),
      awaitingRights: Number(rows[0]?.awaiting_rights ?? 0),
    };
  }
  if (has("catalogue_import_batches")) {
    const [totals] = await pool.query<(CountRow & { products_created: number | string; latest_created_at: Date | string | null })[]>(
      "SELECT COUNT(*) AS total, COALESCE(SUM(products_created), 0) AS products_created, MAX(created_at) AS latest_created_at FROM catalogue_import_batches",
    );
    const [latest] = await pool.query<ImportRow[]>(
      "SELECT source_name, row_count, products_created, created_at FROM catalogue_import_batches ORDER BY created_at DESC LIMIT 5",
    );
    result.catalogueImports = {
      batchCount: Number(totals[0]?.total ?? 0),
      productsCreatedAcrossBatches: Number(totals[0]?.products_created ?? 0),
      latestCreatedAt: totals[0]?.latest_created_at ?? null,
      latestBatches: latest.map((row) => ({
        sourceName: pathSafeSourceName(row.source_name),
        rowCount: Number(row.row_count),
        productsCreated: Number(row.products_created),
        createdAt: row.created_at,
      })),
    };
  } else {
    result.catalogueImports = { batchCount: null, status: "import_batch_table_missing" };
  }

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.stderr.write("READ-ONLY PREFLIGHT — no rows or files were changed.\n");
}

function pathSafeSourceName(value: string): string {
  return value.replace(/^.*[\\/]/, "").slice(0, 120);
}

main().catch((error: unknown) => {
  process.stderr.write((error instanceof Error ? error.message : "MySQL catalogue preflight failed.") + "\n");
  process.exitCode = 1;
}).finally(async () => {
  await closeMySqlPool().catch(() => undefined);
});
