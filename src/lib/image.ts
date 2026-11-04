/** Small, locally generated placeholder used while gallery photography loads. */
export const galleryBlurDataUrl =
  "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 12 12%22%3E%3Crect width=%2212%22 height=%2212%22 fill=%22%23e8dfd2%22/%3E%3C/svg%3E";

/** True for HTTP(S) URLs; remote hosts must still be explicitly allowed in next.config.ts. */
export function isRemoteImage(src: string): boolean {
  return /^https?:\/\//i.test(src);
}
