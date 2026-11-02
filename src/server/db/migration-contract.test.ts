import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../drizzle/0000_mysql_editorial_cms.sql", import.meta.url),
  "utf8",
);
const etsyMigration = readFileSync(
  new URL("../../../drizzle/0002_etsy_listing_source.sql", import.meta.url),
  "utf8",
);
const journal = readFileSync(
  new URL("../../../drizzle/meta/_journal.json", import.meta.url),
  "utf8",
);

describe("MySQL editorial CMS migration contract", () => {
  it("contains the owner-managed editorial tables and collection membership ledger", () => {
    for (const table of ["site_content", "collections", "collection_product_links", "artisan_profiles", "journal_posts"]) {
      expect(migration).toContain("CREATE TABLE IF NOT EXISTS " + table);
    }
    expect(migration).toContain("site_content_key_uq");
    expect(migration).toContain("collections_slug_uq");
    expect(migration).toContain("journal_posts_slug_uq");
    expect(migration).toContain("collection_product_links_pair_uq");
    expect(migration).toContain("collection_product_links_collection_fk");
  });

  it("does not allow publishing rights-confirmed images without evidence and alt text", () => {
    expect(migration).toContain("collections_hero_rights_evidence_check");
    expect(migration).toContain("artisan_portrait_rights_evidence_check");
    expect(migration).toContain("journal_cover_rights_evidence_check");
    expect(migration).toContain("hero_image_alt");
    expect(migration).toContain("portrait_alt_text");
    expect(migration).toContain("cover_image_alt");
  });

  it("defines a Drizzle MySQL migration journal entry", () => {
    const parsed = JSON.parse(journal) as { dialect?: string; entries?: { tag: string }[] };
    expect(parsed.dialect).toBe("mysql");
    expect(parsed.entries?.map((entry) => entry.tag)).toEqual([
      "0000_mysql_editorial_cms",
      "0001_mysql_catalogue_inventory",
      "0002_etsy_listing_source",
    ]);
  });

  it("adds Etsy source metadata and expands safe import batch capacity", () => {
    expect(etsyMigration).toContain("ADD COLUMN tags JSON");
    expect(etsyMigration).toContain("ADD COLUMN source_metadata JSON");
    expect(etsyMigration).toContain("row_count BETWEEN 1 AND 1000");
    expect(etsyMigration).toContain("products_created BETWEEN 1 AND 1000");
  });
});
