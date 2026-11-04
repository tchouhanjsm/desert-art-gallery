import { closeMySqlPool, getMySqlDb } from "../src/server/db";
import { products } from "../src/server/db/schema";
import { assertLocalMySqlTarget } from "../src/server/db/safety";
import {
  buildRecoveredProductMapping,
  scanRecoveredProductFolders,
} from "../src/server/catalogue/recovered-product-folder-mapping";

async function main() {
  assertLocalMySqlTarget();

  const inventory = await scanRecoveredProductFolders();
  const db = getMySqlDb();
  const productRows = await db.select({
    id: products.id,
    title: products.title,
    slug: products.slug,
    status: products.status,
    sourceMetadata: products.sourceMetadata,
  }).from(products);

  const report = buildRecoveredProductMapping(inventory, productRows);
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");

  process.stderr.write(
    "READ-ONLY MAPPING PREVIEW — no photographs were moved, copied, renamed, uploaded or deleted; no MySQL rows were written.\n",
  );
  process.stderr.write(
    "Every exact candidate requires owner review. Ranked fuzzy title suggestions are diagnostic only and are never accepted as exact candidates or staging approvals.\n",
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    (error instanceof Error ? error.message : "Recovered product mapping preview failed.") + "\n",
  );
  process.exitCode = 1;
}).finally(async () => {
  await closeMySqlPool().catch(() => undefined);
});
