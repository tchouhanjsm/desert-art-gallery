export function parseProductEnquirySlug(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const slug = value.trim().toLowerCase();
  if (!slug || slug.length > 180 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return null;
  }
  return slug;
}

export function buildProductEnquiryHref(slug: string): string {
  const safeSlug = parseProductEnquirySlug(slug);
  if (!safeSlug) throw new Error("A valid product slug is required for a contextual enquiry.");

  return "/contact?product=" + encodeURIComponent(safeSlug) + "#product-enquiry";
}
