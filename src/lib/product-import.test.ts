import { describe, expect, it } from "vitest";
import { PRODUCT_IMPORT_HEADERS, parseProductCsv } from "./product-import";

function row(values: Record<string, string>) {
  return PRODUCT_IMPORT_HEADERS.map((header) => {
    const value = values[header] ?? "";
    return '"' + value.replace(/"/g, '""') + '"';
  }).join(",");
}

const valid = {
  slug: "textile-jacket",
  title: "Textile Jacket",
  short_description: "A verified short note",
  description: "A longer description, with a comma.",
  category_slug: "",
  price: "125.50",
  currency: "USD",
  compare_at_price: "",
  sku: "DAG-001",
  quantity_on_hand: "3",
  materials: "cotton|silk",
  sizes: "S|M",
  measurements: '{"length":"merchant measurement"}',
  condition_notes: "",
  provenance: "",
  craft_story: "",
};

function csv(...rows: Record<string, string>[]) {
  return PRODUCT_IMPORT_HEADERS.join(",") + "\r\n" + rows.map(row).join("\r\n");
}

describe("product catalogue CSV parser", () => {
  it("parses quoted commas, escaped quotes and pipe-delimited attributes", () => {
    const result = parseProductCsv(csv({ ...valid, description: 'A "carefully" described piece, with detail.' }));
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].description).toBe('A "carefully" described piece, with detail.');
    expect(result.rows[0].materials).toEqual(["cotton", "silk"]);
    expect(result.rows[0].price_minor).toBe(12550);
    expect(result.rows[0].quantity_on_hand).toBe(3);
  });

  it("supports newlines inside quoted descriptions", () => {
    const result = parseProductCsv(csv({ ...valid, description: "First paragraph\nSecond paragraph" }));
    expect(result.rows[0].description).toBe("First paragraph\nSecond paragraph");
    expect(result.rows[0].errors).toEqual([]);
  });

  it("rejects malformed quotes and columns that do not match the template", () => {
    const malformed = PRODUCT_IMPORT_HEADERS.join(",") + '\n"unfinished';
    expect(parseProductCsv(malformed).errors[0]).toContain("unterminated");
    expect(parseProductCsv(PRODUCT_IMPORT_HEADERS.join(",") + '\n"only-one-cell"').errors[0]).toContain("cells");
  });

  it("rejects unknown, missing and duplicate headers", () => {
    const result = parseProductCsv("slug,slug,title,extra\nx,x,Title,y");
    expect(result.errors.join(" ")).toContain("Duplicate");
    expect(result.errors.join(" ")).toContain("Unknown");
    expect(result.errors.join(" ")).toContain("Missing");
  });

  it("uses currency-specific minor units for zero- and three-decimal currencies", () => {
    const jpy = parseProductCsv(csv({ ...valid, currency: "JPY", price: "1299" }));
    const kwd = parseProductCsv(csv({ ...valid, currency: "KWD", price: "1.299" }));
    expect(jpy.rows[0].price_minor).toBe(1299);
    expect(kwd.rows[0].price_minor).toBe(1299);
    expect(jpy.rows[0].errors).toEqual([]);
    expect(kwd.rows[0].errors).toEqual([]);
  });

  it("rejects exponent notation, excessive precision and invalid currency codes", () => {
    const exponent = parseProductCsv(csv({ ...valid, price: "1e3" }));
    const precision = parseProductCsv(csv({ ...valid, price: "12.999" }));
    const currency = parseProductCsv(csv({ ...valid, currency: "NOPE" }));
    expect(exponent.rows[0].errors.join(" ")).toContain("decimal");
    expect(precision.rows[0].errors.join(" ")).toContain("fractional");
    expect(currency.rows[0].errors.join(" ")).toContain("Currency");
  });

  it("rejects invalid quantities, compare-at prices and non-object measurements", () => {
    const result = parseProductCsv(csv({
      ...valid,
      quantity_on_hand: "-1",
      compare_at_price: "100.00",
      measurements: "[]",
    }));
    expect(result.rows[0].errors.join(" ")).toContain("Stock quantity");
    expect(result.rows[0].errors.join(" ")).toContain("Compare-at");
    expect(result.rows[0].errors.join(" ")).toContain("JSON object");
  });

  it("detects duplicate slugs and SKUs within one batch", () => {
    const result = parseProductCsv(csv(
      valid,
      { ...valid, slug: "textile-jacket-two", title: "Another Textile Jacket" },
    ));
    expect(result.rows[0].errors.join(" ")).toContain("Duplicate SKU");
    expect(result.rows[1].errors.join(" ")).toContain("Duplicate SKU");
    const duplicateSlug = parseProductCsv(csv(valid, { ...valid, sku: "DAG-002" }));
    expect(duplicateSlug.rows.every((item) => item.errors.some((error) => error.includes("Duplicate slug")))).toBe(true);
  });

  it("rejects amounts beyond the safe integer range", () => {
    const result = parseProductCsv(csv({ ...valid, price: "9007199254740992" }));
    expect(result.rows[0].errors.join(" ")).toContain("safe supported range");
  });

  it("derives a URL slug from the title when the slug cell is empty", () => {
    const result = parseProductCsv(csv({ ...valid, slug: "", title: "Hand-worked Textile Jacket" }));
    expect(result.rows[0].slug).toBe("hand-worked-textile-jacket");
  });

  it("ignores blank lines but limits each import to 500 product rows", () => {
    const one = parseProductCsv(csv(valid) + "\r\n\r\n");
    expect(one.rows).toHaveLength(1);
    const large = PRODUCT_IMPORT_HEADERS.join(",") + "\n" + Array.from({ length: 501 }, () => row(valid)).join("\n");
    expect(parseProductCsv(large).errors[0]).toContain("500");
  });
});
