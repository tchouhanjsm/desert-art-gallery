import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { closeMySqlPool, getMySqlDb } from "../src/server/db";
import { products } from "../src/server/db/schema";
import { assertLocalMySqlTarget } from "../src/server/db/safety";
import {
  buildRecoveredProductMapping,
  type RecoveredProductFolderInventory,
} from "../src/server/catalogue/recovered-product-folder-mapping";
import {
  auditRecoveredProductPhotos,
  recoveredPhotoInventoryCsv,
} from "../src/server/catalogue/recovered-product-photo-audit";
import { recoveredProductMappingCsv } from "../src/server/catalogue/recovered-product-folder-mapping";

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    const value = key(item);
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

async function main() {
  assertLocalMySqlTarget();

  const audit = await auditRecoveredProductPhotos();
  const db = getMySqlDb();
  const productRows = await db.select({
    id: products.id,
    title: products.title,
    slug: products.slug,
    status: products.status,
    sourceMetadata: products.sourceMetadata,
  }).from(products);

  const mappingInventory: RecoveredProductFolderInventory = {
    root: audit.root,
    productFolders: audit.folders.map((folder) => ({
      folderName: folder.folderName,
      imageCount: folder.imageCount,
      imageBytes: folder.imageBytes,
      oversizedImages: folder.oversizedImages,
      unsupportedFiles: folder.unsupportedFiles,
      nestedDirectories: folder.nestedDirectories,
      ignoredHiddenFiles: folder.ignoredSidecars.length,
      errors: folder.errors,
    })),
    totalImages: audit.summary.imageFiles,
    totalImageBytes: audit.summary.totalImageBytes,
    unsupportedFileCount: audit.summary.unsupportedFiles,
    oversizedImageCount: audit.summary.oversizedImages,
    nestedDirectoryCount: audit.summary.nestedDirectories,
    ignoredHiddenFileCount: audit.summary.macosSidecars,
    errors: audit.errors,
  };
  const mapping = buildRecoveredProductMapping(mappingInventory, productRows);
  const matchedSlugs = new Set(mapping.mappings.flatMap((row) => row.candidateProducts.map((product) => product.slug)));
  const catalogue = {
    totalProducts: productRows.length,
    byStatus: countBy(productRows, (product) => product.status),
    bySourceProvider: countBy(productRows, (product) => (
      typeof product.sourceMetadata?.provider === "string" ? product.sourceMetadata.provider : "unknown"
    )),
    productsWithoutExactRecoveredTitleFolder: productRows.filter((product) => !matchedSlugs.has(product.slug)).length,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    safety: {
      originalsModified: false,
      mysqlRowsWritten: false,
      imageRightsApproved: false,
      productsPublished: false,
      allMappingsRequireOwnerReview: true,
    },
    catalogue,
    photoAudit: audit,
    mapping,
  };

  const reportRoot = path.resolve(process.cwd(), ".local-data", "recovery", "reports");
  await mkdir(reportRoot, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(reportRoot, "recovered-photo-audit-" + timestamp + ".json");
  const inventoryCsvPath = path.join(reportRoot, "recovered-photo-inventory-" + timestamp + ".csv");
  const mappingCsvPath = path.join(reportRoot, "recovered-photo-mapping-review-" + timestamp + ".csv");

  await writeFile(jsonPath, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  await writeFile(inventoryCsvPath, recoveredPhotoInventoryCsv(audit.files), { flag: "wx" });
  await writeFile(mappingCsvPath, recoveredProductMappingCsv(mapping), { flag: "wx" });

  process.stdout.write(JSON.stringify({
    reportDirectory: reportRoot,
    jsonReport: jsonPath,
    inventoryCsv: inventoryCsvPath,
    mappingReviewCsv: mappingCsvPath,
    catalogue,
    photoAudit: audit.summary,
    mapping: mapping.summary,
  }, null, 2) + "\n");
  process.stderr.write(
    "READ-ONLY AUDIT — originals were not changed; MySQL was queried only; no media rows or rights records were written.\n",
  );
}

main().catch((error: unknown) => {
  process.stderr.write((error instanceof Error ? error.message : "Recovered photo audit failed.") + "\n");
  process.exitCode = 1;
}).finally(async () => {
  await closeMySqlPool().catch(() => undefined);
});
