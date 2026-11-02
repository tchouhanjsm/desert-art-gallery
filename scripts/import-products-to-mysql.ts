import { readFile } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { closeMySqlPool } from "../src/server/db";
import {
  commitLocalCatalogueCsv,
  previewLocalCatalogueCsv,
} from "../src/server/catalogue/import-csv";

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes("--commit");
  const confirmed = args.includes("--confirm-local-import");
  const sourcePath = args.find((arg) => !arg.startsWith("--"));
  if (!sourcePath) {
    throw new Error("Usage: npm run db:import-products -- ./EtsyListingsDownload.csv [--commit --confirm-local-import]");
  }
  if (commit && !confirmed) {
    throw new Error("Commit mode requires both --commit and --confirm-local-import.");
  }
  const absolutePath = resolve(sourcePath);
  const bytes = new Uint8Array(await readFile(absolutePath));
  const sourceName = basename(absolutePath);

  if (!commit) {
    const preview = await previewLocalCatalogueCsv(sourceName, bytes);
    process.stdout.write(JSON.stringify(preview, null, 2) + "\n");
    process.stdout.write("\nDRY RUN ONLY — no product, variant or stock rows were written.\n");
    if (!preview.canCommit) process.exitCode = 2;
    return;
  }

  const result = await commitLocalCatalogueCsv(sourceName, bytes, "IMPORT_TO_LOCAL_MYSQL");
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.stdout.write("\nImport committed. Products remain drafts. Etsy image URLs are source references only; add authorized originals and confirm image rights before publication.\n");
}

main().catch((error: unknown) => {
  process.stderr.write((error instanceof Error ? error.message : "Catalogue import failed.") + "\n");
  process.exitCode = 1;
}).finally(async () => {
  await closeMySqlPool().catch(() => undefined);
});
