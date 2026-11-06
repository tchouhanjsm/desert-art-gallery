import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { chmod, copyFile, lstat, mkdir, mkdtemp, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createConnection, type RowDataPacket } from "mysql2/promise";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import {
  buildMySqlClientOptionFile,
  buildMySqlDumpArguments,
  createLocalBackupId,
  isPathWithin,
  sha256File,
  verifyLocalBackupSet,
  type LocalBackupManifest,
  type LocalBackupMediaFile,
} from "../src/lib/local-backup";
import { isSupportedMySqlServer, parseLocalMySqlConnectionUrl } from "../src/lib/local-mysql-runtime";
import { getMediaStorageDriver } from "../src/server/media/object-storage";
import { getMediaStorageRoot } from "../src/server/media/storage";

type DatabaseIdentityRow = RowDataPacket & {
  database_name: string;
  server_version: string;
  server_comment: string;
};
type MigrationCountRow = RowDataPacket & { total: number | string };

const projectRoot = process.cwd();
const backupRoot = path.resolve(projectRoot, ".local-data", "backups");

function loadLocalEnvironment(): void {
  try {
    process.loadEnvFile(path.join(projectRoot, ".env"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function assertLocalBackupEnvironment(): void {
  if (
    process.env.NODE_ENV === "production"
    || ["production", "staging"].includes((process.env.APP_ENV ?? "").trim().toLowerCase())
  ) {
    throw new Error("Local backup tooling is disabled in production and staging environments.");
  }
  if (getMediaStorageDriver() !== "local") {
    throw new Error("The local backup tool requires MEDIA_STORAGE_DRIVER=local. Use provider-native backup/versioning for S3-compatible media.");
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
      else reject(new Error(commandLabel + " failed (exit code " + String(code) + "). Check local database privileges; credentials are not printed."));
    });
  });
}

async function runDatabaseDump(defaultsFile: string, database: string, destination: string): Promise<void> {
  const args = buildMySqlDumpArguments(defaultsFile, database);
  const child = spawn("mysqldump", args, { stdio: ["ignore", "pipe", "pipe"] });
  child.stderr.resume();
  const command = waitForCommand(child, "mysqldump");
  try {
    await Promise.all([
      pipeline(child.stdout, createGzip({ level: 6 }), createWriteStream(destination, { flags: "wx", mode: 0o600 })),
      command,
    ]);
  } catch (error) {
    child.kill();
    await command.catch(() => undefined);
    throw error;
  }
}

async function copyMediaTree(
  sourceRoot: string,
  destinationRoot: string,
  relativePath = "",
): Promise<LocalBackupMediaFile[]> {
  let entries;
  try {
    entries = await readdir(sourceRoot, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" && !relativePath) return [];
    throw error;
  }

  const results: LocalBackupMediaFile[] = [];
  await mkdir(destinationRoot, { recursive: true, mode: 0o700 });
  await chmod(destinationRoot, 0o700);
  for (const entry of entries) {
    const relative = relativePath ? relativePath + "/" + entry.name : entry.name;
    if (
      !entry.name || entry.name === "." || entry.name === ".."
      || entry.name.includes("/") || entry.name.includes("\\")
      || entry.name.includes("\0")
    ) {
      throw new Error("Media storage contains an unsafe filename; backup was stopped.");
    }
    const source = path.join(sourceRoot, entry.name);
    const destination = path.join(destinationRoot, entry.name);
    if (entry.isSymbolicLink()) throw new Error("Media storage contains a symbolic link; backup was stopped.");
    if (entry.isDirectory()) {
      results.push(...await copyMediaTree(source, destination, relative));
      continue;
    }
    if (!entry.isFile()) throw new Error("Media storage contains an unsupported filesystem entry; backup was stopped.");
    const sourceInfo = await lstat(source);
    if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink()) throw new Error("Media file changed during backup.");
    await copyFile(source, destination);
    const afterCopy = await lstat(source);
    if (afterCopy.size !== sourceInfo.size || afterCopy.mtimeMs !== sourceInfo.mtimeMs || afterCopy.ino !== sourceInfo.ino) {
      throw new Error("Media file changed while the backup was being copied; pause media writes and retry.");
    }
    await chmod(destination, 0o600);
    const digest = await sha256File(destination);
    results.push({ path: relative, sizeBytes: digest.bytes, sha256: digest.sha256 });
  }
  return results;
}

async function inspectDatabase(config: ReturnType<typeof parseLocalMySqlConnectionUrl>) {
  const connection = await createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectTimeout: 5_000,
    charset: "utf8mb4",
    timezone: "Z",
  });
  try {
    const [identityRows] = await connection.query<DatabaseIdentityRow[]>(
      "SELECT DATABASE() AS database_name, VERSION() AS server_version, @@version_comment AS server_comment",
    );
    const identity = identityRows[0];
    if (!identity || identity.database_name.toLowerCase() !== config.database.toLowerCase()) {
      throw new Error("The connected database does not match DATABASE_URL.");
    }
    if (!isSupportedMySqlServer(identity.server_version, identity.server_comment)) {
      throw new Error("Backup requires Oracle MySQL 8.0.16 or newer; MariaDB is not supported.");
    }
    const [journalRows] = await connection.query<MigrationCountRow[]>(
      "SELECT COUNT(*) AS total FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '__drizzle_migrations'",
    );
    if (Number(journalRows[0]?.total ?? 0) !== 1) {
      throw new Error("The Drizzle migration journal is missing. Apply and verify migrations before creating a backup.");
    }
    const [migrationRows] = await connection.query<MigrationCountRow[]>("SELECT COUNT(*) AS total FROM __drizzle_migrations");
    const migrationCount = Number(migrationRows[0]?.total ?? 0);
    if (!Number.isSafeInteger(migrationCount) || migrationCount < 1) {
      throw new Error("The Drizzle migration journal is empty; no application backup was created.");
    }
    return {
      databaseName: identity.database_name,
      serverVersion: identity.server_version,
      serverComment: identity.server_comment,
      migrationCount,
    };
  } finally {
    await connection.end();
  }
}

