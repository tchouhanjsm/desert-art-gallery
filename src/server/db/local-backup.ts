import { constants, createReadStream, createWriteStream } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { tmpdir } from "node:os";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import mysql, { type RowDataPacket } from "mysql2/promise";
import {
  assertAbsolutePrivateMediaTarget,
  assertDistinctRestoreTargetDatabase,
  assertNonOverlappingPaths,
  assertSafeLocalDatabaseName,
  isPathInside,
  LOCAL_BACKUP_DATABASE_FILE,
  LOCAL_BACKUP_MANIFEST_FILE,
  parseLocalBackupManifest,
  validateMediaBackupPath,
  type LocalBackupManifest,
  type LocalBackupMediaFile,
} from "@/lib/local-backup";
import { isSupportedMySqlServer, parseLocalMySqlConnectionUrl } from "@/lib/local-mysql-runtime";
import { getMediaStorageRoot } from "../media/storage";
import { getMediaStorageDriver } from "../media/object-storage";

type DatabaseIdentityRow = RowDataPacket & {
  database_name: string;
  server_version: string;
  server_comment: string;
};
type CountRow = RowDataPacket & { total: number | string };

export type LocalBackupSourcePlan = {
  databaseName: string;
  serverVersion: string;
  tableCount: number;
  migrationCount: number;
  mediaFileCount: number;
  mediaBytes: number;
  backupRoot: string;
};

export type LocalBackupResult = {
  backupId: string;
  backupPath: string;
  databaseBytes: number;
  mediaFileCount: number;
  mediaBytes: number;
};

export type LocalRestorePlan = {
  backupId: string;
  sourceDatabase: string;
  targetDatabase: string;
  databaseBytes: number;
  tableCount: number;
  migrationCount: number;
  mediaFileCount: number;
  mediaBytes: number;
  backupPath: string;
  targetMediaRoot: string;
};

type DatabaseSnapshot = {
  name: string;
  serverVersion: string;
  tableCount: number;
  migrationCount: number;
};

type MediaInventoryItem = {
  sourcePath: string;
  relativePath: string;
  sizeBytes: number;
};

const DEFAULT_BACKUP_ROOT = path.resolve(process.cwd(), ".local-data", "backups", "restore-points");

export function resolveLocalBackupRoot(value = process.env.DAG_BACKUP_ROOT): string {
  const configured = value?.trim();
  if (configured && !path.isAbsolute(configured)) {
    throw new Error("DAG_BACKUP_ROOT must be an absolute path when configured.");
  }
  const resolved = path.resolve(configured || DEFAULT_BACKUP_ROOT);
  const publicRoot = path.resolve(process.cwd(), "public");
  if (isPathInside(publicRoot, resolved)) {
    throw new Error("Backup destination cannot be inside the public web directory.");
  }
  return resolved;
}

function resolveLocalMediaRoot(value = process.env.MEDIA_STORAGE_ROOT): string {
  if (getMediaStorageDriver() !== "local") {
    throw new Error("Local backup/restore is blocked while MEDIA_STORAGE_DRIVER=s3. Remote object-store backup must be verified separately; no partial backup is created.");
  }
  const resolved = value?.trim()
    ? path.resolve(value.trim())
    : path.resolve(getMediaStorageRoot());
  if (resolved === path.parse(resolved).root) {
    throw new Error("MEDIA_STORAGE_ROOT cannot be a filesystem root for backup operations.");
  }
  return resolved;
}

