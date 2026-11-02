import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/202611020006_owner_cms_media.sql", import.meta.url),
  "utf8",
);

describe("owner CMS media migration contract", () => {
  it("adds descriptive alternative text and rights evidence to editorial image records", () => {
    expect(migration).toContain("add column if not exists hero_image_alt");
    expect(migration).toContain("add column if not exists hero_image_rights_evidence");
    expect(migration).toContain("add column if not exists portrait_alt_text");
    expect(migration).toContain("add column if not exists cover_image_alt");
  });

  it("requires rights evidence when a collection hero image is approved", () => {
    expect(migration).toContain("collection_hero_rights_evidence_required");
    expect(migration).toContain("not hero_image_rights_confirmed or length(btrim(hero_image_rights_evidence)) > 0");
  });

  it("exposes homepage hero media only when its content and image rights are published", () => {
    expect(migration).toContain("site_content_hero_media_public_read");
    expect(migration).toContain("content.is_published = true");
    expect(migration).toContain("hero_image_rights_confirmed' = 'true'");
    expect(migration).toContain("hero_image_rights_evidence");
  });
});
