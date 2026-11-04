import { mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildRecoveredProductMapping,
  normalizeRecoveredProductTitle,
  recoveredProductMappingCsv,
  scanRecoveredProductFolders,
  type RecoveredProductFolderInventory,
  type RecoveredProductRecord,
} from "./recovered-product-folder-mapping";

const temporaryRoots: string[] = [];

async function createTemporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "dag-recovered-products-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function inventoryWith(folderNames: string[]): RecoveredProductFolderInventory {
  return {
    root: "/recovery",
    productFolders: folderNames.map((folderName) => ({
      folderName,
      imageCount: 10,
      imageBytes: 1024,
      oversizedImages: [],
      unsupportedFiles: [],
      nestedDirectories: [],
      ignoredHiddenFiles: 0,
      errors: [],
    })),
    totalImages: folderNames.length * 10,
    totalImageBytes: folderNames.length * 1024,
    unsupportedFileCount: 0,
    oversizedImageCount: 0,
    nestedDirectoryCount: 0,
    ignoredHiddenFileCount: 0,
    errors: [],
  };
}

function etsyProduct(overrides: Partial<RecoveredProductRecord> = {}): RecoveredProductRecord {
  return {
    id: "product-1",
    title: "Banjara Jacket, Vintage Tribal Coat",
    slug: "banjara-jacket-vintage-tribal-coat-a1b2c3d",
    status: "draft",
    sourceMetadata: { provider: "etsy" },
    ...overrides,
  };
}

