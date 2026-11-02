export function getSafeRedirectPath(candidate: string | null, origin: string, fallback = "/account"): string {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return fallback;
  }

  try {
    const base = new URL(origin);
    const target = new URL(candidate, base);
    if (target.origin !== base.origin) return fallback;
    return target.pathname + target.search + target.hash;
  } catch {
    return fallback;
  }
}
