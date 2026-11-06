import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { chmod, copyFile, lstat, mkdir, mkdtemp, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createConnection, type RowDataPacket } from "mysql2/promise";
import { createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import {
  buildMySqlClientOptionFile,
  buildMySqlRestoreArguments,
  isPathWithin,
  resolveLocalBackupPath,
  sha256File,
  verifyLocalBackupSet,
  type LocalBackupManifest,
} from "../src/lib/local-backup";
import { isSupportedMySqlServer, parseLocalMySqlConnectionUrl } from "../src/lib/local-mysql-runtime";
import { getMediaStorageDriver } from "../src/server/media/object-storage";
import { getMediaStorageRoot } from "../src/server/media/storage";

type DatabaseIdentityRow = RowDataPacket & {
  database_name: string;
  server_version: string;
  server_comment: string;
};
type CountRow = RowDataPacket & { total: number | string };

const projectRoot = process.cwd();
const backupRoot = path.resolve(projectRoot, ".local-data", "backups");

type RestoreOptions = {
  backupId: string;
  confirmDatabase: string;
  confirmMediaRoot: string;
};

function loadLocalEnvironment(): void {
  try {
    process.loadEnvFile(path.join(projectRoot, ".env"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function parseOptions(args: string[]): RestoreOptions {
  const parsed = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument.startsWith("--")) throw new Error("Restore arguments must use named options.");
    const separator = argument.indexOf("=");
    const key = separator >= 0 ? argument.slice(2, separator) : argument.slice(2);
    const value = separator >= 0 ? argument.slice(separator + 1) : args[++index];
    if (!value || parsed.has(key)) throw new Error("Restore options are missing or duplicated.");
    parsed.set(key, value);
  }
  if (parsed.size !== 3 || !parsed.has("backup") || !parsed.has("confirm-empty-database") || !parsed.has("confirm-empty-media-root")) {
    throw new Error(
      "Usage: npm run local:restore -- --backup=<backup-id> --confirm-empty-database=<database-name> --confirm-empty-media-root=<absolute-path>",
    );
  }
  return {
    backupId: parsed.get("backup")!,
    confirmDatabase: parsed.get("confirm-empty-database")!,
    confirmMediaRoot: parsed.get("confirm-empty-media-root")!,
  };
}

function assertLocalRestoreEnvironment(): void {
  if (
    process.env.NODE_ENV === "production"
    || ["production", "staging"].includes((process.env.APP_ENV ?? "").trim().toLowerCase())
  ) {
    throw new Error("Local restore tooling is disabled in production and staging environments.");
  }
  if (getMediaStorageDriver() !== "local") {
    throw new Error("The local restore tool requires MEDIA_STORAGE_DRIVER=local. S3-compatible media must be restored with provider-native tools.");
  }
}

async function writeClientDefaults(directory: string, config: ReturnType<typeof parseLocalMySqlConnectionUrl>): Promise<string> {
  const filename = path.join(directory, "client.cnf");
  await writeFile(filename, buildMySqlClientOptionFile(config), { encoding: "utf8", flag: "wx", mode: 0o600 });
  await chmod(filename, 0o600);
  return filename;
}

function waitForCommand(child: ReturnType<typeof spawn>, commandLabel: string): Promise<void> {
  return new Promise((resolve, reject) => {
    child.once("error", (error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new Error(commandLabel + " is not installed. Install the Oracle MySQL client utilities for the local server version."));
      } else {
        reject(new Error(commandLabel + " could not be started."));
      }
    });
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(commandLabel + " failed (exit code " + String(code) + "). The target database may now be partially restored."));
    });
  });
}

