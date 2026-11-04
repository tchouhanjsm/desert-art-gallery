/** Remote URLs (e.g. Etsy references) stay unoptimized until remotePatterns are configured;
 *  local and /media routes go through the Next image optimizer (AVIF/WebP, resizing). */
export function isRemoteImage(src: string): boolean {
  return /^https?:\/\//i.test(src);
}
