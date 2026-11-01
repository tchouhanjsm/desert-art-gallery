/**
 * Same-origin guard for cookie-authenticated mutation endpoints.
 * Browser writes must carry an exact Origin header; missing or cross-origin
 * origins are rejected before any authenticated database operation.
 */
export function isSameOriginRequest(request: Pick<Request, "url" | "headers">): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  let requestOrigin: string;
  let suppliedOrigin: URL;
  try {
    requestOrigin = new URL(request.url).origin;
    suppliedOrigin = new URL(origin);
  } catch {
    return false;
  }

  if (suppliedOrigin.origin !== origin || suppliedOrigin.origin !== requestOrigin) return false;

  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite && fetchSite !== "same-origin") return false;

  return true;
}
