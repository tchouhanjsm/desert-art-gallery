import { createHash, randomUUID } from "node:crypto";
import { basename } from "node:path";
import { and, eq, inArray, sql } from "drizzle-orm";
import { parseProductCsv, type ProductImportRow } from "../../lib/product-import";
import { getMySqlDb } from "../db";
import { assertLocalMySqlTarget } from "../db/safety";
import {
  catalogueImportBatches, inventoryMovements, productCategories,
  productCategoryLinks, products, productVariants,
} from "../db/schema";

const MAX_BYTES = 2 * 1024 * 1024;

export type LocalCatalogueImportRow = {
  line: number;
  slug: string;
  title: string;
  sku: string | null;
  categorySlug: string | null;
  quantityOnHand: number;
  priceMinor: number | null;
  currency: string;
  errors: string[];
};

export type LocalCatalogueImportPreview = {
  sourceName: string;
  sourceSha256: string;
  totalRows: number;
  validRows: number;
  productsInTarget: number;
  alreadyImported: boolean;
  rows: LocalCatalogueImportRow[];
  errors: string[];
  warnings: string[];
  canCommit: boolean;
};

export type LocalCatalogueImportResult = {
  batchId: string;
  sourceSha256: string;
  productsCreated: number;
  stockUnitsAdded: number;
};

function decodeCsv(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("The CSV must contain valid UTF-8 text.");
  }
}


function validateInput(sourceName: string, bytes: Uint8Array): {
  sourceName: string;
  sourceSha256: string;
  rows: ProductImportRow[];
  errors: string[];
} {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1 || bytes.byteLength > MAX_BYTES) {
    throw new Error("Choose a CSV between 1 byte and 2 MB.");
  }
  const decodedName = basename(sourceName || "catalogue.csv").slice(0, 255);
  if (!decodedName.toLowerCase().endsWith(".csv")) throw new Error("The source file must have a .csv extension.");
  const sourceSha256 = createHash("sha256").update(bytes).digest("hex");
  const parsed = parseProductCsv(decodeCsv(bytes));
  return {
    sourceName: decodedName,
    sourceSha256,
    rows: parsed.rows,
    errors: [...parsed.errors],
  };
}

export async function previewLocalCatalogueCsv(sourceName: string, bytes: Uint8Array): Promise<LocalCatalogueImportPreview> {
  assertLocalMySqlTarget();
  const input = validateInput(sourceName, bytes);
  const db = getMySqlDb();
  const rows: LocalCatalogueImportRow[] = input.rows.map((row) => ({
    line: row.line,
    slug: row.slug,
    title: row.title,
    sku: row.sku,
    categorySlug: row.category_slug,
    quantityOnHand: row.quantity_on_hand,
    priceMinor: row.price_minor,
    currency: row.currency,
    errors: [...row.errors],
  }));

  for (const row of rows) {
    if (row.priceMinor === null || row.priceMinor < 1) {
      row.errors.push("A verified price greater than zero is required before a product can be imported.");
    }
  }

  const categorySlugs = [...new Set(rows.flatMap((row) => row.categorySlug ? [row.categorySlug] : []))];
  const categories = categorySlugs.length
    ? await db.select({ id: productCategories.id, slug: productCategories.slug }).from(productCategories)
      .where(and(inArray(productCategories.slug, categorySlugs), eq(productCategories.isActive, true)))
    : [];
  const existingCategorySlugs = new Set(categories.map((row) => row.slug));
  for (const row of rows) {
    if (row.categorySlug && !existingCategorySlugs.has(row.categorySlug)) {
      row.errors.push("Category does not exist or is not active in MySQL: " + row.categorySlug + ".");
    }
  }

  const slugs = [...new Set(rows.map((row) => row.slug).filter(Boolean))];
  const existingSlugs = slugs.length
    ? await db.select({ slug: products.slug }).from(products).where(inArray(products.slug, slugs))
    : [];
  const existingSlugSet = new Set(existingSlugs.map((row) => row.slug));
  for (const row of rows) {
    if (existingSlugSet.has(row.slug)) row.errors.push("Slug already exists in the MySQL catalogue.");
  }

  const skus = [...new Set(rows.flatMap((row) => row.sku ? [row.sku] : []))];
  const existingSkus = skus.length
    ? await db.select({ sku: productVariants.sku }).from(productVariants).where(inArray(productVariants.sku, skus))
    : [];
  const existingSkuSet = new Set(existingSkus.flatMap((row) => row.sku ? [row.sku] : []));
  for (const row of rows) {
    if (row.sku && existingSkuSet.has(row.sku)) row.errors.push("SKU already exists in the MySQL catalogue.");
  }

  const duplicate = await db.select({ id: catalogueImportBatches.id })
    .from(catalogueImportBatches)
    .where(eq(catalogueImportBatches.sourceSha256, input.sourceSha256))
    .limit(1);
  const [countRow] = await db.select({ count: sql<number>`COUNT(*)` }).from(products);
  const productsInTarget = Number(countRow?.count ?? 0);
  const warnings = [
    "Imported products remain drafts and are not published automatically.",
    "CSV import does not upload photographs; add original images and confirm usage rights in the owner workspace.",
    "Opening stock is recorded against a default Standard variant in the inventory movement ledger.",
  ];
  if (productsInTarget > 0) warnings.push("The MySQL product table is not empty; commit is blocked to prevent a merge or overwrite.");
  if (duplicate.length) warnings.push("This exact CSV content has already been imported; commit is blocked by its source hash.");
  const validRows = rows.filter((row) => row.errors.length === 0).length;
  const errors = input.errors;
  return {
    sourceName: input.sourceName,
    sourceSha256: input.sourceSha256,
    totalRows: rows.length,
    validRows,
    productsInTarget,
    alreadyImported: duplicate.length > 0,
    rows,
    errors,
    warnings,
    canCommit: errors.length === 0 && rows.length > 0 && validRows === rows.length
      && productsInTarget === 0 && duplicate.length === 0,
  };
}