async function inspectDatabase(databaseUrl: string): Promise<{ config: ReturnType<typeof parseLocalMySqlConnectionUrl>; snapshot: DatabaseSnapshot }> {
  const config = parseLocalMySqlConnectionUrl(databaseUrl);
  const databaseName = assertSafeLocalDatabaseName(config.database);
  const connection = await mysql.createConnection({
    ...config,
    connectTimeout: 10_000,
    enableKeepAlive: true,
    timezone: "Z",
    charset: "utf8mb4",
  });

  try {
    const [identityRows] = await connection.query<DatabaseIdentityRow[]>(
      "SELECT DATABASE() AS database_name, VERSION() AS server_version, @@version_comment AS server_comment",
    );
    const identity = identityRows[0];
    if (!identity || identity.database_name.toLowerCase() !== databaseName.toLowerCase()) {
      throw new Error("Connected MySQL database does not match the configured local database identity.");
    }
    if (!isSupportedMySqlServer(identity.server_version, identity.server_comment)) {
      throw new Error("Backup and restore require Oracle MySQL 8.0.16 or newer. MariaDB and older versions are blocked.");
    }

    const [tableRows] = await connection.query<CountRow[]>(
      "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE()",
    );
    const [journalRows] = await connection.query<CountRow[]>(
      "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '__drizzle_migrations'",
    );
    const journalExists = Number(journalRows[0]?.total ?? 0) === 1;
    if (!journalExists) {
      throw new Error("Database has no Drizzle migration journal; refusing to treat an uninitialised or legacy schema as an accepted application backup.");
    }
    const [migrationRows] = await connection.query<CountRow[]>(
      "SELECT COUNT(*) AS total FROM __drizzle_migrations",
    );
    const tableCount = Number(tableRows[0]?.total ?? 0);
    const migrationCount = Number(migrationRows[0]?.total ?? 0);
    if (tableCount < 1 || migrationCount < 1) {
      throw new Error("Database schema or migration journal is empty; no application backup was created.");
    }

    return {
      config,
      snapshot: {
        name: databaseName,
        serverVersion: identity.server_version,
        tableCount,
        migrationCount,
      },
    };
  } finally {
    await connection.end();
  }
}

async function enumerateMediaFiles(root: string): Promise<MediaInventoryItem[]> {
  let rootStats;
  try {
    rootStats = await lstat(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    throw new Error("Private media root must be a real directory, not a symlink or file.");
  }

  const files: MediaInventoryItem[] = [];
  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error("Private media backup encountered a symbolic link. Remove or reconcile it before backing up.");
      }
      if (entry.isDirectory()) {
        await visit(fullPath);
        continue;
      }
      if (!entry.isFile()) {
        throw new Error("Private media backup supports regular files and directories only.");
      }
      const relativePath = path.relative(root, fullPath).split(path.sep).join("/");
      validateMediaBackupPath(relativePath);
      const fileStats = await lstat(fullPath);
      if (!fileStats.isFile() || fileStats.isSymbolicLink()) {
        throw new Error("Private media file changed type during backup inspection.");
      }
      files.push({ sourcePath: fullPath, relativePath, sizeBytes: fileStats.size });
    }
  }

  await visit(root);
  return files;
}

async function inspectDatabaseDirectoryIsPrivate(directory: string): Promise<void> {
  const directoryStats = await lstat(directory);
  if (!directoryStats.isDirectory() || directoryStats.isSymbolicLink()) {
    throw new Error("Backup directory must be a real filesystem directory.");
  }
}

function mysqlOption(value: string): string {
  if (value.includes("\0") || value.includes("\n") || value.includes("\r")) {
    throw new Error("MySQL credentials contain unsupported control characters.");
  }
  return '"' + value.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

async function withMysqlDefaults<T>(
  config: ReturnType<typeof parseLocalMySqlConnectionUrl>,
  operation: (defaultsFile: string) => Promise<T>,
): Promise<T> {
  const directory = await mkdtemp(path.join(tmpdir(), "dag-mysql-client-"));
  await chmod(directory, 0o700);
  const defaultsFile = path.join(directory, "client.cnf");
  const content = [
    "[client]",
    "protocol=tcp",
    "host=" + mysqlOption(config.host),
    "port=" + config.port,
    "user=" + mysqlOption(config.user),
    "password=" + mysqlOption(config.password),
    "",
  ].join("\n");

  try {
    await writeFile(defaultsFile, content, { flag: "wx", mode: 0o600 });
    await operation(defaultsFile);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function runCommand(command: string, args: string[], inputFile?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: inputFile ? ["pipe", "ignore", "pipe"] : ["ignore", "ignore", "pipe"],
    });
    const stderrChunks: Buffer[] = [];
    let stderrBytes = 0;
    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderrBytes >= 8_192) return;
      const remaining = 8_192 - stderrBytes;
      const bytes = Buffer.from(chunk).subarray(0, remaining);
      stderrChunks.push(bytes);
      stderrBytes += bytes.length;
    });

    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve();
    };

    child.once("error", () => {
      finish(new Error(command + " executable is unavailable. Install the native MySQL client tools and retry."));
    });
    child.once("close", (code) => {
      if (code === 0) {
        finish();
      } else {
        finish(new Error(command + " failed with exit code " + String(code) + ". Verify local MySQL grants and inspect the isolated restore target before retrying."));
      }
    });

    if (inputFile) {
      if (!child.stdin) {
        child.kill();
        finish(new Error("Unable to open the MySQL restore input stream."));
        return;
      }
      pipeline(createReadStream(inputFile), child.stdin).catch(() => {
        child.kill();
        finish(new Error("Unable to stream the verified SQL backup into the isolated restore database."));
      });
    }
  });
}

