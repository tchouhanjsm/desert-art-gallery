import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { getMediaStorageRoot } from "./storage";
import {
  getMediaStorageDriver,
  readPrivateMediaObject,
  removePrivateMediaObject,
  storePrivateMediaObject,
} from "./object-storage";
import type { EditorialImageMime } from "./storage";

const extensionByMime: Record<EditorialImageMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

const mimeByExtension: Record<string, EditorialImageMime> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function safeProductStorageKey(key: string): string {
  if (!key || key.length > 512 || key.includes("\\") || key.includes("\0") || key.startsWith("/")) {
    throw new Error("Product media storage key is invalid.");
  }
  const parts = key.split("/");
  if (
    parts.length !== 3
    || parts[0] !== "products"
    || !UUID.test(parts[1])
    || !/^[0-9a-f-]{36}\.(jpg|jpeg|png|webp|avif)$/i.test(parts[2])
  ) {
    throw new Error("Product media storage key is invalid.");
  }
  return parts.join("/");
}

export function createProductStorageKey(productId: string, mimeType: EditorialImageMime): string {
  if (!UUID.test(productId)) throw new Error("Product identifier is invalid.");
  return safeProductStorageKey("products/" + productId + "/" + randomUUID() + "." + extensionByMime[mimeType]);
}

export function createDeterministicProductStorageKey(
  productId: string,
  contentSha256: string,
  mimeType: EditorialImageMime,
): string {
  if (!UUID.test(productId)) throw new Error("Product identifier is invalid.");
  if (!/^[0-9a-f]{64}$/i.test(contentSha256)) throw new Error("Image SHA-256 digest is invalid.");
  const digest = createHash("sha256")
    .update(productId)
    .update(":")
    .update(contentSha256.toLowerCase())
    .digest("hex")
    .slice(0, 32)
    .split("");
  digest[12] = "5";
  digest[16] = (parseInt(digest[16], 16) & 0x3 | 0x8).toString(16);
  const compact = digest.join("");
  const imageId = compact.slice(0, 8) + "-" + compact.slice(8, 12) + "-"
    + compact.slice(12, 16) + "-" + compact.slice(16, 20) + "-" + compact.slice(20);
  return safeProductStorageKey("products/" + productId + "/" + imageId + "." + extensionByMime[mimeType]);
}

export function getProductMediaUrl(key: string): string {
  return "/product-media/" + safeProductStorageKey(key).split("/").map(encodeURIComponent).join("/");
}

export function getAdminProductMediaUrl(key: string): string {
  return "/api/admin/product-media/" + safeProductStorageKey(key).split("/").map(encodeURIComponent).join("/");
}

function absoluteProductMediaPath(key: string): string {
  const root = getMediaStorageRoot();
  const fullPath = path.resolve(root, ...safeProductStorageKey(key).split("/"));
  if (fullPath !== root && !fullPath.startsWith(root + path.sep)) {
    throw new Error("Product media path escapes the configured storage root.");
  }
  return fullPath;
}

function localPathForKey(key: string): string | undefined {
  return getMediaStorageDriver() === "local" ? absoluteProductMediaPath(key) : undefined;
}

export async function storeProductMedia(key: string, bytes: Uint8Array): Promise<void> {
  const safeKey = safeProductStorageKey(key);
  const extension = safeKey.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = mimeByExtension[extension];
  if (!mimeType) throw new Error("Product media file extension is unsupported.");
  await storePrivateMediaObject({
    key: safeKey,
    bytes,
    contentType: mimeType,
    localPath: localPathForKey(safeKey),
  });
}

export async function readProductMedia(key: string): Promise<{ bytes: Buffer; mimeType: EditorialImageMime } | null> {
  const safeKey = safeProductStorageKey(key);
  const extension = safeKey.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = mimeByExtension[extension];
  if (!mimeType) return null;
  return readPrivateMediaObject({
    key: safeKey,
    contentType: mimeType,
    localPath: localPathForKey(safeKey),
  });
}

export async function removeProductMedia(key: string): Promise<void> {
  const safeKey = safeProductStorageKey(key);
  await removePrivateMediaObject({
    key: safeKey,
    localPath: localPathForKey(safeKey),
  });
}