export async function commitLocalCatalogueCsv(
  sourceName: string,
  bytes: Uint8Array,
  confirmation: string,
): Promise<LocalCatalogueImportResult> {
  if (confirmation !== "IMPORT_TO_LOCAL_MYSQL") {
    throw new Error("Pass the explicit IMPORT_TO_LOCAL_MYSQL confirmation before writing product data.");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("CSV catalogue import is blocked when NODE_ENV=production.");
  }
  assertLocalMySqlTarget();
  const preview = await previewLocalCatalogueCsv(sourceName, bytes);
  if (!preview.canCommit) {
    const details = [
      ...preview.errors,
      ...preview.rows.flatMap((row) => row.errors.map((error) => "Line " + row.line + ": " + error)),
      ...preview.warnings,
    ];
    throw new Error("CSV import is not ready to commit. " + details.join(" "));
  }

  const input = validateInput(sourceName, bytes);
  const db = getMySqlDb();
  const batchId = randomUUID();
  const stockUnitsAdded = input.rows.reduce((total, row) => total + row.quantity_on_hand, 0);
  const categorySlugs = [...new Set(input.rows.flatMap((row) => row.category_slug ? [row.category_slug] : []))];

  await db.transaction(async (tx) => {
    const [countRow] = await tx.select({ count: sql<number>`COUNT(*)` }).from(products);
    if (Number(countRow?.count ?? 0) !== 0) {
      throw new Error("The MySQL product table changed after preview. No rows were imported.");
    }
    const duplicate = await tx.select({ id: catalogueImportBatches.id })
      .from(catalogueImportBatches)
      .where(eq(catalogueImportBatches.sourceSha256, input.sourceSha256))
      .limit(1);
    if (duplicate.length) throw new Error("This source CSV has already been imported.");
    const categories = categorySlugs.length
      ? await tx.select({ id: productCategories.id, slug: productCategories.slug }).from(productCategories)
        .where(and(inArray(productCategories.slug, categorySlugs), eq(productCategories.isActive, true)))
      : [];
    if (categories.length !== categorySlugs.length) {
      throw new Error("A category changed after preview. Refresh the preview and retry.");
    }
    const categoryBySlug = new Map(categories.map((category) => [category.slug, category.id]));

    for (const row of input.rows) {
      if (row.price_minor === null || row.price_minor < 1) throw new Error("CSV row " + row.line + " has no verified non-zero price.");
      const productId = randomUUID();
      const variantId = randomUUID();
      await tx.insert(products).values({
        id: productId,
        title: row.title,
        slug: row.slug,
        shortDescription: row.short_description,
        description: row.description || null,
        productType: "",
        materials: row.materials,
        sizes: row.sizes,
        measurements: row.measurements,
        conditionNotes: row.condition_notes || null,
        provenance: row.provenance || null,
        craftStory: row.craft_story || null,
        currency: row.currency,
        priceMinor: row.price_minor,
        compareAtPriceMinor: row.compare_at_price_minor,
        status: "draft",
        isOneOfAKind: false,
        featured: false,
        publishedAt: null,
      });
      await tx.insert(productVariants).values({
        id: variantId,
        productId,
        sku: row.sku,
        label: "Standard",
        attributes: {},
        priceMinor: null,
        currency: row.currency,
        stockQuantity: row.quantity_on_hand,
        isActive: true,
        sortOrder: 0,
      });
      const categoryId = row.category_slug ? categoryBySlug.get(row.category_slug) : null;
      if (categoryId) {
        await tx.insert(productCategoryLinks).values({ productId, categoryId });
      }
      if (row.quantity_on_hand > 0) {
        await tx.insert(inventoryMovements).values({
          id: randomUUID(),
          variantId,
          quantityDelta: row.quantity_on_hand,
          reason: "CSV opening balance",
          referenceKey: "csv-import:" + batchId + ":" + variantId + ":opening",
          actorId: null,
        });
      }
    }

    await tx.insert(catalogueImportBatches).values({
      id: batchId,
      sourceSha256: input.sourceSha256,
      sourceName: input.sourceName,
      rowCount: input.rows.length,
      productsCreated: input.rows.length,
      stockUnitsAdded,
      report: {
        source_sha256: input.sourceSha256,
        source_name: input.sourceName,
        products_created: input.rows.length,
        stock_units_added: stockUnitsAdded,
        status: "drafts_created",
        media_imported: false,
      },
    });
  });

  return {
    batchId,
    sourceSha256: input.sourceSha256,
    productsCreated: input.rows.length,
    stockUnitsAdded,
  };
}
