import path from "node:path";
import { resolveLocalBackupPath, verifyLocalBackupSet } from "../src/lib/local-backup";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !args[0] || args[0].startsWith("-")) {
    throw new Error("Usage: npm run local:backup:verify -- <backup-id>");
  }
  const backupRoot = path.resolve(process.cwd(), ".local-data", "backups");
  const backupDirectory = resolveLocalBackupPath(backupRoot, args[0]);
  const manifest = await verifyLocalBackupSet(backupDirectory);
  process.stdout.write("Backup integrity: verified\n");
  process.stdout.write("Created: " + manifest.createdAt + "\n");
  process.stdout.write("Source database: " + manifest.database.name + "\n");
  process.stdout.write("Migration entries: " + manifest.database.migrationCount + "\n");
  process.stdout.write("Media files: " + manifest.media.files.length + "\n");
  process.stdout.write("No database or media files were changed.\n");
}

main().catch((error: unknown) => {
  process.stderr.write((error instanceof Error ? error.message : "Backup verification failed.") + "\n");
  process.exitCode = 1;
});
