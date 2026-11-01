import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/202611020001_commerce_foundation.sql", import.meta.url),
  "utf8",
);

describe("commerce migration safety contract", () => {
  it("does not declare duplicate named constraints within a table", () => {
    const tables = [...migration.matchAll(/create table if not exists public\.([a-z_]+)\s*\(([\s\S]*?)^\);/gim)];
    expect(tables.length).toBeGreaterThan(10);

    for (const [, tableName, definition] of tables) {
      const names = [...definition.matchAll(/^[ \t]*constraint\s+([a-z_][a-z0-9_]*)\s+/gim)].map((match) => match[1]);
      expect(new Set(names).size, `duplicate named constraint in public.${tableName}`).toBe(names.length);
    }
  });

  it("audits sensitive operational tables using changed field names only", () => {
    expect(migration).toContain("jsonb_build_object('changed_fields', v_changed_fields)");
    for (const table of [
      "profiles", "products", "product_images", "inventory_movements", "addresses",
      "orders", "order_items", "site_content", "customer_reviews", "artisan_profiles",
      "journal_posts", "newsletter_subscribers", "payment_webhook_events",
    ]) {
      expect(migration).toContain(`create trigger audit_${table} after insert or update or delete on public.${table}`);
    }
  });
});