describe("recovered product folder mapping", () => {
  it("normalizes Unicode dashes, underscores, casing and whitespace without removing punctuation", () => {
    expect(normalizeRecoveredProductTitle("  Banjara_Jacket — VINTAGE  Coat "))
      .toBe("banjara jacket - vintage coat");
    expect(normalizeRecoveredProductTitle("Jacket, Vintage"))
      .not.toBe(normalizeRecoveredProductTitle("Jacket Vintage"));
  });

  it("reports a unique Etsy draft title candidate without treating it as owner-approved", () => {
    const report = buildRecoveredProductMapping(
      inventoryWith(["Banjara_Jacket, Vintage Tribal Coat"]),
      [etsyProduct()],
    );
    expect(report.summary.uniqueEtsyDraftCandidates).toBe(1);
    expect(report.mappings[0].status).toBe("unique_etsy_draft_candidate");
    expect(report.mappings[0].manualReviewRequired).toBe(true);
    expect(report.mappings[0].candidateProducts[0].slug).toBe(etsyProduct().slug);
  });

  it("ranks close title matches as suggestions without upgrading them to exact candidates", () => {
    const product = etsyProduct({
      title: "Vintage Raali Patchwork Jacket: Handmade Kantha Quilted Coat",
      slug: "vintage-raali-patchwork-jacket-a1b2c3d",
    });
    const report = buildRecoveredProductMapping(
      inventoryWith(["Vintage_Raali Patchwork Jacket Handmade Kantha Coat"]),
      [product],
    );

    expect(report.mappings[0].status).toBe("unmatched");
    expect(report.mappings[0].manualReviewRequired).toBe(true);
    expect(report.mappings[0].candidateProducts).toEqual([]);
    expect(report.mappings[0].suggestedProducts[0]).toMatchObject({
      id: product.id,
      slug: product.slug,
      sourceProvider: "etsy",
    });
    expect(report.mappings[0].suggestedProducts[0].similarityScore).toBeGreaterThan(0.7);
    expect(report.summary.unmatchedFoldersWithSuggestions).toBe(1);
    expect(report.summary.suggestedProductCandidates).toBe(1);

    const csv = recoveredProductMappingCsv(report);
    expect(csv).toContain('"suggested_product_ids"');
    expect(csv).toContain('"suggested_product_scores"');
    expect(csv).toContain('"NOT_REVIEWED"');
  });

  it("does not suggest a product when a folder shares only one generic title token", () => {
    const report = buildRecoveredProductMapping(
      inventoryWith(["Vintage Leather Jacket"]),
      [etsyProduct({ title: "Handmade Banjara Wool Patchwork Jacket" })],
    );
    expect(report.mappings[0].status).toBe("unmatched");
    expect(report.mappings[0].suggestedProducts).toEqual([]);
  });

  it("does not add fuzzy suggestions when an exact title candidate already exists", () => {
    const exact = etsyProduct();
    const close = etsyProduct({
      id: "product-2",
      title: "Banjara Jacket, Vintage Tribal Coat with Embroidery",
      slug: "banjara-jacket-embroidery",
    });
    const report = buildRecoveredProductMapping(
      inventoryWith(["Banjara_Jacket, Vintage Tribal Coat"]),
      [exact, close],
    );
    expect(report.mappings[0].status).toBe("unique_etsy_draft_candidate");
    expect(report.mappings[0].candidateProducts).toHaveLength(1);
    expect(report.mappings[0].suggestedProducts).toEqual([]);
  });

  it("does not use fuzzy or punctuation-stripping title matching", () => {
    const report = buildRecoveredProductMapping(
      inventoryWith(["Banjara Jacket Vintage Tribal Coat"]),
      [etsyProduct()],
    );
    expect(report.mappings[0].status).toBe("unmatched");
    expect(report.mappings[0].candidateProducts).toEqual([]);
  });

  it("marks multiple matching MySQL products as ambiguous", () => {
    const first = etsyProduct();
    const second = etsyProduct({ id: "product-2", slug: "another-slug" });
    const report = buildRecoveredProductMapping(
      inventoryWith(["Banjara_Jacket, Vintage Tribal Coat"]),
      [first, second],
    );
    expect(report.mappings[0].status).toBe("ambiguous_product_title");
    expect(report.mappings[0].candidateProducts).toHaveLength(2);
  });

  it("does not classify non-Etsy or non-draft product matches as import-ready", () => {
    const nonEtsy = etsyProduct({ sourceMetadata: { provider: "manual" } });
    const published = etsyProduct({ status: "published" });
    const nonEtsyReport = buildRecoveredProductMapping(
      inventoryWith(["Banjara_Jacket, Vintage Tribal Coat"]),
      [nonEtsy],
    );
    const publishedReport = buildRecoveredProductMapping(
      inventoryWith(["Banjara_Jacket, Vintage Tribal Coat"]),
      [published],
    );
    expect(nonEtsyReport.mappings[0].status).toBe("non_etsy_title_candidate");
    expect(publishedReport.mappings[0].status).toBe("non_draft_etsy_product");
  });

  it("marks duplicate recovered folder titles instead of silently choosing one", () => {
    const report = buildRecoveredProductMapping(
      inventoryWith(["Banjara Jacket", "Banjara_Jacket"]),
      [etsyProduct({ title: "Banjara Jacket" })],
    );
    expect(report.mappings.map((row) => row.status)).toEqual([
      "duplicate_recovered_title",
      "duplicate_recovered_title",
    ]);
  });

  it("scans local JPEG folders read-only and ignores macOS metadata sidecars", async () => {
    const root = await createTemporaryRoot();
    const productFolder = path.join(root, "Recovered Jacket");
    await mkdir(productFolder);
    await writeFile(path.join(root, ".DS_Store"), "metadata");
    await writeFile(path.join(productFolder, "01.jpg"), Buffer.from([0xff, 0xd8, 0xff]));
    await writeFile(path.join(productFolder, "02.jpg"), Buffer.from([0xff, 0xd8, 0xff]));
    await writeFile(path.join(productFolder, "._02.jpg"), "metadata");

    const before = (await readdir(productFolder)).sort();
    const inventory = await scanRecoveredProductFolders(root);
    const after = (await readdir(productFolder)).sort();

    expect(inventory.productFolders).toHaveLength(1);
    expect(inventory.totalImages).toBe(2);
    expect(inventory.productFolders[0].imageCount).toBe(2);
    expect(inventory.ignoredHiddenFileCount).toBe(2);
    expect(inventory.errors).toEqual([]);
    expect(after).toEqual(before);
  });

  it("reports unsupported files, oversized images and nested directories without rewriting them", async () => {
    const root = await createTemporaryRoot();
    const productFolder = path.join(root, "Recovered Jacket");
    await mkdir(productFolder);
    await mkdir(path.join(productFolder, "nested"));
    await writeFile(path.join(productFolder, "01.jpg"), Buffer.alloc(12 * 1024 * 1024 + 1, 1));
    await writeFile(path.join(productFolder, "notes.txt"), "not an image");

    const inventory = await scanRecoveredProductFolders(root);

    expect(inventory.totalImages).toBe(1);
    expect(inventory.oversizedImageCount).toBe(1);
    expect(inventory.unsupportedFileCount).toBe(1);
    expect(inventory.nestedDirectoryCount).toBe(1);
    expect(inventory.productFolders[0].oversizedImages).toEqual(["01.jpg"]);
    expect(inventory.productFolders[0].unsupportedFiles).toEqual(["notes.txt"]);
    expect(inventory.productFolders[0].nestedDirectories).toEqual(["nested"]);
  });

  it("exports an owner-review CSV without approving or silently resolving any row", async () => {
    const { recoveredProductMappingCsv } = await import("./recovered-product-folder-mapping");
    const report = buildRecoveredProductMapping(
      inventoryWith(["=HYPERLINK(\"https://example.invalid\")"]),
      [],
    );
    const csv = recoveredProductMappingCsv(report);
    expect(csv).toContain("\"NOT_REVIEWED\"");
    expect(csv).toContain("\"approved_product_id\"");
    expect(csv).toContain("\"approved_product_slug\"");
    expect(csv).toContain("\"primary_image_filename\"");
    expect(csv).toContain("\"owner_note\"");
    expect(csv).toContain("\"'=HYPERLINK");
    expect(report.mappings[0].manualReviewRequired).toBe(true);
    expect(report.mappings[0].status).toBe("unmatched");
  });

});
