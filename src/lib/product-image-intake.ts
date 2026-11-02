export const MAX_PRODUCT_IMAGE_BYTES = 12 * 1024 * 1024;

export type ProductImageRole = "primary" | "detail" | "back" | "label" | "texture" | "packaging";

export type ParsedProductImageName = {
  sequence: number;
  role: ProductImageRole;
  extension: "jpg" | "jpeg" | "png" | "webp" | "avif";
};

const allowedRoles = new Set<ProductImageRole>([
  "primary", "detail", "back", "label", "texture", "packaging",
]);

export function parseProductImageName(filename: string): ParsedProductImageName | null {
  const match = filename.match(/^(\d{2})-(primary|detail|back|label|texture|packaging)\.(jpg|jpeg|png|webp|avif)$/i);
  if (!match) return null;

  const sequence = Number(match[1]);
  const role = match[2].toLowerCase() as ProductImageRole;
  const extension = match[3].toLowerCase() as ParsedProductImageName["extension"];

  if (sequence < 1 || sequence > 99 || !allowedRoles.has(role)) return null;
  if (role === "primary" && sequence !== 1) return null;

  return { sequence, role, extension };
}

export function detectProductImageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= pngSignature.length && pngSignature.every((byte, index) => bytes[index] === byte)) {
    return "image/png";
  }

  if (bytes.length >= 12
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return "image/webp";
  }

  if (bytes.length >= 12
    && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brands = String.fromCharCode(...bytes.slice(8, 16));
    if (brands.includes("avif") || brands.includes("avis")) return "image/avif";
  }

  return null;
}

export function validateProductImageBytes(
  filename: string,
  bytes: Uint8Array,
): { valid: true; mimeType: string } | { valid: false; reason: string } {
  const parsed = parseProductImageName(filename);
  if (!parsed) return { valid: false, reason: "Filename must use NN-role.jpg/png/webp/avif with a supported role." };
  if (bytes.length === 0) return { valid: false, reason: "Image file is empty." };
  if (bytes.length > MAX_PRODUCT_IMAGE_BYTES) return { valid: false, reason: "Image exceeds the 12 MB upload limit." };

  const mimeType = detectProductImageMime(bytes);
  if (!mimeType) return { valid: false, reason: "File signature is not a supported JPEG, PNG, WebP or AVIF image." };

  const extensionMime: Record<ParsedProductImageName["extension"], string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    avif: "image/avif",
  };
  if (extensionMime[parsed.extension] !== mimeType) {
    return { valid: false, reason: "File extension does not match the detected image format." };
  }

  return { valid: true, mimeType };
}