function backupIdentifier(date: Date): string {
  const compact = date.toISOString().replace(/[-:.]/g, "");
  return "dag-backup-" + compact + "-" + randomUUID().slice(0, 8);
}

async function digestFile(filePath: string): Promise<{ sizeBytes: number; sha256: string }> {
  const handle = await open(filePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const before = await handle.stat();
    if (!before.isFile()) throw new Error("Backup contains a non-regular file.");
    const digest = createHash("sha256");
    let sizeBytes = 0;
    for await (const chunk of handle.createReadStream({ autoClose: false })) {
      const bytes = Buffer.from(chunk);
      digest.update(bytes);
      sizeBytes += bytes.length;
    }
    const after = await handle.stat();
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
      throw new Error("A file changed while its backup checksum was being calculated.");
    }
    return { sizeBytes, sha256: digest.digest("hex") };
  } finally {
    await handle.close().catch(() => undefined);
  }
}

async function copyFileWithDigest(sourcePath: string, destinationPath: string): Promise<{ sizeBytes: number; sha256: string }> {
  const source = await open(sourcePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const before = await source.stat();
    if (!before.isFile()) throw new Error("Only regular files can be copied into a local backup.");
    await mkdir(path.dirname(destinationPath), { recursive: true, mode: 0o700 });
    const digest = createHash("sha256");
    let sizeBytes = 0;
    const meter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        digest.update(chunk);
        sizeBytes += chunk.length;
        callback(null, chunk);
      },
    });

    try {
      await pipeline(
        source.createReadStream({ autoClose: false }),
        meter,
        createWriteStream(destinationPath, { flags: "wx", mode: 0o600 }),
      );
      const after = await source.stat();
      if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
        throw new Error("A private media file changed while the backup copy was being made.");
      }
      return { sizeBytes, sha256: digest.digest("hex") };
    } catch (error) {
      await rm(destinationPath, { force: true }).catch(() => undefined);
      throw error;
    }
  } finally {
    await source.close().catch(() => undefined);
  }
}

