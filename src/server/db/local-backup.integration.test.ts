import { randomUUID } from "node:crypto";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import mysql from "mysql2/promise";
import type { Pool, RowDataPacket } from "mysql2";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import * as schema from "./schema";
import { parseLocalMySqlConnectionUrl } from "@/lib/local-mysql-runtime";
import {
  createLocalBackupBundle,
  inspectLocalRestoreTarget,
  restoreLocalBackupBundle,
} from "./local-backup";

const enabled = process.env.MYSQL_BACKUP_INTEGRATION_TEST === "1"
  && Boolean(process.env.MYSQL_BACKUP_TEST_ADMIN_URL);
const suite = enabled ? describe : describe.skip;

suite("native local MySQL and private-media backup/restore", () => {
  it("backs up a migrated database and private media, then restores into separate empty targets", async () => {
    const adminUrl = process.env.MYSQL_BACKUP_TEST_ADMIN_URL;
    if (!adminUrl) throw new Error("MYSQL_BACKUP_TEST_ADMIN_URL is required for this integration test.");
    const adminConfig = parseLocalMySqlConnectionUrl(adminUrl);
    const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
    const sourceDatabase = "dag_backup_source_" + suffix;
    const targetDatabase = "dag_backup_target_" + suffix;
    const mediaRoot = await mkdtemp(join(tmpdir(), "dag-backup-source-media-"));
    const backupRoot = await mkdtemp(join(tmpdir(), "dag-backup-bundles-"));
    const targetMediaParent = await mkdtemp(join(tmpdir(), "dag-backup-restore-media-"));
    const targetMediaRoot = join(targetMediaParent, "restored-media");
    const productId = randomUUID();
    const mediaId = randomUUID();
    const storageKey = "products/" + productId + "/" + mediaId + ".jpg";
    const sourceMediaDirectory = join(mediaRoot, "products", productId);
    const mediaBytes = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]);
    const probeValue = "probe-" + suffix;
    const admin = await mysql.createConnection(adminConfig);
    let sourcePool: Pool | undefined;

    try {
      await admin.query(
        "CREATE DATABASE `" + sourceDatabase + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci",
      );
      await admin.query(
        "CREATE DATABASE `" + targetDatabase + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci",
      );

      const sourceUrl = new URL(adminUrl);
      sourceUrl.pathname = "/" + sourceDatabase;
      const targetUrl = new URL(adminUrl);
      targetUrl.pathname = "/" + targetDatabase;
      const sourceConfig = parseLocalMySqlConnectionUrl(sourceUrl.toString());
      sourcePool = mysql.createPool({ ...sourceConfig, connectionLimit: 2 });
      await migrate(drizzle(sourcePool, { schema, mode: "default" }), { migrationsFolder: "./drizzle" });
      await sourcePool.query(
        "INSERT INTO products (id, title, slug, currency, price_minor, status) VALUES (?, ?, ?, 'INR', 0, 'draft')",
        [productId, "Backup restore test product", "backup-restore-" + suffix],
      );
      await sourcePool.query(
        "INSERT INTO product_media (id, product_id, storage_key, alt_text, rights_confirmed, rights_evidence, mime_type, byte_size, position, is_primary) VALUES (?, ?, ?, ?, 0, '', 'image/jpeg', ?, 0, 1)",
        [mediaId, productId, storageKey, "Backup restore fixture image", mediaBytes.length],
      );
      await sourcePool.query(
        "CREATE TABLE dag_backup_probe (id INT NOT NULL PRIMARY KEY, probe_value VARCHAR(100) NOT NULL) ENGINE=InnoDB",
      );
      await sourcePool.query("INSERT INTO dag_backup_probe (id, probe_value) VALUES (1, ?)", [probeValue]);

      await mkdir(sourceMediaDirectory, { recursive: true });
      await writeFile(join(sourceMediaDirectory, mediaId + ".jpg"), mediaBytes);

      const backup = await createLocalBackupBundle({
        databaseUrl: sourceUrl.toString(),
        mediaRoot,
        backupRoot,
      });
      expect(backup.mediaFileCount).toBe(1);
      expect(backup.mediaBytes).toBe(mediaBytes.length);
      expect(backup.databaseBytes).toBeGreaterThan(0);

      const restorePlan = await inspectLocalRestoreTarget({
        backupPath: backup.backupPath,
        databaseUrl: targetUrl.toString(),
        targetMediaRoot,
      });
      expect(restorePlan.sourceDatabase).toBe(sourceDatabase);
      expect(restorePlan.targetDatabase).toBe(targetDatabase);
      expect(restorePlan.mediaFileCount).toBe(1);

      const restored = await restoreLocalBackupBundle({
        backupPath: backup.backupPath,
        databaseUrl: targetUrl.toString(),
        targetMediaRoot,
      });
      expect(restored.targetDatabase).toBe(targetDatabase);
      expect(await readFile(join(targetMediaRoot, "products", productId, mediaId + ".jpg")))
        .toEqual(mediaBytes);

      const targetConnection = await mysql.createConnection(parseLocalMySqlConnectionUrl(targetUrl.toString()));
      try {
        const [rows] = await targetConnection.query<RowDataPacket[]>(
          "SELECT probe_value FROM dag_backup_probe WHERE id = 1",
        );
        expect(rows[0]?.probe_value).toBe(probeValue);
        const [migrations] = await targetConnection.query<RowDataPacket[]>(
          "SELECT COUNT(*) AS total FROM __drizzle_migrations",
        );
        expect(Number(migrations[0]?.total ?? 0)).toBeGreaterThan(0);
      } finally {
        await targetConnection.end();
      }
    } finally {
      await sourcePool?.end().catch(() => undefined);
      await admin.query("DROP DATABASE IF EXISTS `" + sourceDatabase + "`").catch(() => undefined);
      await admin.query("DROP DATABASE IF EXISTS `" + targetDatabase + "`").catch(() => undefined);
      await admin.end();
      await rm(mediaRoot, { recursive: true, force: true });
      await rm(backupRoot, { recursive: true, force: true });
      await rm(targetMediaParent, { recursive: true, force: true });
    }
  }, 120_000);

  it("rejects changed media and database bytes before any restore write", async () => {
    const adminUrl = process.env.MYSQL_BACKUP_TEST_ADMIN_URL;
    if (!adminUrl) throw new Error("MYSQL_BACKUP_TEST_ADMIN_URL is required for this integration test.");
    const adminConfig = parseLocalMySqlConnectionUrl(adminUrl);
    const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
    const sourceDatabase = "dag_backup_verify_" + suffix;
    const mediaRoot = await mkdtemp(join(tmpdir(), "dag-backup-verify-media-"));
    const backupRoot = await mkdtemp(join(tmpdir(), "dag-backup-verify-bundles-"));
    const targetMediaParent = await mkdtemp(join(tmpdir(), "dag-backup-verify-target-"));
    const targetMediaRoot = join(targetMediaParent, "must-not-exist");
    const mediaFolder = join(mediaRoot, "products", "product-" + suffix);
    const admin = await mysql.createConnection(adminConfig);
    let sourcePool: Pool | undefined;

    try {
      await admin.query(
        "CREATE DATABASE `" + sourceDatabase + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci",
      );
      const sourceUrl = new URL(adminUrl);
      sourceUrl.pathname = "/" + sourceDatabase;
      const sourceConfig = parseLocalMySqlConnectionUrl(sourceUrl.toString());
      sourcePool = mysql.createPool({ ...sourceConfig, connectionLimit: 2 });
      await migrate(drizzle(sourcePool, { schema, mode: "default" }), { migrationsFolder: "./drizzle" });
      await mkdir(mediaFolder, { recursive: true });
      await writeFile(join(mediaFolder, "01-primary.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0x01]));

      const backup = await createLocalBackupBundle({
        databaseUrl: sourceUrl.toString(),
        mediaRoot,
        backupRoot,
      });
      await writeFile(join(backup.backupPath, "media", "products", "product-" + suffix, "01-primary.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0x02]));

      await expect(inspectLocalRestoreTarget({
        backupPath: backup.backupPath,
        databaseUrl: sourceUrl.toString(),
        targetMediaRoot,
      })).rejects.toThrow(/checksum/);
      await expect(access(targetMediaRoot)).rejects.toThrow();
    } finally {
      await sourcePool?.end().catch(() => undefined);
      await admin.query("DROP DATABASE IF EXISTS `" + sourceDatabase + "`").catch(() => undefined);
      await admin.end();
      await rm(mediaRoot, { recursive: true, force: true });
      await rm(backupRoot, { recursive: true, force: true });
      await rm(targetMediaParent, { recursive: true, force: true });
    }
  }, 120_000);
});
