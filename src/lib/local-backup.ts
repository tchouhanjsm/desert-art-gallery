import path from "node:path";

export const LOCAL_BACKUP_SCHEMA_VERSION = 1;
export const LOCAL_BACKUP_DATABASE_FILE = "database.sql";
export const LOCAL_BACKUP_MANIFEST_FILE = "manifest.json";

export type LocalBackupMediaFile = {
  path: string;
  sizeBytes: number;
  sha256: string;
};

export type LocalBackupManifest = {
  schemaVersion: 1;
  backupId: string;
  createdAt: string;
  database: {
    name: string;
    serverVersion: string;
    file: typeof LOCAL_BACKUP_DATABASE_FILE;
    sizeBytes: number;
    sha256: string;
    tableCount: number;
    migrationCount: number;
  };
  media: {
    driver: "local";
    fileCount: number;
    totalBytes: number;
    files: LocalBackupMediaFile[];
  };
};

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(label + " must be an object.");
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(label + " must be a non-empty string.");
  }
  return value;
}

function asNonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(label + " must be a non-negative safe integer.");
  }
  return value;
}

function asPositiveInteger(value: unknown, label: string): number {
  const parsed = asNonNegativeInteger(value, label);
  if (parsed < 1) throw new Error(label + " must be greater than zero.");
  return parsed;
}