function assertNoDatabaseSwitchStatements(dumpPath: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const lines = createInterface({ input: createReadStream(dumpPath, { encoding: "utf8" }), crlfDelay: Infinity });
    try {
      for await (const line of lines) {
        if (/^\s*(?:USE\s+|CREATE\s+(?:DATABASE|SCHEMA)\b|DROP\s+(?:DATABASE|SCHEMA)\b|ALTER\s+(?:DATABASE|SCHEMA)\b)/i.test(line)) {
          throw new Error("SQL backup contains a database-switch or database-definition statement; refusing to restore it into a different target.");
        }
      }
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

async function copyMediaTree(
  sourceRoot: string,
  destinationRoot: string,
  expectedFiles?: readonly LocalBackupMediaFile[],
): Promise<LocalBackupMediaFile[]> {
  await mkdir(destinationRoot, { recursive: true, mode: 0o700 });
  const inventory = await enumerateMediaFiles(sourceRoot);
  const expected = expectedFiles ? new Map(expectedFiles.map((file) => [file.path, file])) : undefined;
  if (expected && inventory.length !== expected.size) {
    throw new Error("Private media file count changed between backup verification and restore.");
  }

  const copied: LocalBackupMediaFile[] = [];
  for (const item of inventory) {
    const destinationPath = path.resolve(destinationRoot, ...item.relativePath.split("/"));
    if (!isPathInside(destinationRoot, destinationPath) || destinationPath === destinationRoot) {
      throw new Error("A private media path escaped the restore target.");
    }
    const digest = await copyFileWithDigest(item.sourcePath, destinationPath);
    const entry = { path: item.relativePath, ...digest };
    const expectedEntry = expected?.get(item.relativePath);
    if (expectedEntry && (
      expectedEntry.sizeBytes !== entry.sizeBytes
      || expectedEntry.sha256 !== entry.sha256
    )) {
      await rm(destinationPath, { force: true }).catch(() => undefined);
      throw new Error("A private media checksum changed during restore.");
    }
    copied.push(entry);
  }
  return copied.sort((a, b) => a.path.localeCompare(b.path));
}

export async function inspectLocalBackupSource(input: {
  databaseUrl?: string;
  mediaRoot?: string;
  backupRoot?: string;
} = {}): Promise<LocalBackupSourcePlan> {
  const databaseUrl = input.databaseUrl ?? process.env.DATABASE_URL;
  if (!databaseUrl?.trim()) throw new Error("DATABASE_URL is required for a local MySQL backup.");
  const { snapshot } = await inspectDatabase(databaseUrl);
  const mediaRoot = input.mediaRoot ? path.resolve(input.mediaRoot) : resolveLocalMediaRoot();
  const backupRoot = resolveLocalBackupRoot(input.backupRoot ?? process.env.DAG_BACKUP_ROOT);
  assertNonOverlappingPaths(
    mediaRoot,
    backupRoot,
    "Backup destination and private media root cannot contain one another. Choose separate directories.",
  );

  const files = await enumerateMediaFiles(mediaRoot);
  return {
    databaseName: snapshot.name,
    serverVersion: snapshot.serverVersion,
    tableCount: snapshot.tableCount,
    migrationCount: snapshot.migrationCount,
    mediaFileCount: files.length,
    mediaBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
    backupRoot,
  };
}

export async function createLocalBackupBundle(input: {
  databaseUrl?: string;
  mediaRoot?: string;
  backupRoot?: string;
  now?: Date;
} = {}): Promise<LocalBackupResult> {
  const databaseUrl = input.databaseUrl ?? process.env.DATABASE_URL;
  if (!databaseUrl?.trim()) throw new Error("DATABASE_URL is required for a local MySQL backup.");
  const config = parseLocalMySqlConnectionUrl(databaseUrl);
  const plan = await inspectLocalBackupSource(input);
  const mediaRoot = input.mediaRoot ? path.resolve(input.mediaRoot) : resolveLocalMediaRoot();
  const backupId = backupIdentifier(input.now ?? new Date());
  const destinationRoot = plan.backupRoot;
  await mkdir(destinationRoot, { recursive: true, mode: 0o700 });
  await chmod(destinationRoot, 0o700);
  await inspectDatabaseDirectoryIsPrivate(destinationRoot);

  const finalPath = path.join(destinationRoot, backupId);
  const stagingPath = path.join(destinationRoot, "." + backupId + ".staging-" + randomUUID());
  await mkdir(stagingPath, { mode: 0o700 });
  let published = false;

  try {
    const databaseDumpPath = path.join(stagingPath, LOCAL_BACKUP_DATABASE_FILE);
    await withMysqlDefaults(config, async (defaultsFile) => {
      await runCommand("mysqldump", [
        "--defaults-file=" + defaultsFile,
        "--single-transaction",
        "--quick",
        "--skip-lock-tables",
        "--routines",
        "--triggers",
        "--events",
        "--hex-blob",
        "--default-character-set=utf8mb4",
        "--set-gtid-purged=OFF",
        "--result-file=" + databaseDumpPath,
        "--",
        config.database,
      ]);
    });

    await assertNoDatabaseSwitchStatements(databaseDumpPath);
    const databaseDigest = await digestFile(databaseDumpPath);
    const mediaDestination = path.join(stagingPath, "media");
    const mediaFiles = await copyMediaTree(mediaRoot, mediaDestination);
    const mediaBytes = mediaFiles.reduce((total, file) => total + file.sizeBytes, 0);

    const identity = await inspectDatabase(databaseUrl);
    if (
      identity.snapshot.name !== plan.databaseName
      || identity.snapshot.serverVersion !== plan.serverVersion
      || identity.snapshot.migrationCount !== plan.migrationCount
      || identity.snapshot.tableCount !== plan.tableCount
    ) {
      throw new Error("Database schema changed while the backup was being prepared. No backup bundle was published; retry after writes settle.");
    }

    const manifest: LocalBackupManifest = {
      schemaVersion: 1,
      backupId,
      createdAt: (input.now ?? new Date()).toISOString(),
      database: {
        name: plan.databaseName,
        serverVersion: plan.serverVersion,
        file: LOCAL_BACKUP_DATABASE_FILE,
        sizeBytes: databaseDigest.sizeBytes,
        sha256: databaseDigest.sha256,
        tableCount: plan.tableCount,
        migrationCount: plan.migrationCount,
      },
      media: {
        driver: "local",
        fileCount: mediaFiles.length,
        totalBytes: mediaBytes,
        files: mediaFiles,
      },
    };
    await writeFile(
      path.join(stagingPath, LOCAL_BACKUP_MANIFEST_FILE),
      JSON.stringify(manifest, null, 2) + "\n",
      { flag: "wx", mode: 0o600 },
    );
    await rename(stagingPath, finalPath);
    published = true;

    return {
      backupId,
      backupPath: finalPath,
      databaseBytes: databaseDigest.sizeBytes,
      mediaFileCount: mediaFiles.length,
      mediaBytes,
    };
  } finally {
    if (!published) await rm(stagingPath, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function verifyLocalBackupBundle(backupPathValue: string): Promise<{ backupPath: string; manifest: LocalBackupManifest }> {
  const backupPath = path.resolve(backupPathValue);
  const rootStats = await lstat(backupPath);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
    throw new Error("Backup path must point to a real backup directory.");
  }
  const entries = await readdir(backupPath, { withFileTypes: true });
  const names = entries.map((entry) => entry.name).sort();
  const expectedNames = [LOCAL_BACKUP_DATABASE_FILE, LOCAL_BACKUP_MANIFEST_FILE, "media"].sort();
  if (names.length !== expectedNames.length || names.some((name, index) => name !== expectedNames[index])) {
    throw new Error("Backup directory contains missing or unexpected files; refusing restore.");
  }
  const manifestStats = await lstat(path.join(backupPath, LOCAL_BACKUP_MANIFEST_FILE));
  const databaseStats = await lstat(path.join(backupPath, LOCAL_BACKUP_DATABASE_FILE));
  const mediaStats = await lstat(path.join(backupPath, "media"));
  if (
    !manifestStats.isFile() || manifestStats.isSymbolicLink()
    || !databaseStats.isFile() || databaseStats.isSymbolicLink()
    || !mediaStats.isDirectory() || mediaStats.isSymbolicLink()
  ) {
    throw new Error("Backup bundle contains an unexpected filesystem object.");
  }

  const parsed = JSON.parse(await readFile(path.join(backupPath, LOCAL_BACKUP_MANIFEST_FILE), "utf8")) as unknown;
  const manifest = parseLocalBackupManifest(parsed);
  if (manifest.backupId !== path.basename(backupPath)) {
    throw new Error("Backup manifest ID does not match its directory name.");
  }

  const databaseDigest = await digestFile(path.join(backupPath, LOCAL_BACKUP_DATABASE_FILE));
  if (
    databaseDigest.sizeBytes !== manifest.database.sizeBytes
    || databaseDigest.sha256 !== manifest.database.sha256
  ) {
    throw new Error("Database dump checksum or size does not match the backup manifest.");
  }
  await assertNoDatabaseSwitchStatements(path.join(backupPath, LOCAL_BACKUP_DATABASE_FILE));

  const actualMedia = await enumerateMediaFiles(path.join(backupPath, "media"));
  if (actualMedia.length !== manifest.media.files.length) {
    throw new Error("Private media file count does not match the backup manifest.");
  }
  const expectedByPath = new Map(manifest.media.files.map((file) => [file.path, file]));
  let totalBytes = 0;
  for (const file of actualMedia) {
    const expected = expectedByPath.get(file.relativePath);
    if (!expected || expected.sizeBytes !== file.sizeBytes) {
      throw new Error("Private media inventory does not match the backup manifest.");
    }
    const digest = await digestFile(file.sourcePath);
    if (digest.sizeBytes !== expected.sizeBytes || digest.sha256 !== expected.sha256) {
      throw new Error("Private media checksum does not match the backup manifest.");
    }
    totalBytes += digest.sizeBytes;
  }
  if (totalBytes !== manifest.media.totalBytes) {
    throw new Error("Private media byte total does not match the backup manifest.");
  }
  return { backupPath, manifest };
}

async function inspectRestoreDatabase(databaseUrl: string, sourceDatabase: string): Promise<{
  name: string;
  serverVersion: string;
}> {
  const config = parseLocalMySqlConnectionUrl(databaseUrl);
  const targetName = assertDistinctRestoreTargetDatabase(sourceDatabase, config.database);
  const connection = await mysql.createConnection({
    ...config,
    connectTimeout: 10_000,
    enableKeepAlive: true,
    timezone: "Z",
    charset: "utf8mb4",
  });
  try {
    const [identityRows] = await connection.query<DatabaseIdentityRow[]>(
      "SELECT DATABASE() AS database_name, VERSION() AS server_version, @@version_comment AS server_comment",
    );
    const identity = identityRows[0];
    if (!identity || identity.database_name.toLowerCase() !== targetName.toLowerCase()) {
      throw new Error("Connected MySQL database does not match DAG_RESTORE_DATABASE_URL.");
    }
    if (!isSupportedMySqlServer(identity.server_version, identity.server_comment)) {
      throw new Error("Restore requires Oracle MySQL 8.0.16 or newer. MariaDB and older versions are blocked.");
    }

    const [tables] = await connection.query<CountRow[]>(
      "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE()",
    );
    const [routines] = await connection.query<CountRow[]>(
      "SELECT COUNT(*) AS total FROM information_schema.routines WHERE routine_schema = DATABASE()",
    );
    const [triggers] = await connection.query<CountRow[]>(
      "SELECT COUNT(*) AS total FROM information_schema.triggers WHERE trigger_schema = DATABASE()",
    );
    const [events] = await connection.query<CountRow[]>(
      "SELECT COUNT(*) AS total FROM information_schema.events WHERE event_schema = DATABASE()",
    );
    const objectCount = [tables, routines, triggers, events].reduce(
      (total, rows) => total + Number(rows[0]?.total ?? 0),
      0,
    );
    if (objectCount !== 0) {
      throw new Error("Restore target database is not empty. Choose a newly created, dedicated local database; existing data will never be dropped or overwritten.");
    }
    return { name: targetName, serverVersion: identity.server_version };
  } finally {
    await connection.end();
  }
}

export async function inspectLocalRestoreTarget(input: {
  backupPath: string;
  databaseUrl?: string;
  targetMediaRoot: string;
}): Promise<LocalRestorePlan> {
  const databaseUrl = input.databaseUrl ?? process.env.DAG_RESTORE_DATABASE_URL;
  if (!databaseUrl?.trim()) {
    throw new Error("DAG_RESTORE_DATABASE_URL must point to a separate, empty local restore database.");
  }
  if (getMediaStorageDriver() !== "local") {
    throw new Error("Local restore is blocked while MEDIA_STORAGE_DRIVER=s3. Configure a separate local filesystem restore target.");
  }

  const verified = await verifyLocalBackupBundle(input.backupPath);
  const database = await inspectRestoreDatabase(databaseUrl, verified.manifest.database.name);
  const targetMediaRoot = assertAbsolutePrivateMediaTarget(input.targetMediaRoot);
  const currentMediaRoot = resolveLocalMediaRoot();
  assertNonOverlappingPaths(
    currentMediaRoot,
    targetMediaRoot,
    "Restore media target must be separate from the current private media directory. The original media directory is never overwritten.",
  );
  assertNonOverlappingPaths(
    verified.backupPath,
    targetMediaRoot,
    "Restore media target must be outside the source backup directory.",
  );
  const publicRoot = path.resolve(process.cwd(), "public");
  if (isPathInside(publicRoot, targetMediaRoot)) {
    throw new Error("Restore media target cannot be inside the public web directory.");
  }
  try {
    await lstat(targetMediaRoot);
    throw new Error("Restore media target already exists. Choose a new path; existing files are never overwritten.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  return {
    backupId: verified.manifest.backupId,
    sourceDatabase: verified.manifest.database.name,
    targetDatabase: database.name,
    databaseBytes: verified.manifest.database.sizeBytes,
    tableCount: verified.manifest.database.tableCount,
    migrationCount: verified.manifest.database.migrationCount,
    mediaFileCount: verified.manifest.media.fileCount,
    mediaBytes: verified.manifest.media.totalBytes,
    backupPath: verified.backupPath,
    targetMediaRoot,
  };
}

export async function restoreLocalBackupBundle(input: {
  backupPath: string;
  databaseUrl?: string;
  targetMediaRoot: string;
}): Promise<LocalRestorePlan> {
  const plan = await inspectLocalRestoreTarget(input);
  const verified = await verifyLocalBackupBundle(plan.backupPath);
  const targetConfig = parseLocalMySqlConnectionUrl(input.databaseUrl ?? process.env.DAG_RESTORE_DATABASE_URL!);
  const parent = path.dirname(plan.targetMediaRoot);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const stagingMediaRoot = path.join(parent, "." + path.basename(plan.targetMediaRoot) + ".restore-" + randomUUID());
  await mkdir(stagingMediaRoot, { mode: 0o700 });
  let databaseImported = false;
  let mediaPromoted = false;

  try {
    await copyMediaTree(
      path.join(plan.backupPath, "media"),
      stagingMediaRoot,
      verified.manifest.media.files,
    );

    await withMysqlDefaults(targetConfig, async (defaultsFile) => {
      await runCommand("mysql", [
        "--defaults-file=" + defaultsFile,
        "--default-character-set=utf8mb4",
        "--binary-mode",
        "--database=" + targetConfig.database,
      ], path.join(plan.backupPath, LOCAL_BACKUP_DATABASE_FILE));
    });
    databaseImported = true;

    const restoredDatabase = await inspectDatabase(input.databaseUrl ?? process.env.DAG_RESTORE_DATABASE_URL!);
    if (
      restoredDatabase.snapshot.tableCount !== verified.manifest.database.tableCount
      || restoredDatabase.snapshot.migrationCount !== verified.manifest.database.migrationCount
    ) {
      throw new Error("Database restore completed but its table or migration counts do not match the backup manifest. Keep this isolated target for investigation; do not use it.");
    }

    await rename(stagingMediaRoot, plan.targetMediaRoot);
    mediaPromoted = true;
    return plan;
  } catch (error) {
    if (!databaseImported) {
      await rm(stagingMediaRoot, { recursive: true, force: true }).catch(() => undefined);
    } else if (!mediaPromoted) {
      throw new Error(
        "The isolated target database was imported, but the media directory could not be promoted. Database target: "
        + plan.targetDatabase + ". Media recovery files remain at: " + stagingMediaRoot + ". Do not use this target until reconciled.",
      );
    }
    throw error;
  }
}
