import { readFile } from "node:fs/promises";
import path from "node:path";
import { inArray } from "drizzle-orm";
import { closeMySqlPool, getMySqlDb } from "../src/server/db";
import { products } from "../src/server/db/schema";
import { assertLocalMySqlTarget } from "../src/server/db/safety";
import {
  commitRecoveredPhotoStaging,
  parseRecoveredPhotoApprovalCsv,
  previewRecoveredPhotoStaging,
  RECOVERED_PHOTO_STAGING_CONFIRMATION,
  validateRecoveredPhotoApprovalsAgainstCatalogue,
} from "../src/server/catalogue/recovered-product-photo-staging";

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes("--commit");
  const confirmed = args.includes("--confirm-recovered-photo-staging");
  const sourceCsv = args.find((argument) => !argument.startsWith("--"));
  if (!sourceCsv) {
    throw new Error(
      "Usage: npm run media:stage-recovered -- ./recovered-photo-mapping-review.csv [--commit --confirm-recovered-photo-staging]",
    );
  }
  if (commit && !confirmed) {
    throw new Error("Commit mode requires both --commit and --confirm-recovered-photo-staging.");
  }
  const absoluteCsv = path.resolve(sourceCsv);
  if (!absoluteCsv.toLowerCase().endsWith(".csv")) throw new Error("The owner mapping manifest must be a CSV file.");

  assertLocalMySqlTarget();
  const parsed = parseRecoveredPhotoApprovalCsv(await readFile(absoluteCsv, "utf8"));
  const productIds = [...new Set(parsed.approvals.map((approval) => approval.approvedProductId))];
  const db = getMySqlDb();
  const catalogueProducts = productIds.length
    ? await db.select({
      id: products.id,
      slug: products.slug,
      status: products.status,
      sourceMetadata: products.sourceMetadata,
    }).from(products).where(inArray(products.id, productIds))
    : [];
  const catalogueErrors = validateRecoveredPhotoApprovalsAgainstCatalogue(parsed.approvals, catalogueProducts);
  if (catalogueErrors.length) throw new Error("Owner-approved product validation failed:\n" + catalogueErrors.join("\n"));

  const plan = await previewRecoveredPhotoStaging(parsed);
  process.stdout.write(JSON.stringify({
    mode: commit ? "commit" : "preview",
    manifest: path.basename(absoluteCsv),
    summary: {
      totalRows: parsed.totalRows,
      approvedFolders: plan.approvedFolders,
      pendingFolders: plan.pendingFolders,
      rejectedFolders: plan.rejectedFolders,
      sourceImages: plan.sourceImages,
      filesToCopy: plan.filesToCopy,
      filesAlreadyPresent: plan.filesAlreadyPresent,
      totalBytes: plan.totalBytes,
      canStage: plan.canStage,
    },
    errors: plan.errors,
    warnings: plan.warnings,
    files: plan.files.map((file) => ({
      source: file.sourceRelativePath,
      target: file.targetRelativePath,
      sizeBytes: file.sizeBytes,
      sha256: file.sha256,
      alreadyPresent: file.alreadyPresent,
    })),
  }, null, 2) + "\n");

  if (!commit) {
    process.stderr.write(
      "DRY RUN ONLY — no source photos were changed, no intake files were copied and no MySQL rows were written.\n",
    );
    if (!plan.canStage) process.exitCode = 2;
    return;
  }

  const result = await commitRecoveredPhotoStaging(RECOVERED_PHOTO_STAGING_CONFIRMATION, plan);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.stderr.write(
    "STAGING COPY COMPLETE — originals remain untouched; copies are private intake files only. No media rows, rights approvals or publications were created.\n",
  );
}

main().catch((error: unknown) => {
  process.stderr.write((error instanceof Error ? error.message : "Recovered-photo staging failed.") + "\n");
  process.exitCode = 1;
}).finally(async () => {
  await closeMySqlPool().catch(() => undefined);
});
