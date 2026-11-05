# Native local MySQL development setup

This project uses native Oracle MySQL, not Docker or Compose, on the developer device. The application connects through DATABASE_URL and Drizzle migrations. The required baseline is Oracle MySQL 8.0.16 or newer because the schema relies on enforced CHECK constraints. MariaDB and older MySQL versions are not accepted by the current support contract.

Node.js 22 is the CI baseline. Use a Node release supported by the installed Next.js toolchain.

## 1. Inspect the actual device before installing MySQL

Do not install or upgrade a database server until the device's OS, CPU architecture and existing MySQL service are known. Run:

~~~bash
sw_vers
uname -m
node --version
npm --version
command -v brew || true
brew --version 2>/dev/null | head -1 || true
command -v mysql || true
mysql --version 2>/dev/null || true
command -v mysqld || true
mysqld --version 2>/dev/null || true
command -v mysqladmin || true
lsof -nP -iTCP:3306 -sTCP:LISTEN || true
~~~

Use a native MySQL distribution compatible with the exact macOS release and CPU architecture. The service start/stop command depends on the distribution (for example, a Homebrew service versus the Oracle MySQL installer). Do not run a guessed Homebrew formula or service command. Confirm the actual server binary and version first.

The app-level diagnostic rejects remote hosts, production-looking database names, MariaDB and MySQL versions older than 8.0.16. It does not print connection credentials.

## 2. Prepare private project directories

From the repository root:

~~~bash
npm run local:prepare
~~~

The script creates:

~~~text
.local-data/
  mysql/                         # reserved for a dedicated native MySQL data directory
  media/                         # application-managed private media
  imports/
    etsy/
    product-images/
  backups/
    mysql/
    media/
~~~

The repository .gitignore excludes .env and all of .local-data/. Directories are created with owner-only permissions where supported.

Important: the script does not initialize MySQL, modify an existing server, move data or change the server's data directory. The native server may currently use an OS-managed data directory. To satisfy a project-contained database-data requirement, configure a separate, newly initialized MySQL instance to use .local-data/mysql only after checking the exact server distribution, permissions and existing data. Never repoint, delete or reinitialize an existing data directory. The owner must approve any move of existing database files.

## 3. Create a dedicated local database and application user

Use the native MySQL administrative method for the installed distribution. The application user should be scoped to the project database, not granted global privileges.

For a new local MySQL 8 instance, the intended database and grants are:

~~~sql
CREATE DATABASE desert_art_gallery
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE USER 'dag_local'@'127.0.0.1'
  IDENTIFIED BY 'USE_A_NEW_RANDOM_LOCAL_PASSWORD';

GRANT ALL PRIVILEGES ON desert_art_gallery.*
  TO 'dag_local'@'127.0.0.1';

FLUSH PRIVILEGES;
~~~

Replace the sample password with a unique local secret. Do not paste it into chat, source control, screenshots or shell history. Use a secure local MySQL administration session and the server's supported credential-handling method. Do not use the root account as the application's DATABASE_URL user.

If a database with this name already exists, stop and inspect it rather than dropping or overwriting it.

## 4. Configure the application environment

Preserve an existing .env file. Only copy the template when there is no local file:

~~~bash
test -f .env || cp .env.example .env
openssl rand -hex 24
~~~

Put a unique generated password in DATABASE_URL and use the same password for the dag_local database user. Hexadecimal secrets need no URL encoding:

~~~dotenv
DATABASE_URL=mysql://dag_local:YOUR_48_CHARACTER_SECRET@127.0.0.1:3306/desert_art_gallery
MEDIA_STORAGE_ROOT=
MYSQL_CATALOGUE_ENABLED=false
NEXT_PUBLIC_SITE_URL=http://localhost:3000
~~~

Keep the actual .env private and ignored. Leave MEDIA_STORAGE_ROOT empty for local development; application-managed editorial and product media default to .local-data/media. Do not put the password in a public frontend variable.

## 5. Verify native MySQL and apply migrations

Start the installed native MySQL service using the service manager for the distribution actually installed on this device. Then run:

~~~bash
npm run db:ping
npm run db:status
npm run db:migrate
npm run db:status
~~~

- db:ping checks a local loopback connection with SELECT 1.
- db:status reports the database name, server version and Drizzle migration journal state.
- db:status exits with code 2 when the database is reachable but migrations are pending.
- db:migrate applies the tracked Drizzle migrations only after verifying the connected database identity, Oracle MySQL version and current schema. It refuses to initialize a database that already contains tables/views but has no Drizzle migration journal.

The diagnostics reject remote database targets and never print usernames, passwords or the complete DATABASE_URL. Use a compatible Oracle MySQL 8.0.16+ server. GitHub CI uses its own hosted MySQL service and does not require Docker on the local device.

If migration initialization is blocked, do not drop tables or retry with a different command. First inspect the table list from `npm run db:catalogue-preflight`, confirm the database is the intended local target, and back up/reconcile any legacy schema. A separate empty local database is the preferred path when the existing schema is not part of this application.

After starting the application:

~~~bash
npm run dev
curl -i http://localhost:3000/api/health
~~~

A ready application returns HTTP 200 with application, database and migration checks all healthy. HTTP 503 means the database is not configured, is unavailable or migrations are not applied.

## 6. Create the local owner

Set LOCAL_ADMIN_EMAIL, LOCAL_ADMIN_PASSWORD (12–256 characters) and optionally LOCAL_ADMIN_NAME in .env. Run once:

~~~bash
npm run db:bootstrap-admin
~~~

The script refuses to create another owner if an account already exists. Remove LOCAL_ADMIN_PASSWORD from .env immediately after successful bootstrap.

Only after migrations and owner bootstrap, set MYSQL_CATALOGUE_ENABLED=true in .env and restart the development server. Sign in at /owner/login.

