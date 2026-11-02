import { describe, expect, it } from "vitest";
import { buildProductEnquiryHref, parseProductEnquirySlug } from "./product-enquiry";

describe("product enquiry context", () => {
  it("accepts only a bounded lowercase product slug", () => {
    expect(parseProductEnquirySlug("antique-rajasthani-jacket")).toBe("antique-rajasthani-jacket");
    expect(parseProductEnquirySlug("  Antique-Rajasthani-Jacket  ")).toBe("antique-rajasthani-jacket");
    expect(parseProductEnquirySlug("")).toBeNull();
    expect(parseProductEnquirySlug("../admin")).toBeNull();
    expect(parseProductEnquirySlug("product?next=/admin")).toBeNull();
    expect(parseProductEnquirySlug("a".repeat(181))).toBeNull();
    expect(parseProductEnquirySlug(["one", "two"])).toBeNull();
  });

  it("builds a same-site enquiry link with the product context retained", () => {
    expect(buildProductEnquiryHref("antique-rajasthani-jacket"))
      .toBe("/contact?product=antique-rajasthani-jacket#product-enquiry");
  });

  it("refuses an invalid slug instead of building an unsafe link", () => {
    expect(() => buildProductEnquiryHref("../admin")).toThrow(
      "A valid product slug is required for a contextual enquiry.",
    );
  });
});
