import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getMediaStorageRoot,
  safeStorageKey,
  createEditorialStorageKey,
  getEditorialMediaUrl,
  readEditorialMedia,
  removeEditorialMedia,
  storeEditorialMedia,
} from "@/server/media/storage";

const originalRoot = process.env.MEDIA_STORAGE_ROOT;
const originalNodeEnv = process.env.NODE_ENV;
const temporaryRoots: string[] = [];
const setNodeEnv = (value: string | undefined) => {
  if (value === undefined) delete process.env.NODE_ENV;
  else Reflect.set(process.env, "NODE_ENV", value);
};

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  if (originalRoot === undefined) delete process.env.MEDIA_STORAGE_ROOT;
  else process.env.MEDIA_STORAGE_ROOT = originalRoot;
  setNodeEnv(originalNodeEnv);
});

describe("editorial media storage paths", () => {
  it("rejects traversal, absolute paths and paths outside the editorial namespace", () => {
    expect(() => safeStorageKey("../secret.txt")).toThrow();
    expect(() => safeStorageKey("/etc/passwd")).toThrow();
    expect(() => safeStorageKey("products/../private.jpg")).toThrow();
    expect(() => safeStorageKey("editorial/collection/../../secret.jpg")).toThrow();
  });

  it("creates UUID-based keys only under an allowed editorial record", () => {
    const key = createEditorialStorageKey("journal", "a8f9df07-6f01-4f8b-a74d-90d49db01852", "image/webp");
    expect(key).toMatch(/^editorial\/journal\/a8f9df07-6f01-4f8b-a74d-90d49db01852\/[0-9a-f-]+\.webp$/i);
    expect(getEditorialMediaUrl(key)).toBe("/media/" + key);
  });

  it("requires an absolute persistent media path in production", () => {
    setNodeEnv("production");
    delete process.env.MEDIA_STORAGE_ROOT;
    expect(() => getMediaStorageRoot()).toThrow("persistent storage");
    process.env.MEDIA_STORAGE_ROOT = "relative/media";
    expect(() => getMediaStorageRoot()).toThrow("absolute");
  });

  it("uses a local ignored directory for development when no root is configured", () => {
    setNodeEnv("development");
    delete process.env.MEDIA_STORAGE_ROOT;
    expect(getMediaStorageRoot()).toMatch(/\.local-data[\/]media$/);
  });

  it("writes media atomically, reads it with the expected MIME type and removes it", async () => {
    const root = await mkdtemp(join(tmpdir(), "desert-art-gallery-media-"));
    temporaryRoots.push(root);
    process.env.MEDIA_STORAGE_ROOT = root;
    setNodeEnv("test");

    const key = createEditorialStorageKey("collection", "a8f9df07-6f01-4f8b-a74d-90d49db01852", "image/webp");
    const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]);
    await storeEditorialMedia(key, bytes);

    const saved = await readEditorialMedia(key);
    expect(saved?.mimeType).toBe("image/webp");
    expect(saved?.bytes).toEqual(Buffer.from(bytes));

    await removeEditorialMedia(key);
    expect(await readEditorialMedia(key)).toBeNull();
  });
});