async function runDatabaseRestore(defaultsFile: string, database: string, dumpPath: string): Promise<void> {
  const child = spawn("mysql", buildMySqlRestoreArguments(defaultsFile, database), {
    stdio: ["pipe", "ignore", "pipe"],
  });
  child.stderr.resume();
  const command = waitForCommand(child, "mysql");
  try {
    await Promise.all([
      pipeline(createReadStream(dumpPath), createGunzip(), child.stdin),
      command,
    ]);
  } catch (error) {
    child.kill();
    await command.catch(() => undefined);
    throw error;
  }
}

async function inspectEmptyDatabase(config: ReturnType<typeof parseLocalMySqlConnectionUrl>): Promise<void> {
  const connection = await createConnection({
    host: config.host, port: config.port, user: config.user, password: config.password,
    database: config.database, connectTimeout: 5_000, charset: "utf8mb4", timezone: "Z",
  });
  try {
    const [rows] = await connection.query<DatabaseIdentityRow[]>(
      "SELECT DATABASE() AS database_name, VERSION() AS server_version, @@version_comment AS server_comment",
    );
    const identity = rows[0];
    if (!identity || identity.database_name.toLowerCase() !== config.database.toLowerCase()) {
      throw new Error("The connected database does not match DATABASE_URL.");
    }
    if (!isSupportedMySqlServer(identity.server_version, identity.server_comment)) {
      throw new Error("Restore requires Oracle MySQL 8.0.16 or newer; MariaDB is not supported.");
    }
    const [tables] = await connection.query<CountRow[]>(
      "SELECT COUNT(*) AS total FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE()",
    );
    if (Number(tables[0]?.total ?? 0) !== 0) {
      throw new Error("Restore is blocked because the target database already contains tables. This tool never drops or overwrites database objects.");
    }
  } finally {
    await connection.end();
  }
}

async function verifyRestoredDatabase(
  config: ReturnType<typeof parseLocalMySqlConnectionUrl>,
  manifest: LocalBackupManifest,
): Promise<void> {
  const connection = await createConnection({
    host: config.host, port: config.port, user: config.user, password: config.password,
    database: config.database, connectTimeout: 5_000, charset: "utf8mb4", timezone: "Z",
  });
  try {
    const [rows] = await connection.query<DatabaseIdentityRow[]>(
      "SELECT DATABASE() AS database_name, VERSION() AS server_version, @@version_comment AS server_comment",
    );
    const identity = rows[0];
    if (!identity || identity.database_name.toLowerCase() !== config.database.toLowerCase()) {
      throw new Error("Restored database identity could not be verified.");
    }
    const [journal] = await connection.query<CountRow[]>(
      "SELECT COUNT(*) AS total FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '__drizzle_migrations'",
    );
    if (Number(journal[0]?.total ?? 0) !== 1) throw new Error("Restored database is missing the Drizzle migration journal.");
    const [migrationRows] = await connection.query<CountRow[]>("SELECT COUNT(*) AS total FROM __drizzle_migrations");
    if (Number(migrationRows[0]?.total ?? 0) !== manifest.database.migrationCount) {
      throw new Error("Restored migration count does not match the backup manifest.");
    }
  } finally {
    await connection.end();
  }
}

