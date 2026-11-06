import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildMySqlClientOptionFile,
  buildMySqlDumpArguments,
  buildMySqlRestoreArguments,
  createLocalBackupId,
  isPathWithin,
  isSafeBackupRelativePath,
  resolveLocalBackupPath,
  validateLocalBackupManifest,
  verifyLocalBackupSet,
  type LocalBackupManifest,
} from "./local-backup";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "dag-backup-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function validManifest(overrides: Partial<LocalBackupManifest> = {}): LocalBackupManifest {
  return {
    version: 1,
    createdAt: "2026-11-06T02:00:00.000Z",
    database: {
      name: "desert_gallery_dev",
      serverVersion: "8.0.36",
      serverComment: "MySQL Community Server",
      migrationCount: 8,
      dumpFile: "database.sql.gz",
      dumpBytes: 20,
      dumpSha256: "a".repeat(64),
    },
    media: { sourceRoot: "/workspace/.local-data/media", files: [] },
    ...overrides,
  };
}

describe("local backup contracts", () => {
  it("creates timestamped backup IDs with a bounded random suffix", () => {
    expect(createLocalBackupId(new Date("2026-11-06T02:03:04.000Z"), "12345678-1234-4234-9234-123456789abc"))
      .toBe("20261106T020304Z-12345678");
    expect(() => createLocalBackupId(new Date(), "not-a-uuid")).toThrow(/entropy/i);
  });

  it("resolves only validated backup IDs under the private backup root", () => {
    const root = path.resolve("/workspace/.local-data/backups");
    expect(resolveLocalBackupPath(root, "20261106T020304Z-a1b2c3d4"))
      .toBe(path.join(root, "20261106T020304Z-a1b2c3d4"));
    expect(() => resolveLocalBackupPath(root, "../database")).toThrow(/Backup ID/i);
    expect(() => resolveLocalBackupPath(root, "20261106T020304Z-../../etc")).toThrow(/Backup ID/i);
  });

  it("detects path containment without treating sibling prefixes as children", () => {
    expect(isPathWithin("/data/media", "/data/media/products/a.jpg")).toBe(true);
    expect(isPathWithin("/data/media", "/data/media")).toBe(true);
    expect(isPathWithin("/data/media", "/data/media-old/a.jpg")).toBe(false);
    expect(isPathWithin("/data/media", "/etc/passwd")).toBe(false);
  });

  it.each([
    "products/item/front.jpg",
    "editorial/homepage/hero.avif",
    "products/item.with.dots/front-01.webp",
  ])("accepts a safe media path: %s", (value) => {
    expect(isSafeBackupRelativePath(value)).toBe(true);
  });

  it.each([
    "",
    "../outside.jpg",
    "products/../../outside.jpg",
    "/absolute/file.jpg",
    "products\\item\\front.jpg",
    "products//front.jpg",
    "products/./front.jpg",
    "products/item/with space.jpg",
  ])("rejects an unsafe media path: %s", (value) => {
    expect(isSafeBackupRelativePath(value)).toBe(false);
  });

  it("validates required database and media manifest fields", () => {
    expect(validateLocalBackupManifest(validManifest()).database.migrationCount).toBe(8);
    expect(() => validateLocalBackupManifest({ ...validManifest(), version: 2 })).toThrow(/version/i);
    expect(() => validateLocalBackupManifest(validManifest({
      database: { ...validManifest().database, name: "desert_gallery_production" },
    }))).toThrow(/database metadata/i);
    expect(() => validateLocalBackupManifest(validManifest({
      media: { sourceRoot: "relative/media", files: [] },
    }))).toThrow(/media metadata/i);
  });

  it("rejects duplicate media paths and malformed hashes", () => {
    const mediaFile = { path: "products/p1/front.jpg", sizeBytes: 10, sha256: "a".repeat(64) };
    expect(() => validateLocalBackupManifest(validManifest({
      media: { sourceRoot: "/media", files: [mediaFile, mediaFile] },
    }))).toThrow(/duplicate/i);
    expect(() => validateLocalBackupManifest(validManifest({
      media: { sourceRoot: "/media", files: [{ ...mediaFile, sha256: "invalid" }] },
    }))).toThrow(/media file entry/i);
  });

  it("writes a private MySQL option file with escaped credentials", () => {
    const content = buildMySqlClientOptionFile({
      host: "localhost", port: 3307, user: "gallery\"owner", password: "p\\a\"ss",
    });
    expect(content).toContain('user="gallery\\\"owner"');
    expect(content).toContain('password="p\\\\a\\\"ss"');
    expect(content).not.toContain("DATABASE_URL");
    expect(() => buildMySqlClientOptionFile({
      host: "localhost", port: 3306, user: "gallery", password: "line\nbreak",
    })).toThrow(/control characters/i);
  });

  it("places the temporary option file before database arguments and never adds credentials to CLI args", () => {
    const dump = buildMySqlDumpArguments("/tmp/mysql-client.cnf", "desert_gallery_dev");
    const restore = buildMySqlRestoreArguments("/tmp/mysql-client.cnf", "desert_gallery_dev");
    expect(dump[0]).toBe("--defaults-extra-file=/tmp/mysql-client.cnf");
    expect(dump).toContain("--single-transaction");
    expect(dump).toContain("--set-gtid-purged=OFF");
    expect(dump.at(-1)).toBe("desert_gallery_dev");
    expect(restore[0]).toBe("--defaults-extra-file=/tmp/mysql-client.cnf");
    expect(restore).toContain("--binary-mode");
    expect(restore).not.toContain("password");
    expect(() => buildMySqlDumpArguments("relative.cnf", "desert_gallery_dev")).toThrow();
  });
});

