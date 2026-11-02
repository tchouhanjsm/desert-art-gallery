import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const importer = readFileSync(
  new URL("../../../scripts/import-editorial-to-mysql.ts", import.meta.url),
  "utf8",
);

describe("legacy editorial import safety contract", () => {
  it("defaults to dry-run and requires an explicit commit flag", () => {
    expect(importer).toContain("const commitMode = process.argv.includes(\"--commit\")");
    expect(importer).toContain("if (!commitMode)");
    expect(importer).toContain("No MySQL records or media files were written");
  });

  it("requires the one-time migration target to be empty and refuses a second import", () => {
    expect(importer).toContain("__legacy_supabase_editorial_import_v1");
    expect(importer).toContain("This legacy editorial import has already completed");
    expect(importer).toContain("The MySQL editorial tables are not empty");
  });

  it("copies only editorial records and product slugs needed for collection curation", () => {
    for (const table of ["site_content", "collections", "artisan_profiles", "journal_posts", "collection_products"]) {
      expect(importer).toContain('from("' + table + '")');
    }
    expect(importer).toContain('from("products").select("id,slug")');
    expect(importer).toContain("tx.insert(collectionProductLinks)");
    expect(importer).not.toContain("tx.insert(products)");
    expect(importer).not.toContain("tx.insert(orders)");
    expect(importer).not.toContain("tx.insert(customers)");
  });

  it("validates media paths, image signatures and size before writing files", () => {
    expect(importer).toContain("safeStorageKey");
    expect(importer).toContain("maxImageBytes");
    expect(importer).toContain("hasSupportedImageSignature");
    expect(importer).toContain("storeEditorialMedia");
  });

  it("revokes approval when legacy image metadata lacks required evidence or alt text", () => {
    expect(importer).toContain("revokeInvalidHomepageImageRights");
    expect(importer).toContain("const confirmed = Boolean(row.hero_image_rights_confirmed)");
    expect(importer).toContain("Boolean(row.portrait_alt_text?.trim())");
    expect(importer).toContain("Boolean(row.cover_image_alt?.trim())");
  });
});
