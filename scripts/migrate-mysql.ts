import { existsSync } from "node:fs";
import { inspect } from "node:util";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { closeMySqlPool, getMySqlDb, hasMySqlDatabase } from "../src/server/db";

// Load local credentials when present, but keep CI/deployment-injected variables working.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

async function main() {
  if (!hasMySqlDatabase()) {
    throw new Error("DATABASE_URL must be set before applying MySQL migrations.");
  }

  try {
    await migrate(getMySqlDb(), { migrationsFolder: "./drizzle" });
    process.stdout.write("MySQL migrations applied successfully.\n");
  } catch (error) {
    process.stderr.write("MySQL migration failed.\n");
    process.stderr.write(inspect(error, { depth: 8, colors: false, compact: false }) + "\n");
    const cause = (error as { cause?: unknown } | null)?.cause;
    if (cause) {
      process.stderr.write("Underlying database error:\n");
      process.stderr.write(inspect(cause, { depth: 8, colors: false, compact: false }) + "\n");
    }
    process.exitCode = 1;
  } finally {
    await closeMySqlPool().catch((error: unknown) => {
      process.stderr.write("Unable to close the MySQL pool cleanly: " + String(error) + "\n");
      process.exitCode = 1;
    });
  }
}

main().catch((error: unknown) => {
  process.stderr.write(inspect(error, { depth: 8, colors: false, compact: false }) + "\n");
  process.exitCode = 1;
});
