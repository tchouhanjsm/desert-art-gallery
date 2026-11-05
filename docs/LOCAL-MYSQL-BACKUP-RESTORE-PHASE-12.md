# Local MySQL and private-media backup/restore — Phase 12

**Scope:** owner-operated, local recovery tooling for the MySQL application database and private filesystem media. This phase does not deploy the application, move customer data, activate payments or change storefront behaviour.

## Commands

- `npm run db:backup` — read-only preflight of the configured local database, applied Drizzle migrations, private media inventory and backup destination.
- `npm run db:backup -- --commit --confirm-local-backup` — create a paired restore point.
- `npm run db:restore -- --backup <backup-folder> --target-media <absolute-new-directory>` — verify a restore point and a separate, empty MySQL restore database without writing.
- Add `--commit --confirm-local-restore` only after reviewing the target database and new media directory.

The default backup destination is `.local-data/backups/restore-points/`; DAG_BACKUP_ROOT can select another absolute path. DAG_RESTORE_DATABASE_URL is a separate loopback connection for a pre-created empty restore database. The restore command never uses DATABASE_URL.

## Restore-point format

Each successful bundle contains a logical MySQL dump, a copy of the private product/editorial media keys and a JSON manifest with database identity, server/schema/migration counts, file sizes and SHA-256 checksums. The bundle is uncompressed and unencrypted.

## Safety behaviour

- Only local loopback Oracle MySQL 8.0.16+ is accepted.
- Production/live/Hostinger-looking database names and remote hosts are rejected.
- S3 media mode fails closed; this phase does not claim a backup of remote object storage.
- Symlinks, special filesystem objects, public paths, unsafe media keys and checksum mismatches are rejected.
- The restore database must be different from the source and empty, and the new media directory must not already exist or overlap the current media root or source backup.
- SQL dumps containing database-switch or database-definition statements are rejected before restore.
- No command drops a database, overwrites the original media root or edits .env.
- A failed SQL import can leave the disposable restore database partially populated; inspect that specific target and recreate it manually only after confirming it is disposable.

## Operator procedure

1. Pause the local application or otherwise stop owner/customer writes and media changes.
2. Confirm the local database and media roots are the intended sources; confirm sufficient free space.
3. Run the backup preflight and review its output.
4. Commit the backup to encrypted, access-controlled storage. Copy a second encrypted copy away from the development device.
5. Create a separate empty local MySQL restore database and a new absolute media destination.
6. Set DAG_RESTORE_DATABASE_URL in the private .env and run the restore preflight.
7. Commit the restore into those isolated targets.
8. Verify database rows and media files, then test the restored pair locally without pointing the production site or original data at it.
9. Record the owner, date, backup ID, source/target database names, media destination, result and any remediation in the operational recovery log.

Do not commit backup bundles, SQL dumps, private media or operator secrets to Git.

## Validation boundary and release gate

CI exercises the backup and restore commands against disposable MySQL databases and temporary media, including data and checksum verification. It does not create a real workstation backup, prove the external encrypted-storage copy, validate S3 object recovery, or establish Hostinger durability.

Before hosting cutover, the owner must complete and record a restore drill using the actual workstation's native MySQL and real private media. This code milestone is not production backup acceptance.
