import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type EditorialTarget = "homepage" | "collection" | "artisan" | "journal";
export type EditorialImageMime = "image/jpeg" | "image/png" | "image/webp" | "image/avif";

const extensions: Record<EditorialImageMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};
const mimeTypes: Record<string, EditorialImageMime> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

export function getMediaStorageRoot(): string {
  const configured = process.env.MEDIA_STORAGE_ROOT?.trim();
  if (configured) {
    if (!path.isAbsolute(configured)) throw new Error("MEDIA_STORAGE_ROOT must be an absolute filesystem path.");
    return path.resolve(configured);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("MEDIA_STORAGE_ROOT must point to persistent storage in production.");
  }
  return path.resolve(process.cwd(), ".local-data", "media");
}

export function safeStorageKey(key: string): string {
  if (!key || key.length > 512 || key.includes("\\") || key.includes("\0") || key.startsWith("/")) {
    throw new Error("Media storage key is invalid.");
  }
  const segments = key.split("/");
  if (segments.length < 4 || segments.some((segment) => !segment || segment === "." || segment === ".." || !/^[a-zA-Z0-9._-]+$/.test(segment))) {
    throw new Error("Media storage key is invalid.");
  }
  if (segments[0] !== "editorial" || !["homepage", "collection", "artisan", "journal"].includes(segments[1])) {
    throw new Error("Media storage key is outside the editorial media namespace.");
  }
  return segments.join("/");
}

export function createEditorialStorageKey(target: EditorialTarget, recordId: string, mimeType: EditorialImageMime): string {
  if (!/^[0-9a-f-]{36}$/i.test(recordId)) throw new Error("Editorial record identifier is invalid.");
  return safeStorageKey("editorial/" + target + "/" + recordId + "/" + randomUUID() + "." + extensions[mimeType]);
}

export function getEditorialMediaUrl(key: string): string {
  return "/media/" + safeStorageKey(key).split("/").map(encodeURIComponent).join("/");
}

export function getAdminEditorialMediaUrl(key: string): string {
  return "/api/admin/media/" + safeStorageKey(key).split("/").map(encodeURIComponent).join("/");
}

function absoluteMediaPath(key: string): string {
  const root = getMediaStorageRoot();
  const fullPath = path.resolve(root, ...safeStorageKey(key).split("/"));
  if (fullPath !== root && !fullPath.startsWith(root + path.sep)) {
    throw new Error("Media path escapes the configured storage root.");
  }
  return fullPath;
}

export async function storeEditorialMedia(key: string, bytes: Uint8Array): Promise<void> {
  const destination = absoluteMediaPath(key);
  const directory = path.dirname(destination);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = destination + "." + randomUUID() + ".tmp";
  try {
    await writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function readEditorialMedia(key: string): Promise<{ bytes: Buffer; mimeType: EditorialImageMime } | null> {
  const safeKey = safeStorageKey(key);
  const extension = safeKey.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = mimeTypes[extension];
  if (!mimeType) return null;
  try {
    const bytes = await readFile(absoluteMediaPath(safeKey));
    return { bytes, mimeType };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function removeEditorialMedia(key: string): Promise<void> {
  await rm(absoluteMediaPath(key), { force: true });
}
