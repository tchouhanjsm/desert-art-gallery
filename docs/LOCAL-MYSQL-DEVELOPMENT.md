# Local MySQL development setup

This project supports a local-first MySQL environment. The optional Compose service keeps the database's physical files inside the repository's ignored .local-data/mysql directory. Code, migrations and the environment template remain tracked; secrets, database files, private images, exports and backups do not.

## Requirements

- Docker Desktop, or Docker Engine with the Compose plugin.
- Node.js 22 or a compatible supported Node release.
- npm.
- A host MySQL client is optional; the Compose service provides MySQL and its health check.

## 1. Create the private local workspace

Run from the repository root:

~~~bash
mkdir -p .local-data/mysql .local-data/media .local-data/imports .local-data/backups
cp .env.example .env
~~~

The repository .gitignore excludes .env and all of .local-data/.

## 2. Set unique local database credentials

Generate two separate high-entropy hexadecimal secrets:

~~~bash
openssl rand -hex 24
openssl rand -hex 24
~~~

Edit .env and replace the two secret placeholders. Use the first value for MYSQL_ROOT_PASSWORD; use the second for MYSQL_PASSWORD and the password portion of DATABASE_URL.

~~~dotenv
MYSQL_ROOT_PASSWORD=YOUR_FIRST_48_CHARACTER_HEX_SECRET
MYSQL_DATABASE=desert_art_gallery
MYSQL_USER=dag_local
MYSQL_PASSWORD=YOUR_SECOND_48_CHARACTER_HEX_SECRET
MYSQL_HOST_PORT=3306
DATABASE_URL=mysql://dag_local:YOUR_SECOND_48_CHARACTER_HEX_SECRET@127.0.0.1:3306/desert_art_gallery
MEDIA_STORAGE_ROOT=
MYSQL_CATALOGUE_ENABLED=false
NEXT_PUBLIC_SITE_URL=http://localhost:3000
~~~

Hexadecimal passwords contain no URL-reserved characters, so they can be copied into DATABASE_URL without additional encoding. Node's .env parser does not interpolate one variable into another: update DATABASE_URL explicitly rather than writing $MYSQL_PASSWORD there.

Leave MEDIA_STORAGE_ROOT empty for local development. The application stores editorial and product images under .local-data/media automatically. If set explicitly, it must be an absolute path.

If port 3306 is already in use, set MYSQL_HOST_PORT=3307 and change DATABASE_URL to use port 3307. Compose binds only to 127.0.0.1, not to the public network.

## 3. Start and inspect MySQL

~~~bash
npm run db:up
npm run db:status
npm run db:logs
~~~

Wait until MySQL reports healthy. The first start initializes .local-data/mysql; later restarts reuse the same database directory.

Stop MySQL without deleting its data:

~~~bash
npm run db:stop
~~~

Do not delete .local-data/mysql unless you intentionally want to destroy this local database. Do not use destructive volume/prune commands as a routine stop procedure.

## 4. Apply the database migrations

~~~bash
npm run db:migrate
~~~

The migration script loads .env when it exists. CI or a deployment environment can continue to inject DATABASE_URL directly without needing an .env file.

After starting the application, check its local HTTP and MySQL readiness without exposing credentials:

~~~bash
curl -i http://localhost:3000/api/health
~~~

A ready local MySQL application returns HTTP 200 with application, database and migration checks all healthy. HTTP 503 means the database is not configured, is unavailable, or migrations have not been applied. The response deliberately omits database hostnames, credentials and raw SQL errors.

## 5. Create the local owner

Set LOCAL_ADMIN_EMAIL, LOCAL_ADMIN_PASSWORD (12–256 characters) and optionally LOCAL_ADMIN_NAME in .env. Then run once:

~~~bash
npm run db:bootstrap-admin
~~~

The script refuses to create another owner if an owner record already exists. Remove LOCAL_ADMIN_PASSWORD from .env immediately after successful bootstrap.

Only after migrations and owner bootstrap, set MYSQL_CATALOGUE_ENABLED=true in .env and restart the development server.

## 6. Keep Etsy source files private and preview first

Copy the export into the ignored local workspace:

~~~bash
cp /path/to/EtsyListingsDownload.csv .local-data/imports/EtsyListingsDownload.csv
npm run db:import-products -- ./.local-data/imports/EtsyListingsDownload.csv
~~~

This is a read-only preview. Review all 527 rows, warnings, source SKU collisions, draft counts and image references before any explicit local import. The importer requires both --commit and --confirm-local-import to write, and blocks remote/production-looking targets, an existing product catalogue and repeated source hashes. Do not add those flags until the preview is reviewed and the local database is confirmed disposable.

## Storage map

| Path | Purpose | Git |
| --- | --- | --- |
| .env | Local credentials and feature flags | Ignored |
| .local-data/mysql/ | MySQL physical database files | Ignored |
| .local-data/media/ | Editorial and product image files | Ignored |
| .local-data/imports/ | Etsy and other source exports | Ignored |
| .local-data/backups/ | Local backup files | Ignored |

The Compose definition itself is version-controlled and contains no credentials or database contents. Hostinger deployment, production data migration and durable hosted media remain out of scope until local acceptance and backup/restore tests are complete.
