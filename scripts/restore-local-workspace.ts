import { existsSync } from "node:fs";
import {
  inspectLocalRestoreTarget,
  restoreLocalBackupBundle,
} from "../src/server/db/local-backup";

if (existsSync(".env")) process.loadEnvFile(".env");

function parseArguments(args: string[]) {
  const values = new Map<string, string>();
  const flags = new Set(["--commit", "--confirm-local-restore"]);
  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (flags.has(current)) continue;
    if (current !== "--backup" && current !== "--target-media") {
      throw new Error("Unknown restore argument: " + current);
    }
    const next = args[index + 1];
    if (!next || next.startsWith("--") || values.has(current)) {
      throw new Error(current + " requires one value and may be supplied only once.");
    }
    values.set(current, next);
    index += 1;
  }

  const commit = args.includes("--commit");
  const confirmed = args.includes("--confirm-local-restore");
  if (confirmed && !commit) throw new Error("--confirm-local-restore requires --commit.");
  if (commit && !confirmed) {
    throw new Error("Restore writes require both --commit and --confirm-local-restore. The default is a read-only preflight.");
  }
  const backupPath = values.get("--backup");
  const targetMediaRoot = values.get("--target-media");
  if (!backupPath || !targetMediaRoot) {
    throw new Error(
      "Usage: npm run db:restore -- --backup <backup-folder> --target-media <new-absolute-media-folder> [--commit --confirm-local-restore]",
    );
  }
  return { backupPath, targetMediaRoot, commit };
}

async function main() {
  const { backupPath, targetMediaRoot, commit } = parseArguments(process.argv.slice(2));
  const plan = await inspectLocalRestoreTarget({ backupPath, targetMediaRoot });
  process.stdout.write("Isolated local restore preflight\n");
  process.stdout.write(JSON.stringify({
    backupId: plan.backupId,
    backupPath: plan.backupPath,
    sourceDatabase: plan.sourceDatabase,
    targetDatabase: plan.targetDatabase,
    databaseBytes: plan.databaseBytes,
    schemaObjects: plan.tableCount,
    appliedMigrations: plan.migrationCount,
    mediaFiles: plan.mediaFileCount,
    mediaBytes: plan.mediaBytes,
    targetMediaRoot: plan.targetMediaRoot,
  }, null, 2) + "\n");

  if (!commit) {
    process.stdout.write("\nDRY RUN ONLY — target database and media directory were not modified.\n");
    process.stdout.write("After confirming the separate empty target and new media path, run the same command with --commit --confirm-local-restore.\n");
    return;
  }

  const restored = await restoreLocalBackupBundle({ backupPath, targetMediaRoot });
  process.stdout.write("\nBackup restored into an isolated local target:\n");
  process.stdout.write(JSON.stringify(restored, null, 2) + "\n");
  process.stdout.write("The tool did not edit .env. Verify the restored database and media pair locally before changing application configuration.\n");
}

main().catch((error: unknown) => {
  process.stderr.write((error instanceof Error ? error.message : "Local restore failed.") + "\n");
  process.exitCode = 1;
});