## 7. Prepare and preview product photographs

Run:

~~~bash
npm run local:prepare
~~~

Place merchant-authorized originals under .local-data/imports/product-images/<verified-product-slug>/. Follow docs/PRODUCT-IMAGE-INTAKE.md and then run:

~~~bash
npm run media:preview
~~~

The preview is read-only. It checks product-folder slugs, image naming, duplicate sequence numbers, 12 MB size limit and supported file signatures. It does not write to MySQL, upload or publish images.

## 8. Preview Etsy source data privately

Copy the Etsy export into the ignored workspace:

~~~bash
cp /path/to/EtsyListingsDownload.csv .local-data/imports/etsy/EtsyListingsDownload.csv
npm run db:import-products -- ./.local-data/imports/etsy/EtsyListingsDownload.csv
~~~

This is a read-only preview. Review row counts, warnings, source SKU collisions, draft counts and photo references before any explicit local import. The importer requires both --commit and --confirm-local-import to write, and blocks remote/production-looking targets, an existing product catalogue and repeated source hashes. Do not add those flags until the preview is reviewed and the destination is confirmed disposable.

## 9. Paired MySQL and private-media backup

The local backup command creates one restore-point folder containing a MySQL SQL dump, a copy of the private filesystem media tree and a SHA-256 manifest. It is deliberately separate from application startup and never runs automatically.

Before backing up, stop the local application or otherwise ensure owner/customer writes and media changes are paused. MySQL uses a consistent single-transaction dump for transactional tables, and the tool verifies that private-media files did not change during copying; it does not place the whole application into maintenance mode.

Check the native command-line client tools:

```bash
command -v mysqldump
command -v mysql
```

The workflow requires local Oracle MySQL 8.0.16+ and local filesystem media. It refuses remote/MariaDB/production-looking databases, S3 media mode, public-folder paths, symbolic links, unsupported filesystem objects and a database without an applied Drizzle migration journal.

Run the read-only preflight first:

```bash
npm run db:backup
```

The default destination is .local-data/backups/restore-points/. An optional DAG_BACKUP_ROOT can point to a separate absolute directory, such as an encrypted external disk. Review the database identity, migration count, media file count and expected destination. A dry run writes no SQL dump or media files.

After confirming free space and the backup destination, create the paired backup explicitly:

```bash
npm run db:backup -- --commit --confirm-local-backup
```

Each backup folder contains:
- database.sql — MySQL dump without CREATE DATABASE, DROP DATABASE or USE statements.
- media/ — private products/ and editorial/ files, preserving their storage keys.
- manifest.json — source database/server identity, schema/migration counts, file sizes and SHA-256 checksums.

The bundle is uncompressed and not encrypted. Keep it on an encrypted, access-controlled disk and maintain a separate copy away from the development device. Do not email it or store it in Git, a public folder or a public object bucket. Ensure the target has sufficient free space for another full copy of the database and media library.

## 10. Isolated restore drill

A restore never targets DATABASE_URL. First create a new, empty, local MySQL database using an administrator-approved MySQL session, then grant the intended restore application user access to it. Do not use an existing application, production or customer database. Configure its loopback connection in the private .env as DAG_RESTORE_DATABASE_URL; also choose a brand-new absolute media directory that does not exist.

Example configuration (use a unique local password):

```dotenv
DAG_RESTORE_DATABASE_URL=mysql://dag_restore:YOUR_LOCAL_SECRET@127.0.0.1:3306/desert_gallery_restore
```

Run a read-only restore preflight:

```bash
npm run db:restore -- --backup ".local-data/backups/restore-points/<backup-id>" --target-media "/absolute/path/desert-gallery-restore-media"
```

The preflight verifies the complete backup manifest and every SQL/media checksum, ensures the target database is different and empty, checks compatible Oracle MySQL version and validates the new media target. It does not create tables, import SQL or write media.

After reviewing the target database and path, explicitly restore:

```bash
npm run db:restore -- --backup ".local-data/backups/restore-points/<backup-id>" --target-media "/absolute/path/desert-gallery-restore-media" --commit --confirm-local-restore
```

The restore copies media to a private staging directory and imports SQL only into the separately configured empty database. It never drops a database, alters the source database, overwrites the current media root or edits .env. Verify the restored database and media together before changing local application settings.

If the MySQL import fails after it begins, the isolated target database may be partially populated. The tool does not drop it. Inspect the named target and only then manually drop/recreate that specific disposable restore database before retrying. If the database import succeeds but media promotion fails, the output identifies the isolated database and retained staging media path; do not use that pair until reconciled.

Limitations: this workflow backs up file-backed MEDIA_STORAGE_DRIVER=local media only. It stops when MEDIA_STORAGE_DRIVER=s3; remote object storage needs a separately designed and tested backup/versioning policy. It is a logical SQL + file backup, not a physical backup of the native MySQL server data directory. CI exercises the commands against disposable MySQL databases and temporary files; it does not prove a backup/restore on the owner's workstation or selected hosting plan. Complete a real local restore drill and record the result before any hosting cutover.

## Storage map

| Path | Purpose | Git |
| --- | --- | --- |
| .env | Local credentials and feature flags | Ignored |
| .local-data/mysql/ | Reserved native MySQL data directory | Ignored |
| .local-data/media/ | Application-managed private media | Ignored |
| .local-data/imports/ | Private CSV and original photo intake | Ignored |
| .local-data/backups/ | Reserved database and media backups | Ignored |

A directory existing does not mean the database or backup process uses it. Confirm the native MySQL server's actual data directory and complete a tested backup/restore before treating this workstation as a verified data store. Production hosting, migrations and durable hosted media remain out of scope until local acceptance is complete.
