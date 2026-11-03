import { closeMySqlPool } from "../src/server/db";
import {
  commitLocalProductImages,
  previewLocalProductImageImport,
  PRODUCT_IMAGE_IMPORT_CONFIRMATION,
} from "../src/server/catalogue/import-product-images";

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes("--commit");
  const confirmed = args.includes("--confirm-local-import");
  if (commit && !confirmed) {
    throw new Error("Commit mode requires both --commit and --confirm-local-import.");
  }

  const preview = await previewLocalProductImageImport();
  const printable = {
    intakeRoot: preview.intakeRoot,
    productFolders: preview.productFolders,
    matchedProducts: preview.matchedProducts,
    validImages: preview.validImages,
    newImages: preview.newImages,
    duplicateImages: preview.duplicateImages,
    folders: preview.folders.map((folder) => ({
      slug: folder.slug,
      productTitle: folder.productTitle,
      productStatus: folder.productStatus,
      existingMediaCount: folder.existingMediaCount,
      files: folder.files.map((file) => ({
        filename: file.filename,
        role: file.role,
        mimeType: file.mimeType,
        byteSize: file.byteSize,
        alreadyImported: file.alreadyImported || file.duplicateInBatch,
      })),
      errors: folder.errors,
      warnings: folder.warnings,
    })),
    errors: preview.errors,
    warnings: preview.warnings,
    canCommit: preview.canCommit,
  };
  process.stdout.write(JSON.stringify(printable, null, 2) + "\n");

  if (!preview.canCommit) {
    process.exitCode = 2;
    return;
  }
  if (!commit) {
    process.stdout.write("\nDRY RUN ONLY — no media files or MySQL rows were written.\n");
    return;
  }

  const result = await commitLocalProductImages(PRODUCT_IMAGE_IMPORT_CONFIRMATION);
  process.stdout.write("\nImported product photographs:\n" + JSON.stringify(result, null, 2) + "\n");
  process.stdout.write("\nImages remain private and rights-unapproved until reviewed and explicitly approved in the owner product editor.\n");
}

main().catch((error: unknown) => {
  process.stderr.write((error instanceof Error ? error.message : "Product image import failed.") + "\n");
  process.exitCode = 1;
}).finally(async () => {
  await closeMySqlPool().catch(() => undefined);
});
