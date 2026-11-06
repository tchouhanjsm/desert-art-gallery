# Local Backup and Restore

This runbook describes the repository's local recovery commands. It is designed for **native Oracle MySQL and local filesystem media** on a developer workstation. It is not a remote-host deployment tool and it does not back up S3-compatible buckets.

## Commands

```bash
npm run local:backup
npm run local:backup:verify -- <backup-id>
npm run local:restore -- --backup=<backup-id> --confirm-empty-database=<database-name> --confirm-empty-media-root=<absolute-media-path>
```

The commands require Node.js 22, an installed Oracle MySQL 8 client utility set (`mysqldump` and `mysql`), a reachable loopback database and applied Drizzle migrations. They refuse remote MySQL, production-looking database names, `NODE_ENV=production`, and `APP_ENV=staging|production`.

## Backup contents and consistency

Each run creates a new owner-only folder under `.local-data/backups/` containing:

- `database.sql.gz` — compressed `mysqldump` of the configured database, including routines, triggers and events.
- `media/` — copy of the configured local `MEDIA_STORAGE_ROOT` (defaults to `.local-data/media` in local development).
- `manifest.json` — source database identity, MySQL version, migration count, media source root, file sizes and SHA-256 checksums.

The dump uses `--single-transaction` and streams into gzip; credentials are written to a temporary owner-only MySQL option file rather than command-line arguments. The private option file is removed after the command. Backup folders are created with restricted permissions and are excluded by the repository's `.gitignore`.

Stop the app or otherwise pause catalogue, customer, order and media writes during the backup window. MySQL's transactional snapshot and the separate filesystem copy cannot create a cross-system atomic snapshot while media or application writes continue. A media file that changes while it is copied causes the run to fail rather than publish a questionable backup.

A backup folder is not considered valid until `local:backup` completes its built-in verification or a later `local:backup:verify` succeeds. Verification checks the manifest, gzip integrity, exact media file inventory and every SHA-256 checksum. It performs no database or media writes.

## Restore procedure

Restore is intentionally more restrictive than backup:

1. Preserve the working `.env`, `.local-data/mysql`, `.local-data/media`, imports and backups.
2. Create a **new, empty local Oracle MySQL database** for the test restore and point `DATABASE_URL` to it. The database name may differ from the source database recorded in the backup.
3. Set `MEDIA_STORAGE_ROOT` to a new empty local directory for the test restore. Do not point it at a directory containing existing media.
4. Run the restore command with the selected backup ID, the exact database name from `DATABASE_URL`, and the exact resolved absolute media path.
5. The tool verifies the complete backup first, rechecks that the target database has zero tables and the media directory is empty, then imports the SQL dump and verifies the Drizzle migration count before installing the staged media snapshot.
6. Run `npm run db:status`, start the app, verify `/api/health`, sign in to the local owner workspace and check representative products/media before accepting the restore.

Example confirmation format (replace the values with the actual local paths and database name):

```bash
npm run local:restore -- \
  --backup=20261106T020304Z-a1b2c3d4 \
  --confirm-empty-database=desert_gallery_restore \
  --confirm-empty-media-root=/absolute/path/to/.local-data/restore-media
```

The tool never issues `DROP DATABASE`, drops tables, overwrites an existing table or replaces a populated media directory. A failed SQL import may leave the selected target partially restored; it is not automatically cleaned or dropped. Inspect it, then recreate a fresh empty disposable database manually before retrying. If database import succeeds but media installation fails, the validated media snapshot remains in a sibling staging directory and its path is printed.

## S3-compatible media and hosted systems

When `MEDIA_STORAGE_DRIVER=s3`, the local backup and restore commands stop before operating. Back up the MySQL database and private object bucket using the selected hosting/storage provider's supported snapshot, versioning or export process. Verify object counts and checksums before changing providers or restoring a deployment. Never assume a GitHub release artifact contains application-managed media.

## Operational limits

- The tool does not schedule backups, apply a retention policy, encrypt backups at rest, upload them off-device, or manage cloud object versioning.
- A backup on the same workstation is not disaster recovery. After verifying the set, copy it to an owner-controlled encrypted offline or off-site location under an approved retention policy.
- Manual recovery on the owner's actual machine, including a restore to a separate empty database and media directory, is still required before production or staging data is accepted.
- Do not run these local utilities with a remote database URL or from a staging/production runtime.
