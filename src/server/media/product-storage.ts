import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getMediaStorageRoot } from "./storage";
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

export function getProductMediaUrl(key: string): string {
  return "/product-media/" + safeProductStorageKey(key).split("/").map(encodeURIComponent).join("/");
}

function absoluteProductMediaPath(key: string): string {
  const root = getMediaStorageRoot();
  const fullPath = path.resolve(root, ...safeProductStorageKey(key).split("/"));
  if (fullPath !== root && !fullPath.startsWith(root + path.sep)) {
    throw new Error("Product media path escapes the configured storage root.");
  }
  return fullPath;
}

export async function storeProductMedia(key: string, bytes: Uint8Array): Promise<void> {
  const destination = absoluteProductMediaPath(key);
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  const temporary = destination + "." + randomUUID() + ".tmp";
  try {
    await writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function readProductMedia(key: string): Promise<{ bytes: Buffer; mimeType: EditorialImageMime } | null> {
  const safeKey = safeProductStorageKey(key);
  const extension = safeKey.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = mimeByExtension[extension];
  if (!mimeType) return null;
  try {
    return { bytes: await readFile(absoluteProductMediaPath(safeKey)), mimeType };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function removeProductMedia(key: string): Promise<void> {
  await rm(absoluteProductMediaPath(key), { force: true });
}
