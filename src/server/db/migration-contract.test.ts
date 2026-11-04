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
const customerMigration = readFileSync(
  new URL("../../../drizzle/0003_mysql_customer_identity.sql", import.meta.url),
  "utf8",
);
const orderMigration = readFileSync(new URL("../../../drizzle/0004_mysql_order_checkout.sql", import.meta.url), "utf8");
const mysqlSchema = readFileSync(new URL("./schema.ts", import.meta.url), "utf8");
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
      "0003_mysql_customer_identity",
      "0004_mysql_order_checkout",
    ]);
  });

  it("adds isolated customer identity, session, address and saved-shopping tables", () => {
    for (const table of ["customer_users", "customer_sessions", "customer_addresses", "customer_cart_items", "customer_wishlist_items"]) {
      expect(customerMigration).toContain("CREATE TABLE IF NOT EXISTS " + table);
    }
    expect(customerMigration).toContain("customer_sessions_token_hash_uq");
    expect(customerMigration).toContain("customer_cart_items_line_uq");
    expect(customerMigration).toContain("customer_wishlist_items_product_uq");
    expect(customerMigration).toContain("REFERENCES customer_users(id) ON DELETE CASCADE");
  });

  it("adds destination configuration, immutable order snapshots and event history", () => {
    for (const table of ["shipping_zones", "shipping_rates", "checkout_tax_rules", "orders", "order_items", "order_events"]) {
      expect(orderMigration).toContain("CREATE TABLE IF NOT EXISTS " + table);
    }
    for (const snapshot of ["product_id_snapshot", "product_title_snapshot", "variant_label_snapshot", "unit_price_minor_snapshot", "currency_snapshot"]) {
      expect(orderMigration).toContain(snapshot);
    }
    expect(orderMigration).toContain("checkout_idempotency_key");
    expect(orderMigration).toContain("orders_amounts_check");
    expect(orderMigration).not.toContain("CREATE TABLE IF NOT EXISTS payments");
  });

  it("adds Etsy source metadata and expands safe import batch capacity", () => {
    expect(etsyMigration).toContain("ADD COLUMN tags JSON");
    expect(etsyMigration).toContain("ADD COLUMN source_metadata JSON");
    expect(etsyMigration).toContain("row_count BETWEEN 1 AND 1000");
    expect(etsyMigration).toContain("products_created BETWEEN 1 AND 1000");
  });

  it("keeps the Drizzle catalogue import batch checks aligned with the applied 1,000-row Etsy migration", () => {
    expect(mysqlSchema).toContain("${table.rowCount} BETWEEN 1 AND 1000");
    expect(mysqlSchema).toContain("${table.productsCreated} BETWEEN 1 AND 1000");
    expect(mysqlSchema).not.toContain("${table.rowCount} BETWEEN 1 AND 500");
    expect(mysqlSchema).not.toContain("${table.productsCreated} BETWEEN 1 AND 500");
  });
});
