import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";

export type LocalBackupMediaFile = {
  path: string;
  sizeBytes: number;
  sha256: string;
};

export type LocalBackupManifest = {
  version: 1;
  createdAt: string;
  database: {
    name: string;
    serverVersion: string;
    serverComment: string;
    migrationCount: number;
    dumpFile: "database.sql.gz";
    dumpBytes: number;
    dumpSha256: string;
  };
  media: {
    sourceRoot: string;
    files: LocalBackupMediaFile[];
  };
};

const BACKUP_ID_PATTERN = /^\d{8}T\d{6}Z-[a-f0-9]{8}$/;
const DATABASE_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export function createLocalBackupId(now = new Date(), uniqueId = randomUUID()): string {
  if (!/^[a-f0-9-]{36}$/i.test(uniqueId)) {
    throw new Error("Backup identifier entropy is invalid.");
  }
  const timestamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return timestamp + "-" + uniqueId.replaceAll("-", "").slice(0, 8).toLowerCase();
}

export function resolveLocalBackupPath(backupsRoot: string, backupId: string): string {
  if (!BACKUP_ID_PATTERN.test(backupId)) {
    throw new Error("Backup ID is invalid. Select a backup folder created by this tool.");
  }
  const root = path.resolve(backupsRoot);
  const target = path.resolve(root, backupId);
  if (!isPathWithin(root, target) || target === root) {
    throw new Error("Backup path must remain inside the private backup directory.");
  }
  return target;
}

export function isPathWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === "" || (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative));
}

export function isSafeBackupRelativePath(value: string): boolean {
  if (!value || value.length > 1024 || value.startsWith("/") || value.includes("\\") || value.includes("\0")) {
    return false;
  }
  const segments = value.split("/");
  return segments.length > 0 && segments.every((segment) =>
    Boolean(segment) && segment !== "." && segment !== ".." && /^[a-zA-Z0-9._-]+$/.test(segment)
  );
}

function assertManifestObject(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Backup manifest must be a JSON object.");
  }
}

export function validateLocalBackupManifest(value: unknown): LocalBackupManifest {
  assertManifestObject(value);
  const manifest = value;
  const database = manifest.database;
  const media = manifest.media;
  assertManifestObject(database);
  assertManifestObject(media);

  if (manifest.version !== 1 || typeof manifest.createdAt !== "string" || !Number.isFinite(Date.parse(manifest.createdAt))) {
    throw new Error("Backup manifest version or creation timestamp is invalid.");
  }
  if (
    typeof database.name !== "string" || !DATABASE_NAME_PATTERN.test(database.name)
    || typeof database.serverVersion !== "string" || !database.serverVersion.trim()
    || typeof database.serverComment !== "string"
    || !Number.isSafeInteger(database.migrationCount) || Number(database.migrationCount) < 1
    || database.dumpFile !== "database.sql.gz"
    || !Number.isSafeInteger(database.dumpBytes) || Number(database.dumpBytes) < 1
    || typeof database.dumpSha256 !== "string" || !SHA256_PATTERN.test(database.dumpSha256)
  ) {
    throw new Error("Backup manifest database metadata is invalid.");
  }
  if (typeof media.sourceRoot !== "string" || !path.isAbsolute(media.sourceRoot) || !Array.isArray(media.files)) {
    throw new Error("Backup manifest media metadata is invalid.");
  }

  const seen = new Set<string>();
  const files: LocalBackupMediaFile[] = media.files.map((entry) => {
    assertManifestObject(entry);
    if (
      typeof entry.path !== "string" || !isSafeBackupRelativePath(entry.path)
      || !Number.isSafeInteger(entry.sizeBytes) || Number(entry.sizeBytes) < 0
      || typeof entry.sha256 !== "string" || !SHA256_PATTERN.test(entry.sha256)
    ) {
      throw new Error("Backup manifest contains an invalid media file entry.");
    }
    if (seen.has(entry.path)) throw new Error("Backup manifest contains a duplicate media path.");
    seen.add(entry.path);
    return { path: entry.path, sizeBytes: Number(entry.sizeBytes), sha256: entry.sha256 };
  });

  return {
    version: 1,
    createdAt: manifest.createdAt,
    database: {
      name: database.name,
      serverVersion: database.serverVersion,
      serverComment: database.serverComment,
      migrationCount: Number(database.migrationCount),
      dumpFile: "database.sql.gz",
      dumpBytes: Number(database.dumpBytes),
      dumpSha256: database.dumpSha256,
    },
    media: { sourceRoot: media.sourceRoot, files },
  };
}

function quoteOptionValue(value: string): string {
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error("MySQL client credentials contain unsupported control characters.");
  }
  return '"' + value.replaceAll("\\", "\\\\").replaceAll('"', '\\"') + '"';
}

