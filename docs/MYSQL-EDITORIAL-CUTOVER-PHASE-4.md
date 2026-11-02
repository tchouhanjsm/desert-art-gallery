# MySQL Editorial CMS Cutover — Phase 4

**Status:** Implemented on the feature branch; CI and live local MySQL acceptance pending  
**Scope:** MySQL/Drizzle persistence for homepage, collections, collection-product curation, maker profiles, journal and their editorial media  
**Authentication:** Existing Supabase Auth remains in place  
**Deployment:** Local validation only; no Hostinger deployment or production data changes

## 1. Architecture decision

This is a staged backend cutover, not a replacement of the whole commerce platform.

| Capability | Current backend after this phase |
|---|---|
| Owner login and admin-role verification | Existing Supabase Auth and `profiles.role` |
| Homepage hero content | MySQL + Drizzle |
| Collections and publication state | MySQL + Drizzle |
| Collection-to-product curation | MySQL + Drizzle, keyed by existing product slug |
| Maker profiles | MySQL + Drizzle |
| Journal posts | MySQL + Drizzle |
| Editorial image files | Persistent filesystem under `MEDIA_STORAGE_ROOT` |
| Product records, product media and inventory | Existing Supabase |
| Customer accounts, addresses, cart, wishlist | Existing Supabase |
| Orders, checkout, fulfilment and payment state | Existing Supabase |
| Product-to-collection source data during import | Supabase relationship is imported to MySQL as product slugs |

The application chooses the editorial data backend based on `DATABASE_URL`:

- Unset: retain the existing Supabase CMS data and Supabase Storage implementation.
- Set: use the MySQL editorial repositories and filesystem media adapter.

Keep the existing Supabase URL, anonymous key and service-role key configured while this staged approach is in use. The service-role key is required only by the one-time import script and must remain server-side.

## 2. MySQL schema and runtime

New runtime dependencies:

- `mysql2` connection pool with a small connection limit.
- `drizzle-orm` for typed repository operations.
- `drizzle-kit` for versioned schema migrations.
- `tsx` for the one-time TypeScript import utility.

The initial MySQL migration creates:

- `site_content`
- `collections`
- `collection_product_links`
- `artisan_profiles`
- `journal_posts`

The collection-product link table stores the existing product slug rather than copying product data into MySQL. A foreign key protects its collection reference; product availability continues to be verified against the current Supabase product catalogue.

The migration uses InnoDB, `utf8mb4`, and CHECK constraints for rights evidence, alt text, journal status and experience range. Use a MySQL release that enforces CHECK constraints (MySQL 8.0.16 or later). Confirm the exact database engine/version supplied by the target hosting plan before applying this migration there.

## 3. Local environment

Copy the example environment file:

```bash
cp .env.example .env
```

Configure these values in the local `.env`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY

DATABASE_URL=mysql://USER:URL_ENCODED_PASSWORD@127.0.0.1:3306/DATABASE_NAME
MEDIA_STORAGE_ROOT=
```

Use the MySQL host supplied by your database provider. For Hostinger's documented Node.js shared-hosting setup, the guidance specifies `127.0.0.1` rather than `localhost`; verify the actual database hostname and port in the hosting control panel before configuring it.

Special characters in the database username/password must be URL-encoded. Do not commit `.env` or share secret values in chat.

For local development, leaving `MEDIA_STORAGE_ROOT` empty writes files under the ignored `.local-data/media` directory. Production mode requires `MEDIA_STORAGE_ROOT` to be an explicit absolute path.

## 4. Apply the MySQL migration

Create the empty database and a database user with permission to create/alter tables during migration and read/write the CMS tables at runtime.

Load the environment into the current shell, then run:

```bash
set -a
source .env
set +a

