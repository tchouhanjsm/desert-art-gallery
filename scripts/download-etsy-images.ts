import { closeMySqlPool } from "../src/server/db";
import {
  downloadEtsyProductImages,
  ETSY_DOWNLOAD_CONFIRMATION,
  previewEtsyImageDownloads,
} from "../src/server/catalogue/etsy-image-downloader";

async function main() {
  const args = process.argv.slice(2);
  const download = args.includes("--download");
  const confirmed = args.includes("--confirm-etsy-download");
  if (download && !confirmed) {
    throw new Error("Download mode requires both --download and --confirm-etsy-download.");
  }

  const preview = await previewEtsyImageDownloads();
  const output = {
    intakeRoot: preview.intakeRoot,
    productsFound: preview.productsFound,
    productsReady: preview.productsReady,
    imagesFound: preview.imagesFound,
    imagesAlreadyDownloaded: preview.imagesAlreadyDownloaded,
    products: preview.products,
    errors: preview.errors,
    warnings: preview.warnings,
    canDownload: preview.canDownload,
  };
  process.stdout.write(JSON.stringify(output, null, 2) + "\n");

  if (!preview.canDownload) {
    process.exitCode = 2;
    return;
  }
  if (!download) {
    process.stdout.write("\nDRY RUN ONLY — no network requests or local files were written.\n");
    return;
  }

  const result = await downloadEtsyProductImages(ETSY_DOWNLOAD_CONFIRMATION);
  process.stdout.write("\nEtsy photographs downloaded:\n" + JSON.stringify(result, null, 2) + "\n");
  process.stdout.write("\nDownloaded files remain private in .local-data/imports/product-images/. Review their contents and usage rights before attaching or publishing them.\n");
}

main().catch((error: unknown) => {
  process.stderr.write((error instanceof Error ? error.message : "Etsy image download failed.") + "\n");
  process.exitCode = 1;
}).finally(async () => {
  await closeMySqlPool().catch(() => undefined);
});
