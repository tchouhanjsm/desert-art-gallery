import { describe, expect, it } from "vitest";
import { getStorefrontInformationPage, storefrontInformationPages } from "./storefront-information";

describe("English customer information pages", () => {
  it("provides an English title, introduction and status note for every information route", () => {
    expect(Object.keys(storefrontInformationPages).sort()).toEqual([
      "faq",
      "privacy",
      "returns",
      "shipping",
      "terms",
      "tracking",
    ]);

    const japaneseText = /[\u3000-\u30ff\u3400-\u9fff]/;
    for (const page of Object.values(storefrontInformationPages)) {
      expect(page.title).not.toMatch(japaneseText);
      expect(page.intro).not.toMatch(japaneseText);
      expect(page.body.length).toBeGreaterThan(0);
      expect(page.draftNotice).toBeTruthy();
      expect(page.draftNotice).not.toMatch(japaneseText);
    }
  });

  it("keeps legal notices explicitly provisional until merchant review", () => {
    for (const slug of ["privacy", "terms", "returns", "shipping"] as const) {
      expect(getStorefrontInformationPage(slug)?.draftNotice).toBeTruthy();
    }
    expect(getStorefrontInformationPage("privacy")?.draftNotice).toContain("not an official privacy notice");
    expect(getStorefrontInformationPage("terms")?.draftNotice).toContain("not the official terms of use");
  });

  it("does not claim live carrier tracking integration", () => {
    expect(getStorefrontInformationPage("tracking")?.body.join(" ")).toContain(
      "not currently connected to a carrier tracking service",
    );
  });

  it("returns null for unknown slugs instead of inventing a page", () => {
    expect(getStorefrontInformationPage("legal-operator-details")).toBeNull();
  });
});