async function main(): Promise<void> {
  loadLocalEnvironment();
  assertLocalBackupEnvironment();
  const config = parseLocalMySqlConnectionUrl(process.env.DATABASE_URL ?? "");
  const mediaRoot = path.resolve(getMediaStorageRoot());
  if (isPathWithin(backupRoot, mediaRoot) || isPathWithin(mediaRoot, backupRoot)) {
    throw new Error("MEDIA_STORAGE_ROOT and the private backup directory must be separate paths.");
  }

  const database = await inspectDatabase(config);
  await mkdir(backupRoot, { recursive: true, mode: 0o700 });
  await chmod(backupRoot, 0o700);

  const backupId = createLocalBackupId();
  const stagingDirectory = path.join(backupRoot, ".incomplete-" + backupId);
  const finalDirectory = path.join(backupRoot, backupId);
  const temporaryClientDirectory = await mkdtemp(path.join(tmpdir(), "dag-mysql-backup-"));
  await chmod(temporaryClientDirectory, 0o700);

  try {
    await mkdir(stagingDirectory, { recursive: false, mode: 0o700 });
    await chmod(stagingDirectory, 0o700);
    const defaultsFile = await writeClientDefaults(temporaryClientDirectory, config);
    const dumpPath = path.join(stagingDirectory, "database.sql.gz");
    await runDatabaseDump(defaultsFile, database.databaseName, dumpPath);
    await chmod(dumpPath, 0o600);
    const dump = await sha256File(dumpPath);

    const stagedMediaRoot = path.join(stagingDirectory, "media");
    await mkdir(stagedMediaRoot, { recursive: false, mode: 0o700 });
    await chmod(stagedMediaRoot, 0o700);
    let mediaFiles: LocalBackupMediaFile[] = [];
    try {
      const sourceInfo = await lstat(mediaRoot);
      if (!sourceInfo.isDirectory() || sourceInfo.isSymbolicLink()) {
        throw new Error("MEDIA_STORAGE_ROOT must be a real directory, not a symlink.");
      }
      mediaFiles = await copyMediaTree(mediaRoot, stagedMediaRoot);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    mediaFiles.sort((a, b) => a.path.localeCompare(b.path));

    const manifest: LocalBackupManifest = {
      version: 1,
      createdAt: new Date().toISOString(),
      database: {
        name: database.databaseName,
        serverVersion: database.serverVersion,
        serverComment: database.serverComment,
        migrationCount: database.migrationCount,
        dumpFile: "database.sql.gz",
        dumpBytes: dump.bytes,
        dumpSha256: dump.sha256,
      },
      media: { sourceRoot: mediaRoot, files: mediaFiles },
    };
    await writeFile(path.join(stagingDirectory, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", {
      encoding: "utf8", flag: "wx", mode: 0o600,
    });

    await verifyLocalBackupSet(stagingDirectory);
    await rename(stagingDirectory, finalDirectory);
    await chmod(finalDirectory, 0o700);

    process.stdout.write("Local backup completed and verified.\n");
    process.stdout.write("Backup ID: " + backupId + "\n");
    process.stdout.write("Database: " + database.databaseName + " (" + database.migrationCount + " migrations)\n");
    process.stdout.write("Media files: " + mediaFiles.length + "\n");
    process.stdout.write("Private location: .local-data/backups/" + backupId + "/\n");
    process.stdout.write("S3-compatible media is not included by this tool.\n");
  } catch (error) {
    await rm(stagingDirectory, { recursive: true, force: true });
    throw error;
  } finally {
    await rm(temporaryClientDirectory, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  process.stderr.write((error instanceof Error ? error.message : "Local backup failed.") + "\n");
  process.exitCode = 1;
});