function versionParts(value: string): [number, number, number] | null {
  const match = value.match(/(?:^|[^0-9])(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isRestoreServerVersionCompatible(sourceVersion: string, targetVersion: string): boolean {
  const source = versionParts(sourceVersion);
  const target = versionParts(targetVersion);
  if (!source || !target) return false;
  if (target[0] !== source[0]) return target[0] > source[0];
  if (target[1] !== source[1]) return target[1] > source[1];
  return target[2] >= source[2];
}

export function assertSafeLocalDatabaseName(value: string): string {
  const name = value.trim();
  if (
    !/^[a-zA-Z0-9_]{1,64}$/.test(name)
    || /(^|[_-])(prod|production|live|hostinger)([_-]|$)/i.test(name)
    || ["mysql", "information_schema", "performance_schema", "sys"].includes(name.toLowerCase())
  ) {
    throw new Error("Database name is not an approved local application database identifier.");
  }
  return name;
}

export function assertDistinctRestoreTargetDatabase(sourceName: string, targetName: string): string {
  const source = assertSafeLocalDatabaseName(sourceName);
  const target = assertSafeLocalDatabaseName(targetName);
  if (source.toLowerCase() === target.toLowerCase()) {
    throw new Error("Restore target must be a different database from the backup source. The source database is never overwritten.");
  }
  return target;
}

export function validateMediaBackupPath(value: string): string {
  if (
    !value
    || value.length > 512
    || value.startsWith("/")
    || value.includes("\\")
    || value.includes("\0")
  ) {
    throw new Error("Backup media path is invalid.");
  }
  const segments = value.split("/");
  if (
    segments.length < 3
    || (segments[0] !== "products" && segments[0] !== "editorial")
    || segments.some((segment) => !segment || segment === "." || segment === ".." || !/^[a-zA-Z0-9._-]+$/.test(segment))
    || path.posix.normalize(value) !== value
  ) {
    throw new Error("Backup media path is outside the private product/editorial storage namespace.");
  }
  return value;
}

export function isPathInside(parent: string, candidate: string): boolean {
  const resolvedParent = path.resolve(parent);
  const resolvedCandidate = path.resolve(candidate);
  const relative = path.relative(resolvedParent, resolvedCandidate);
  return relative === "" || (
    relative !== ".."
    && !relative.startsWith(".." + path.sep)
    && !path.isAbsolute(relative)
  );
}

export function assertNonOverlappingPaths(first: string, second: string, message: string): void {
  const resolvedFirst = path.resolve(first);
  const resolvedSecond = path.resolve(second);
  if (isPathInside(resolvedFirst, resolvedSecond) || isPathInside(resolvedSecond, resolvedFirst)) {
    throw new Error(message);
  }
}

export function assertAbsolutePrivateMediaTarget(value: string): string {
  if (!path.isAbsolute(value)) {
    throw new Error("Restore media target must be an absolute filesystem path.");
  }
  const resolved = path.resolve(value);
  if (resolved === path.parse(resolved).root || path.basename(resolved) === "") {
    throw new Error("Restore media target cannot be a filesystem root.");
  }
  return resolved;
}

export function parseLocalBackupManifest(value: unknown): LocalBackupManifest {
  const root = asRecord(value, "Backup manifest");
  if (root.schemaVersion !== LOCAL_BACKUP_SCHEMA_VERSION) {
    throw new Error("Backup manifest schema version is not supported.");
  }

  const backupId = asString(root.backupId, "Backup ID");
  if (!/^dag-backup-[0-9]{8}T[0-9]{9}Z-[a-f0-9]{8}$/.test(backupId)) {
    throw new Error("Backup ID format is invalid.");
  }

  const createdAt = asString(root.createdAt, "Backup timestamp");
  if (Number.isNaN(Date.parse(createdAt))) throw new Error("Backup timestamp is invalid.");

  const database = asRecord(root.database, "Backup database metadata");
  const databaseName = assertSafeLocalDatabaseName(asString(database.name, "Database name"));
  const serverVersion = asString(database.serverVersion, "MySQL server version");
  if (!versionParts(serverVersion) || /mariadb/i.test(serverVersion)) {
    throw new Error("Backup manifest MySQL server version is invalid or unsupported.");
  }
  if (database.file !== LOCAL_BACKUP_DATABASE_FILE) {
    throw new Error("Backup database filename is invalid.");
  }
  const databaseSize = asPositiveInteger(database.sizeBytes, "Database dump size");
  const databaseSha = asString(database.sha256, "Database dump SHA-256").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(databaseSha)) throw new Error("Database dump SHA-256 is invalid.");
  const tableCount = asPositiveInteger(database.tableCount, "Database table count");
  const migrationCount = asPositiveInteger(database.migrationCount, "Database migration count");

  const media = asRecord(root.media, "Backup media metadata");
  if (media.driver !== "local") throw new Error("Only local filesystem media backups are supported by this workflow.");
  if (!Array.isArray(media.files)) throw new Error("Backup media file list is invalid.");

  const files: LocalBackupMediaFile[] = media.files.map((item, index) => {
    const file = asRecord(item, "Backup media file " + index);
    const relativePath = validateMediaBackupPath(asString(file.path, "Backup media path"));
    const sizeBytes = asPositiveInteger(file.sizeBytes, "Backup media file size");
    const sha256 = asString(file.sha256, "Backup media file SHA-256").toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("Backup media file SHA-256 is invalid.");
    return { path: relativePath, sizeBytes, sha256 };
  });

  const uniquePaths = new Set(files.map((file) => file.path));
  if (uniquePaths.size !== files.length) throw new Error("Backup manifest contains duplicate media paths.");
  const mediaFileCount = asNonNegativeInteger(media.fileCount, "Backup media file count");
  const totalBytes = asNonNegativeInteger(media.totalBytes, "Backup media byte total");
  if (mediaFileCount !== files.length) throw new Error("Backup media file count does not match its manifest.");
  if (files.reduce((total, file) => total + file.sizeBytes, 0) !== totalBytes) {
    throw new Error("Backup media byte total does not match its manifest.");
  }

  return {
    schemaVersion: LOCAL_BACKUP_SCHEMA_VERSION,
    backupId,
    createdAt,
    database: {
      name: databaseName,
      serverVersion,
      file: LOCAL_BACKUP_DATABASE_FILE,
      sizeBytes: databaseSize,
      sha256: databaseSha,
      tableCount,
      migrationCount,
    },
    media: {
      driver: "local",
      fileCount: mediaFileCount,
      totalBytes,
      files: files.sort((a, b) => a.path.localeCompare(b.path)),
    },
  };
}