npm install
npm run db:migrate
```

Drizzle stores migration history in its own migration table. Do not manually mark migration 0000 as applied. The schema contract tests verify the migration file and journal, but they do not execute DDL against a live MySQL engine.

## 5. One-time Supabase editorial import

The importer transfers only:

- Homepage content record.
- Collection records and their published/draft state.
- Product-to-collection assignments, translated from product IDs to the product slugs still used by the Supabase catalogue.
- Maker profiles.
- Journal posts.
- Files referenced by homepage, collection, maker and journal media fields.

It does **not** import products, stock, customers, user accounts, addresses, carts, orders, payments or payment events. Those continue to use the existing Supabase backend.

The importer is deliberately dry-run by default:

```bash
npm run db:import-editorial
```

Review the counts and the editorial media object total. The commit form requires an explicit flag:

```bash
npm run db:import-editorial -- --commit
```

Safety rules:

- It refuses to import into non-empty editorial tables.
- A completion marker prevents an accidental second import from overwriting subsequent owner edits.
- It validates that a media path belongs to the expected editorial record.
- It downloads only referenced files from the private `product-media` bucket.
- It verifies the image extension, MIME type, file signature and 12 MB size limit before writing.
- Media files are copied before the SQL transaction; newly copied files are removed if the database transaction fails.
- Legacy rights approval is revoked when an image has no evidence reference or descriptive alt text. The owner must review and reconfirm it.
- Product relationships are imported by slug; the product rows themselves are not copied.

If the target database already contains CMS content, stop and plan a reviewed merge. This importer intentionally refuses to merge or overwrite a populated destination.

## 6. Start the MySQL-backed local application

After migration and the reviewed import, keep `DATABASE_URL` set in `.env`, and run:

```bash
npm run dev
```

Review:

- `/admin/content` — homepage, collection, maker and journal editing.
- Collection records — assign active catalogue products to collections.
- `/` — verify published homepage content and collection cards.
- `/collections/{slug}` — verify collection product membership and approved hero imagery.
- `/artisans` and `/journal` — verify approved public content.
- `/media/{editorial-path}` — public image requests are served only while the database confirms the related record is published and image rights, evidence and alt text are present.
- `/api/admin/media/{editorial-path}` — owner-only media preview. This route checks the existing Supabase authenticated user and admin/owner role.

The CMS's server actions verify the owner role before writing. Middleware now fails closed for `/admin` and `/account` when the existing identity provider is not configured.

## 7. Persistent media requirements

The filesystem adapter:

- Uses UUID-based media filenames.
- Rejects traversal and paths outside `editorial/{target}/{record-id}/`.
- Writes through a temporary file and atomic rename.
- Uses restrictive directory/file permissions.
- Serves public media only after publication and rights approval.
- Requires an explicit absolute media root in production.

Do not assume an application workspace or deployment directory is persistent. Before Hostinger deployment, verify that the configured media directory survives application restarts, redeployments and backup/restore. Keep a separate backup of the media directory alongside the MySQL database backup.

## 8. Validation and limits

Automated checks added for this phase cover:

- MySQL migration tables, indexes, collection membership and constraints.
- Drizzle migration journal.
- Media path traversal, UUID storage keys and filesystem write/read/delete.
- Production requirement for an absolute media directory.
- Dry-run/explicit-commit import behavior.
- Empty-target and one-time import safeguards.
- Scope of imported entities and collection assignments.
- Middleware fail-closed authentication contract.

The CI pipeline can validate TypeScript, tests, lint and production compilation, but it cannot prove that the migration executes correctly on your local MySQL server or that the target hosting filesystem is durable. Those require the local acceptance steps above.

## 9. Explicit non-goals for this phase

- No migration of Supabase authentication or role records.
- No migration of product, inventory, customer, order, checkout or payment data.
- No payment gateway activation.
- No Hostinger plan purchase, production connection or deployment.
- No claim that a production filesystem path is already confirmed.
- No deletion or mutation of the source Supabase data.

## 10. Next backend milestone

Once this CMS slice is proven locally, continue with product and inventory repository migration, followed by customer accounts and order/checkout migration. Keep each cutover isolated and preserve the currently working Supabase commerce path until its corresponding MySQL replacement has been tested end-to-end.
