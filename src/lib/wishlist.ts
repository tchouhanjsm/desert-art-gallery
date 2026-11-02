export function normalizeWishlistSlugs(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const result: string[] = [];
  for (const entry of input) {
    if (typeof entry !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry)) continue;
    if (!result.includes(entry)) result.push(entry);
    if (result.length >= 100) break;
  }
  return result;
}

export function toggleWishlistSlug(slugs: string[], slug: string): string[] {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return slugs;
  return slugs.includes(slug) ? slugs.filter((item) => item !== slug) : normalizeWishlistSlugs([...slugs, slug]);
}
