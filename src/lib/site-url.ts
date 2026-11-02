const LOCAL_SITE_URL = "http://localhost:3000";

export function getSiteUrl(): URL {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const siteUrl = new URL(configuredUrl || LOCAL_SITE_URL);
  const isLocalHttp =
    siteUrl.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(siteUrl.hostname);

  if (siteUrl.protocol !== "https:" && !isLocalHttp) {
    throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS outside local development.");
  }

  if (
    siteUrl.username ||
    siteUrl.password ||
    siteUrl.pathname !== "/" ||
    siteUrl.search ||
    siteUrl.hash
  ) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an origin without credentials, path, query or hash.");
  }

  return new URL(siteUrl.origin);
}