describe("local backup-set verification", () => {
  it("verifies the compressed MySQL dump and every media-file checksum", async () => {
    const root = await temporaryDirectory();
    const mediaRoot = path.join(root, "media");
    await mkdir(path.join(mediaRoot, "products", "p1"), { recursive: true });
    const media = Buffer.from("authorized-test-media");
    await writeFile(path.join(mediaRoot, "products", "p1", "front.jpg"), media);

    const dump = gzipSync(Buffer.from("CREATE TABLE backup_probe (id INT);"));
    await writeFile(path.join(root, "database.sql.gz"), dump);
    const manifest = validManifest({
      database: { ...validManifest().database, dumpBytes: dump.byteLength, dumpSha256: sha256(dump) },
      media: {
        sourceRoot: "/workspace/.local-data/media",
        files: [{ path: "products/p1/front.jpg", sizeBytes: media.byteLength, sha256: sha256(media) }],
      },
    });
    await writeFile(path.join(root, "manifest.json"), JSON.stringify(manifest));
    const verified = await verifyLocalBackupSet(root);
    expect(verified.database.name).toBe("desert_gallery_dev");
    expect(verified.media.files).toHaveLength(1);
  });

  it("detects a media file modified after the manifest was written", async () => {
    const root = await temporaryDirectory();
    const mediaRoot = path.join(root, "media", "products", "p1");
    await mkdir(mediaRoot, { recursive: true });
    const media = Buffer.from("original");
    await writeFile(path.join(mediaRoot, "front.jpg"), media);
    const dump = gzipSync(Buffer.from("SELECT 1;"));
    await writeFile(path.join(root, "database.sql.gz"), dump);
    const manifest = validManifest({
      database: { ...validManifest().database, dumpBytes: dump.byteLength, dumpSha256: sha256(dump) },
      media: {
        sourceRoot: "/workspace/.local-data/media",
        files: [{ path: "products/p1/front.jpg", sizeBytes: media.byteLength, sha256: sha256(media) }],
      },
    });
    await writeFile(path.join(root, "manifest.json"), JSON.stringify(manifest));
    await writeFile(path.join(mediaRoot, "front.jpg"), "tampered");
    await expect(verifyLocalBackupSet(root)).rejects.toThrow(/checksum/i);
  });

  it("rejects symbolic links inside the media snapshot", async () => {
    const root = await temporaryDirectory();
    const mediaRoot = path.join(root, "media");
    await mkdir(mediaRoot);
    const external = path.join(root, "external.jpg");
    await writeFile(external, "outside");
    await symlink(external, path.join(mediaRoot, "linked.jpg"));
    const dump = gzipSync(Buffer.from("SELECT 1;"));
    await writeFile(path.join(root, "database.sql.gz"), dump);
    await writeFile(path.join(root, "manifest.json"), JSON.stringify(validManifest({
      database: { ...validManifest().database, dumpBytes: dump.byteLength, dumpSha256: sha256(dump) },
    })));
    await expect(verifyLocalBackupSet(root)).rejects.toThrow(/symbolic link/i);
  });

  it("rejects a corrupt compressed dump before any restore is attempted", async () => {
    const root = await temporaryDirectory();
    await mkdir(path.join(root, "media"));
    await writeFile(path.join(root, "database.sql.gz"), "not-a-gzip");
    const dump = Buffer.from("not-a-gzip");
    await writeFile(path.join(root, "manifest.json"), JSON.stringify(validManifest({
      database: { ...validManifest().database, dumpBytes: dump.byteLength, dumpSha256: sha256(dump) },
    })));
    await expect(verifyLocalBackupSet(root)).rejects.toThrow();
  });
});
