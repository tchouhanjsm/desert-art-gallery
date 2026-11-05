import { existsSync } from "node:fs";
import {
  createLocalBackupBundle,
  inspectLocalBackupSource,
} from "../src/server/db/local-backup";

if (existsSync(".env")) process.loadEnvFile(".env");

function parseArguments(args: string[]) {
  const allowed = new Set(["--commit", "--confirm-local-backup"]);
  const unknown = args.filter((arg) => !allowed.has(arg));
  if (unknown.length) throw new Error("Unknown argument(s): " + unknown.join(", "));
  const commit = args.includes("--commit");
  const confirmed = args.includes("--confirm-local-backup");
  if (confirmed && !commit) throw new Error("--confirm-local-backup requires --commit.");
  if (commit && !confirmed) {
    throw new Error("Writing a backup requires both --commit and --confirm-local-backup. The default is a read-only preflight.");
  }
  return { commit };
}

async function main() {
  const { commit } = parseArguments(process.argv.slice(2));
  const plan = await inspectLocalBackupSource();
  process.stdout.write("Local MySQL + private-media backup preflight\n");
  process.stdout.write(JSON.stringify({
    sourceDatabase: plan.databaseName,
    mysqlServer: plan.serverVersion,
    schemaObjects: plan.tableCount,
    appliedMigrations: plan.migrationCount,
    mediaFiles: plan.mediaFileCount,
    mediaBytes: plan.mediaBytes,
    backupRoot: plan.backupRoot,
    mediaDriver: "local",
  }, null, 2) + "\n");

  if (!commit) {
    process.stdout.write("\nDRY RUN ONLY — no database dump or media copy was created.\n");
    process.stdout.write("After reviewing the source and destination, run:\n");
    process.stdout.write("npm run db:backup -- --commit --confirm-local-backup\n");
    return;
  }

  const result = await createLocalBackupBundle();
  process.stdout.write("\nBackup bundle created successfully:\n");
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.stdout.write("The manifest contains SHA-256 checksums for the SQL dump and each media file.\n");
  process.stdout.write("The bundle is unencrypted SQL and private media; store it only on an encrypted, access-controlled disk.\n");
}

main().catch((error: unknown) => {
  process.stderr.write((error instanceof Error ? error.message : "Local backup failed.") + "\n");
  process.exitCode = 1;
});
