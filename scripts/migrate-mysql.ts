import { existsSync } from "node:fs";
import { inspect } from "node:util";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { isSupportedMySqlServer } from "../src/lib/local-mysql-runtime";
import { closeMySqlPool, getMySqlDb, getMySqlPool, hasMySqlDatabase } from "../src/server/db";
import { assertLocalMySqlTarget } from "../src/server/db/safety";
import { assertMySqlMigrationInitializationAllowed } from "../src/server/db/migration-safety";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

type DatabaseIdentityRow = {
  database_name: string;
  server_version: string;
  server_comment: string;
};
type TableNameRow = {
  name: string;
};

async function main() {
  if (!hasMySqlDatabase()) {
    throw new Error("DATABASE_URL must be set before applying MySQL migrations.");
  }

  const configuredDatabase = assertLocalMySqlTarget();
  const pool = getMySqlPool();
  const [identityRows] = await pool.query<DatabaseIdentityRow[]>(
    "SELECT DATABASE() AS database_name, VERSION() AS server_version, @@version_comment AS server_comment",
  );
  const identity = identityRows[0];
  if (!identity) throw new Error("MySQL returned no database identity.");
  if (identity.database_name.toLowerCase() !== configuredDatabase.toLowerCase()) {
    throw new Error("The connected MySQL database does not match the database configured in DATABASE_URL.");
  }
  if (!isSupportedMySqlServer(identity.server_version, identity.server_comment)) {
    throw new Error("MySQL migrations require Oracle MySQL 8.0.16 or newer. MariaDB and older versions are blocked.");
  }

  const [tableRows] = await pool.query<TableNameRow[]>(
    "SELECT TABLE_NAME AS name FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME",
  );
  const state = assertMySqlMigrationInitializationAllowed(tableRows.map((row) => row.name));

  process.stdout.write(
    "MySQL migration preflight: database=" +
      identity.database_name +
      ", existingTables=" +
      state.tableCount +
      ", migrationJournal=" +
      (state.migrationJournalPresent ? "present" : "not present") +
      "\n",
  );

  await migrate(getMySqlDb(), { migrationsFolder: "./drizzle" });
  process.stdout.write("MySQL migrations applied successfully.\n");
}

main().catch((error: unknown) => {
  process.stderr.write("MySQL migration failed.\n");
  process.stderr.write(inspect(error, { depth: 8, colors: false, compact: false }) + "\n");
  const cause = (error as { cause?: unknown } | null)?.cause;
  if (cause) {
    process.stderr.write("Underlying database error:\n");
    process.stderr.write(inspect(cause, { depth: 8, colors: false, compact: false }) + "\n");
  }
  process.exitCode = 1;
}).finally(async () => {
  await closeMySqlPool().catch((error: unknown) => {
    process.stderr.write("Unable to close the MySQL pool cleanly: " + String(error) + "\n");
    process.exitCode = 1;
  });
});
