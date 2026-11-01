import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const foundation = readFileSync(
  new URL("../../supabase/migrations/202611020001_commerce_foundation.sql", import.meta.url),
  "utf8",
);
const inventory = readFileSync(
  new URL("../../supabase/migrations/202611020002_catalogue_import_inventory.sql", import.meta.url),
  "utf8",
);
const productMedia = readFileSync(
  new URL("../../supabase/migrations/202611020003_product_detail_media.sql", import.meta.url),
  "utf8",
);

describe("commerce migration safety contract", () => {
  it("does not declare duplicate named constraints within a table", () => {
    const tables = [...foundation.matchAll(/create table if not exists public\.([a-z_]+)\s*\(([\s\S]*?)^\);/gim)];
    expect(tables.length).toBeGreaterThan(10);

    for (const [, tableName, definition] of tables) {
      const names = [...definition.matchAll(/^[ \t]*constraint\s+([a-z_][a-z0-9_]*)\s+/gim)].map((match) => match[1]);
      expect(new Set(names).size, "duplicate named constraint in public." + tableName).toBe(names.length);
    }
  });

  it("creates the payment webhook audit trigger only after its table exists", () => {
    const tableIndex = foundation.indexOf("create table if not exists public.payment_webhook_events");
    const triggerIndex = foundation.indexOf("create trigger audit_payment_webhook_events");
    expect(tableIndex).toBeGreaterThanOrEqual(0);
    expect(triggerIndex).toBeGreaterThan(tableIndex);
  });

  it("audits sensitive operational tables using changed field names only", () => {
    expect(foundation).toContain("jsonb_build_object('changed_fields', v_changed_fields)");
    for (const table of [
      "profiles", "products", "product_images", "inventory_movements", "addresses",
      "orders", "order_items", "site_content", "customer_reviews", "artisan_profiles",
      "journal_posts", "newsletter_subscribers", "payment_webhook_events",
    ]) {
      expect(foundation).toContain("create trigger audit_" + table + " after insert or update or delete on public." + table);
    }
  });

  it("prevents direct product stock edits outside the inventory ledger", () => {
    expect(inventory).toContain("create trigger guard_product_inventory_balance");
    expect(inventory).toContain("Stock must be changed through the inventory adjustment workflow");
    expect(inventory).toContain("insert into public.inventory_movements");
  });

  it("restricts CSV import to administrators and draft-only atomic inserts", () => {
    expect(inventory).toContain("create or replace function public.import_catalogue_drafts(p_rows jsonb)");
    expect(inventory).toContain("security definer");
    expect(inventory).toContain("not public.is_admin()");
    expect(inventory).toContain("'draft'");
    expect(inventory).toContain("'initial_import'");
    expect(inventory).toContain("revoke all on function public.import_catalogue_drafts(jsonb) from public");
    expect(inventory).toContain("grant execute on function public.import_catalogue_drafts(jsonb) to authenticated");
  });

  it("makes inventory adjustment and its movement record one database transaction", () => {
    expect(inventory).toContain("create or replace function public.adjust_product_inventory");
    expect(inventory).toContain("for update");
    expect(inventory).toContain("Inventory cannot become negative");
    expect(inventory).toContain("grant execute on function public.adjust_product_inventory");
  });

  it("keeps import history administrator-readable only", () => {
    expect(inventory).toContain("alter table public.catalogue_import_batches enable row level security");
    expect(inventory).toContain("using (public.is_admin())");
  });

  it("requires descriptive rights-confirmed media before product publication", () => {
    expect(productMedia).toContain("product_images_one_primary_per_product_idx");
    expect(productMedia).toContain("length(btrim(pi.alt_text)) > 0");
    expect(productMedia).toContain("length(btrim(pi.rights_evidence)) > 0");
  });

  it("changes a product primary image transactionally and only for administrators", () => {
    expect(productMedia).toContain("create or replace function public.set_product_primary_image");
    expect(productMedia).toContain("not public.is_admin()");
    expect(productMedia).toContain("for update");
    expect(productMedia).toContain("rights_confirmed = true");
    expect(productMedia).toContain("revoke all on function public.set_product_primary_image(uuid, uuid) from public");
    expect(productMedia).toContain("grant execute on function public.set_product_primary_image(uuid, uuid) to authenticated");
  });
});
