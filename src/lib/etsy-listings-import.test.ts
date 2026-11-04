import { describe, expect, it } from "vitest";
import { isAllowedEtsyImageUrl, isEtsyListingsCsv, parseEtsyListingsCsv } from "./etsy-listings-import";

const headers = [
  "TITLE", "DESCRIPTION", "PRICE", "CURRENCY_CODE", "QUANTITY",
  "TAGS", "MATERIALS", "IMAGE1", "IMAGE2", "SKU",
  "VARIATION 1 TYPE", "VARIATION 1 NAME", "VARIATION 1 VALUES",
];

function cell(value: string) {
  return '"' + value.replace(/"/g, '""') + '"';
}

function csv(rows: string[][]) {
  return [headers.join(","), ...rows.map((row) => row.map(cell).join(","))].join("\r\n");
}

describe("native Etsy listing export parser", () => {
  it("detects Etsy format and parses currency, quoted commas and multiline descriptions", () => {
    const source = csv([[
      "Handmade Tribal Jacket",
      "First paragraph, with a comma.\n\nSecond paragraph with \"quoted\" detail.",
      "980.00", "USD", "1", "tribal jacket,mirror work,handmade",
      "Wool,Cotton,Mirror", "https://i.etsystatic.com/22307146/photo.jpg",
      "", "A74", "", "", "",
    ]]);
    expect(isEtsyListingsCsv(source)).toBe(true);
    const result = parseEtsyListingsCsv(source);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].price_minor).toBe(98000);
    expect(result.rows[0].quantity_on_hand).toBe(1);
    expect(result.rows[0].materials).toEqual(["Wool", "Cotton", "Mirror"]);
    expect(result.rows[0].tags).toEqual(["tribal jacket", "mirror work", "handmade"]);
    expect(result.rows[0].description).toContain("Second paragraph");
    expect(result.rows[0].sourceImageUrls).toHaveLength(1);
    expect(result.rows[0].sku).toBe("A74");
  });

  it("keeps repeated-title listings separate and does not assign a duplicated SKU", () => {
    const result = parseEtsyListingsCsv(csv([
      ["One Of A Kind Jacket", "First piece", "980", "USD", "1", "jacket", "Wool", "https://i.etsystatic.com/one.jpg", "", "A51", "", "", ""],
      ["One Of A Kind Jacket", "Second piece", "880", "USD", "1", "jacket", "Cotton", "https://i.etsystatic.com/two.jpg", "", "A51", "", "", ""],
    ]));
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].slug).not.toBe(result.rows[1].slug);
    expect(result.rows.every((row) => row.sku === null)).toBe(true);
    expect(result.rows.every((row) => row.sourceSku === "A51")).toBe(true);
    expect(result.rows.every((row) => row.sourceMetadata.sourceSkuDuplicate === true)).toBe(true);
    expect(result.rows.every((row) => row.warnings.some((warning) => warning.includes("multiple listings")))).toBe(true);
  });

  it("preserves a source SKU that cannot be assigned to the normalized unique SKU field", () => {
    const result = parseEtsyListingsCsv(csv([[
      "Handmade Textile", "Description", "149.00", "USD", "1",
      "textile", "Cotton", "https://i.etsystatic.com/photo.jpg", "", "jacket 28", "", "", "",
    ]]));
    expect(result.errors).toEqual([]);
    expect(result.rows[0].sku).toBeNull();
    expect(result.rows[0].sourceSku).toBe("jacket 28");
    expect(result.rows[0].warnings.join(" ")).toContain("unsupported by the unique catalogue SKU field");
  });

  it("does not stage image URLs from arbitrary hosts", () => {
    const result = parseEtsyListingsCsv(csv([[
      "Handmade Textile", "Description", "149.00", "USD", "1",
      "textile", "Cotton", "https://images.example.test/not-etsy.jpg", "", "SKU-1", "", "", "",
    ]]));
    expect(result.errors).toEqual([]);
    expect(result.rows[0].sourceImageUrls).toEqual([]);
    expect(result.rows[0].warnings.join(" ")).toContain("not an approved Etsy static-image URL");
    expect(isAllowedEtsyImageUrl("http://i.etsystatic.com/photo.jpg")).toBe(false);
    expect(isAllowedEtsyImageUrl("https://i.etsystatic.com.evil.test/photo.jpg")).toBe(false);
  });

  it("preserves Etsy variation metadata without inventing stock-bearing variants", () => {
    const result = parseEtsyListingsCsv(csv([[
      "Handmade Textile", "Description", "149.00", "USD", "1",
      "textile", "Cotton", "https://i.etsystatic.com/photo.jpg", "", "SKU-1",
      "Size", "Size", "S, M, L",
    ]]));
    expect(result.rows[0].sourceMetadata.variations).toEqual([
      { type: "Size", name: "Size", values: "S, M, L" },
    ]);
    expect(result.rows[0].warnings.join(" ")).toContain("purchasable variants");
    expect(result.rows[0].quantity_on_hand).toBe(1);
  });

  it("accepts the supplied 527-listing export size while retaining the 1,000-row ceiling", () => {
    const rows = Array.from({ length: 527 }, (_, index) => {
      const number = index + 1;
      return [
        "Recovered textile listing " + number,
        "Verified listing description " + number,
        "10.00",
        "USD",
        "1",
        "heritage textile",
        "Cotton",
        "https://i.etsystatic.com/22307146/" + number + ".jpg",
        "",
        "SKU-" + number,
        "",
        "",
        "",
      ];
    });
    const source = csv(rows);
    expect(isEtsyListingsCsv(source)).toBe(true);
    const result = parseEtsyListingsCsv(source);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(527);
    expect(result.rows.every((row) => row.errors.length === 0)).toBe(true);
    expect(new Set(result.rows.map((row) => row.slug)).size).toBe(527);
  });
});
