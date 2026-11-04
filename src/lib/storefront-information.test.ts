import { describe, expect, it } from "vitest";
import { getStorefrontInformationPage, storefrontInformationPages } from "./storefront-information";

describe("Japanese customer information pages", () => {
  it("provides a Japanese title, introduction and draft/status note for every information route", () => {
    expect(Object.keys(storefrontInformationPages).sort()).toEqual([
      "faq",
      "privacy",
      "returns",
      "shipping",
      "terms",
      "tracking",
    ]);

    for (const page of Object.values(storefrontInformationPages)) {
      expect(page.title).toMatch(/[ぁ-んァ-ヶ一-龯]/);
      expect(page.intro).toMatch(/[ぁ-んァ-ヶ一-龯]/);
      expect(page.body.length).toBeGreaterThan(0);
      expect(page.draftNotice).toMatch(/[ぁ-んァ-ヶ一-龯]/);
    }
  });

  it("keeps legal notices explicitly provisional until merchant review", () => {
    for (const slug of ["privacy", "terms", "returns", "shipping"] as const) {
      expect(getStorefrontInformationPage(slug)?.draftNotice).toBeTruthy();
    }
    expect(getStorefrontInformationPage("privacy")?.draftNotice).toContain("正式なプライバシーポリシーではありません");
    expect(getStorefrontInformationPage("terms")?.draftNotice).toContain("正式な利用規約ではありません");
  });

  it("does not claim live carrier tracking integration", () => {
    expect(getStorefrontInformationPage("tracking")?.body.join(" ")).toContain("追跡システムと連携していません");
  });

  it("returns null for unknown slugs instead of inventing a page", () => {
    expect(getStorefrontInformationPage("legal-operator-details")).toBeNull();
  });
});