async function assertEmptyOrMissingMediaRoot(mediaRoot: string): Promise<void> {
  try {
    const info = await lstat(mediaRoot);
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new Error("MEDIA_STORAGE_ROOT must be an empty real directory, not a symlink or file.");
    }
    if ((await readdir(mediaRoot)).length > 0) {
      throw new Error("Restore is blocked because MEDIA_STORAGE_ROOT is not empty. Existing media is never overwritten.");
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function stageMediaRestore(
  backupDirectory: string,
  manifest: LocalBackupManifest,
  mediaRoot: string,
): Promise<string> {
  const parent = path.dirname(mediaRoot);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const stagingRoot = path.join(parent, "." + path.basename(mediaRoot) + ".restore-" + randomUUID());
  await mkdir(stagingRoot, { recursive: false, mode: 0o700 });
  await chmod(stagingRoot, 0o700);

  for (const file of manifest.media.files) {
    const source = path.resolve(backupDirectory, "media", ...file.path.split("/"));
    const destination = path.resolve(stagingRoot, ...file.path.split("/"));
    if (!isPathWithin(path.join(backupDirectory, "media"), source) || !isPathWithin(stagingRoot, destination)) {
      throw new Error("Restore media path escapes its verified snapshot.");
    }
    const sourceInfo = await lstat(source);
    if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink()) throw new Error("Restore media source is not a regular file.");
    await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
    await copyFile(source, destination);
    await chmod(destination, 0o600);
    const copied = await sha256File(destination);
    if (copied.bytes !== file.sizeBytes || copied.sha256 !== file.sha256) {
      throw new Error("Staged media checksum does not match: " + file.path);
    }
  }
  return stagingRoot;
}

async function installStagedMedia(stagingRoot: string, mediaRoot: string): Promise<void> {
  await assertEmptyOrMissingMediaRoot(mediaRoot);
  try {
    await rm(mediaRoot, { recursive: false });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await rename(stagingRoot, mediaRoot);
  await chmod(mediaRoot, 0o700);
}

async function main(): Promise<void> {
  loadLocalEnvironment();
  assertLocalRestoreEnvironment();
  const options = parseOptions(process.argv.slice(2));
  const backupDirectory = resolveLocalBackupPath(backupRoot, options.backupId);
  const manifest = await verifyLocalBackupSet(backupDirectory);
  const config = parseLocalMySqlConnectionUrl(process.env.DATABASE_URL ?? "");
  if (manifest.database.name.toLowerCase() !== config.database.toLowerCase()) {
    throw new Error("The selected backup database name does not match the target DATABASE_URL database.");
  }
  if (options.confirmDatabase !== config.database) {
    throw new Error("The database confirmation must exactly match DATABASE_URL's local database name.");
  }

  const mediaRoot = path.resolve(getMediaStorageRoot());
  if (options.confirmMediaRoot !== mediaRoot) {
    throw new Error("The media-root confirmation must exactly match the resolved MEDIA_STORAGE_ROOT path.");
  }
  if (isPathWithin(backupRoot, mediaRoot) || isPathWithin(mediaRoot, backupRoot)) {
    throw new Error("MEDIA_STORAGE_ROOT and the private backup directory must be separate paths.");
  }
  await inspectEmptyDatabase(config);
  await assertEmptyOrMissingMediaRoot(mediaRoot);

  const stagedMediaRoot = await stageMediaRestore(backupDirectory, manifest, mediaRoot);
  const temporaryClientDirectory = await mkdtemp(path.join(tmpdir(), "dag-mysql-restore-"));
  await chmod(temporaryClientDirectory, 0o700);
  let databaseRestoreCompleted = false;

  try {
    const defaultsFile = await writeClientDefaults(temporaryClientDirectory, config);
    await runDatabaseRestore(defaultsFile, config.database, path.join(backupDirectory, manifest.database.dumpFile));
    databaseRestoreCompleted = true;
    await verifyRestoredDatabase(config, manifest);
    await installStagedMedia(stagedMediaRoot, mediaRoot);

    process.stdout.write("Local restore completed and database migration state verified.\n");
    process.stdout.write("Database: " + config.database + " (" + manifest.database.migrationCount + " migrations)\n");
    process.stdout.write("Media files restored: " + manifest.media.files.length + "\n");
    process.stdout.write("Backup ID: " + options.backupId + "\n");
  } catch (error) {
    if (databaseRestoreCompleted) {
      process.stderr.write("The database restore completed. The verified media snapshot remains staged at: " + stagedMediaRoot + "\n");
    }
    throw error;
  } finally {
    if (!databaseRestoreCompleted) await rm(stagedMediaRoot, { recursive: true, force: true });
    await rm(temporaryClientDirectory, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  process.stderr.write((error instanceof Error ? error.message : "Local restore failed.") + "\n");
  process.exitCode = 1;
});
