import { describe, expect, it } from "vitest";
import {
  assertAbsolutePrivateMediaTarget,
  assertDistinctRestoreTargetDatabase,
  assertNonOverlappingPaths,
  assertSafeLocalDatabaseName,
  isPathInside,
  isRestoreServerVersionCompatible,
  parseLocalBackupManifest,
  validateMediaBackupPath,
} from "./local-backup";

const manifest = {
  schemaVersion: 1,
  backupId: "dag-backup-20261105T170000000Z-a1b2c3d4",
  createdAt: "2026-11-05T17:00:00.000Z",
  database: {
    name: "desert_gallery_test",
    serverVersion: "8.0.36",
    file: "database.sql",
    sizeBytes: 120,
    sha256: "a".repeat(64),
    tableCount: 28,
    migrationCount: 6,
  },
  media: {
    driver: "local",
    fileCount: 1,
    totalBytes: 4,
    files: [{
      path: "products/123e4567-e89b-12d3-a456-426614174000/123e4567-e89b-12d3-a456-426614174001.jpg",
      sizeBytes: 4,
      sha256: "b".repeat(64),
    }],
  },
};

describe("local backup safety contracts", () => {
  it("accepts a valid local application database name", () => {
    expect(assertSafeLocalDatabaseName("desert_gallery_restore")).toBe("desert_gallery_restore");
  });

  it.each([
    "desert_gallery_production",
    "desert_gallery_live",
    "my_hostinger_db",
    "mysql",
    "information_schema",
    "contains spaces",
    "bad-name",
  ])("rejects unsafe database identifier %s", (name) => {
    expect(() => assertSafeLocalDatabaseName(name)).toThrow();
  });

  it("requires restore to target a different database", () => {
    expect(assertDistinctRestoreTargetDatabase("desert_gallery", "desert_gallery_restore"))
      .toBe("desert_gallery_restore");
    expect(() => assertDistinctRestoreTargetDatabase("desert_gallery", "DESERT_GALLERY"))
      .toThrow(/different database/);
  });

  it("accepts paths inside the private product and editorial namespaces", () => {
    expect(validateMediaBackupPath("products/product-id/image.jpg")).toBe("products/product-id/image.jpg");
    expect(validateMediaBackupPath("editorial/journal/post-id/image.webp")).toBe("editorial/journal/post-id/image.webp");
  });

  it.each([
    "../secret.txt",
    "/products/product-id/image.jpg",
    "products/../secret.jpg",
    "products/product-id/../../secret.jpg",
    "public/products/image.jpg",
    "products\\product-id\\image.jpg",
    "products/product-id",
    "products//image.jpg",
  ])("rejects unsafe media path %s", (value) => {
    expect(() => validateMediaBackupPath(value)).toThrow();
  });

  it("checks path containment without accepting sibling-prefix collisions", () => {
    expect(isPathInside("/srv/gallery/media", "/srv/gallery/media/products/a.jpg")).toBe(true);
    expect(isPathInside("/srv/gallery/media", "/srv/gallery/media-old/a.jpg")).toBe(false);
    expect(() => assertNonOverlappingPaths("/srv/gallery/media", "/srv/gallery/media/backups", "overlap"))
      .toThrow("overlap");
    expect(() => assertNonOverlappingPaths("/srv/gallery/media", "/srv/gallery/backups", "overlap"))
      .not.toThrow();
  });

  it("requires an absolute, non-root restore media target", () => {
    expect(assertAbsolutePrivateMediaTarget("/tmp/desert-gallery-restore")).toBe("/tmp/desert-gallery-restore");
    expect(() => assertAbsolutePrivateMediaTarget("relative/restore")).toThrow(/absolute/);
    expect(() => assertAbsolutePrivateMediaTarget("/")).toThrow(/root/);
  });

  it("requires the restore server to be the same MySQL version or newer", () => {
    expect(isRestoreServerVersionCompatible("8.0.36", "8.0.36")).toBe(true);
    expect(isRestoreServerVersionCompatible("8.0.36-commercial", "8.0.40")).toBe(true);
    expect(isRestoreServerVersionCompatible("8.0.36", "8.4.0")).toBe(true);
    expect(isRestoreServerVersionCompatible("8.0.40", "8.0.36")).toBe(false);
    expect(isRestoreServerVersionCompatible("invalid", "8.4.0")).toBe(false);
  });
});

describe("local backup manifest", () => {
  it("accepts a valid database and private-media checksum manifest", () => {
    expect(parseLocalBackupManifest(manifest)).toMatchObject({
      backupId: manifest.backupId,
      database: { name: "desert_gallery_test", sha256: "a".repeat(64) },
      media: { fileCount: 1, totalBytes: 4 },
    });
  });

  it("accepts a database-only backup with an explicitly empty media inventory", () => {
    expect(parseLocalBackupManifest({
      ...manifest,
      media: { driver: "local", fileCount: 0, totalBytes: 0, files: [] },
    }).media.files).toEqual([]);
  });

  it("rejects duplicate media paths", () => {
    expect(() => parseLocalBackupManifest({
      ...manifest,
      media: { ...manifest.media, fileCount: 2, totalBytes: 8, files: [manifest.media.files[0], manifest.media.files[0]] },
    })).toThrow(/duplicate media paths/);
  });

  it("rejects media totals that do not match the file inventory", () => {
    expect(() => parseLocalBackupManifest({
      ...manifest,
      media: { ...manifest.media, totalBytes: 99 },
    })).toThrow(/byte total/);
  });

  it("rejects unsupported, malformed or unsafe manifests", () => {
    expect(() => parseLocalBackupManifest({ ...manifest, schemaVersion: 2 })).toThrow(/schema version/);
    expect(() => parseLocalBackupManifest({ ...manifest, backupId: "../backup" })).toThrow(/Backup ID/);
    expect(() => parseLocalBackupManifest({
      ...manifest,
      database: { ...manifest.database, sha256: "not-a-digest" },
    })).toThrow(/SHA-256/);
    expect(() => parseLocalBackupManifest({
      ...manifest,
      media: { ...manifest.media, files: [{ ...manifest.media.files[0], path: "../../outside.jpg" }] },
    })).toThrow(/media path/);
    expect(() => parseLocalBackupManifest({
      ...manifest,
      media: { ...manifest.media, driver: "s3" },
    })).toThrow(/Only local filesystem/);
  });
});