export function buildMySqlClientOptionFile(config: {
  host: string;
  port: number;
  user: string;
  password: string;
}): string {
  if (
    !config.host.trim() || !Number.isInteger(config.port) || config.port < 1 || config.port > 65535
    || !config.user || !config.password
  ) {
    throw new Error("Local MySQL client connection settings are incomplete.");
  }
  return [
    "[client]",
    "protocol=TCP",
    "host=" + quoteOptionValue(config.host),
    "port=" + config.port,
    "user=" + quoteOptionValue(config.user),
    "password=" + quoteOptionValue(config.password),
    "default-character-set=utf8mb4",
    "",
  ].join("\n");
}

export function buildMySqlDumpArguments(defaultsFile: string, database: string): string[] {
  if (!path.isAbsolute(defaultsFile) || !DATABASE_NAME_PATTERN.test(database)) {
    throw new Error("MySQL dump arguments are invalid.");
  }
  return [
    "--defaults-extra-file=" + defaultsFile,
    "--single-transaction",
    "--routines",
    "--triggers",
    "--events",
    "--hex-blob",
    "--quick",
    "--no-tablespaces",
    "--set-gtid-purged=OFF",
    "--default-character-set=utf8mb4",
    database,
  ];
}

export function buildMySqlRestoreArguments(defaultsFile: string, database: string): string[] {
  if (!path.isAbsolute(defaultsFile) || !DATABASE_NAME_PATTERN.test(database)) {
    throw new Error("MySQL restore arguments are invalid.");
  }
  return [
    "--defaults-extra-file=" + defaultsFile,
    "--binary-mode",
    "--default-character-set=utf8mb4",
    database,
  ];
}

export async function sha256File(filePath: string): Promise<{ bytes: number; sha256: string }> {
  const digest = createHash("sha256");
  let bytes = 0;
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    digest.update(buffer);
    bytes += buffer.byteLength;
  }
  return { bytes, sha256: digest.digest("hex") };
}

async function assertRegularFile(filePath: string, label: string): Promise<void> {
  const info = await lstat(filePath);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(label + " must be a regular file.");
}

export async function verifyLocalBackupSet(backupDirectory: string): Promise<LocalBackupManifest> {
  const root = path.resolve(backupDirectory);
  const rootInfo = await lstat(root);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
    throw new Error("Backup set must be a real directory, not a symlink.");
  }

  const manifestPath = path.join(root, "manifest.json");
  await assertRegularFile(manifestPath, "Backup manifest");
  const manifest = validateLocalBackupManifest(JSON.parse(await readFile(manifestPath, "utf8")) as unknown);

  const dumpPath = path.join(root, manifest.database.dumpFile);
  await assertRegularFile(dumpPath, "Database dump");
  const dump = await sha256File(dumpPath);
  if (dump.bytes !== manifest.database.dumpBytes || dump.sha256 !== manifest.database.dumpSha256) {
    throw new Error("Database dump checksum does not match the backup manifest.");
  }
  await pipeline(
    createReadStream(dumpPath),
    createGunzip(),
    new Writable({ write(_chunk, _encoding, callback) { callback(); } }),
  );

  const mediaRoot = path.join(root, "media");
  const mediaInfo = await lstat(mediaRoot);
  if (!mediaInfo.isDirectory() || mediaInfo.isSymbolicLink()) {
    throw new Error("Backup media snapshot must be a real directory.");
  }

  const expected = new Set(manifest.media.files.map((file) => file.path));
  const discovered: string[] = [];
  async function walk(directory: string, prefix = ""): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const relative = prefix ? prefix + "/" + entry.name : entry.name;
      if (!isSafeBackupRelativePath(relative) || entry.isSymbolicLink()) {
        throw new Error("Backup media snapshot contains an unsafe path or symbolic link.");
      }
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath, relative);
      } else if (entry.isFile()) {
        discovered.push(relative);
      } else {
        throw new Error("Backup media snapshot contains an unsupported filesystem entry.");
      }
    }
  }
  await walk(mediaRoot);

  if (discovered.length !== expected.size || discovered.some((relative) => !expected.has(relative))) {
    throw new Error("Backup media file list does not match the manifest.");
  }
  for (const item of manifest.media.files) {
    const filePath = path.resolve(mediaRoot, ...item.path.split("/"));
    if (!isPathWithin(mediaRoot, filePath)) throw new Error("Backup media file path escapes its snapshot.");
    await assertRegularFile(filePath, "Backup media file");
    const actual = await sha256File(filePath);
    if (actual.bytes !== item.sizeBytes || actual.sha256 !== item.sha256) {
      throw new Error("Media checksum does not match the backup manifest: " + item.path);
    }
  }

  return manifest;
}
