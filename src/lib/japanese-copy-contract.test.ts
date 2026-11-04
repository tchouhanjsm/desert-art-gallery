import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("Japanese-first public interface copy", () => {
  it("does not reintroduce former English homepage and shop labels", () => {
    const home = source("../app/page.tsx");
    const shop = source("../app/shop/page.tsx");
    expect(home).toContain("厳選コレクション");
    expect(home).toContain("オンラインカタログ");
    expect(home).not.toContain("CURATED COLLECTIONS");
    expect(home).not.toContain("THE ONLINE CATALOGUE");
    expect(home).not.toContain("ONLINE STORE · CATALOGUE IN PREPARATION");
    expect(shop).toContain("オンラインストア");
    expect(shop).not.toContain("DESERT ART GALLERY · ONLINE STORE");
  });

  it("keeps maker, journal and story interface text in Japanese", () => {
    const artisans = source("../app/artisans/page.tsx");
    const journal = source("../app/journal/page.tsx");
    const story = source("../app/story/page.tsx");
    expect(artisans).toContain("つくり手の物語");
    expect(artisans).not.toContain("Maker stories");
    expect(journal).toContain("読みものとストーリー");
    expect(journal).not.toContain("Journal & stories");
    expect(journal).not.toContain("Perspectives on textiles");
    expect(story).toContain("素材 · 記憶 · 手仕事");
    expect(story).not.toContain("MATERIAL · MEMORY · MAKING");
  });

  it("explains unpaid order drafts in Japanese and does not imply payment collection", () => {
    const order = source("../app/account/orders/[id]/page.tsx");
    expect(order).toContain("お支払い前の注文案です");
    expect(order).toContain("お支払いの請求・受領は行われていません");
    expect(order).not.toContain("This is an unpaid order draft");
  });
});
