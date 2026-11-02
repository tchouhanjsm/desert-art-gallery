import { afterEach, describe, expect, it } from "vitest";
import { getMediaStorageRoot, safeStorageKey, createEditorialStorageKey, getEditorialMediaUrl } from "@/server/media/storage";

const originalRoot = process.env.MEDIA_STORAGE_ROOT;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalRoot === undefined) delete process.env.MEDIA_STORAGE_ROOT;
  else process.env.MEDIA_STORAGE_ROOT = originalRoot;
  process.env.NODE_ENV = originalNodeEnv;
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
    process.env.NODE_ENV = "production";
    delete process.env.MEDIA_STORAGE_ROOT;
    expect(() => getMediaStorageRoot()).toThrow("persistent storage");
    process.env.MEDIA_STORAGE_ROOT = "relative/media";
    expect(() => getMediaStorageRoot()).toThrow("absolute");
  });

  it("uses a local ignored directory for development when no root is configured", () => {
    process.env.NODE_ENV = "development";
    delete process.env.MEDIA_STORAGE_ROOT;
    expect(getMediaStorageRoot()).toMatch(/\.local-data[\/]media$/);
  });
});
