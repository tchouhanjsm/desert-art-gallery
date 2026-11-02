# MySQL Catalogue Migration — Phase 5

**Status:** MySQL catalogue, owner product workflow and local owner-session foundations implemented; final CI and local acceptance remain required. Do not enable against production.
**Base:** merged PR #5, main commit `448b7cf`.
**Scope:** catalogue, categories, product media metadata, variants, inventory movements, stock reservations, local owner accounts and admin sessions.
**Active runtime boundary:** MySQL catalogue/owner mode is opt-in via `MYSQL_CATALOGUE_ENABLED=true`; existing non-migrated customer/order routes remain legacy.

## Architecture

The self-hosted application database is MySQL via Drizzle and mysql2. Owner access uses local `admin_users` and `admin_sessions` tables. Passwords are stored as salted scrypt hashes. The browser receives an httpOnly, secure-in-production, sameSite=lax cookie containing a random session token; only its SHA-256 digest is stored in MySQL. Owner sessions expire after eight hours. Five consecutive password failures temporarily lock the owner account.

The public MySQL catalogue adapter only returns published products with at least one image whose exact media record has confirmed rights, evidence and descriptive alt text. Public media delivery repeats the exact record/product publication check before reading bytes from the filesystem.

The existing customer-account, customer-order and some fulfilment routes are not fully moved to MySQL in this phase. Do not describe the entire application as Supabase-free yet. Optional Supabase credentials may be used by the one-time editorial importer to read old source records; they are not used for MySQL owner sign-in or MySQL catalogue writes.

## First local owner

1. Start a disposable MySQL 8.0.36+ database.
2. Set `DATABASE_URL` and `MEDIA_STORAGE_ROOT`.
3. Set `LOCAL_ADMIN_EMAIL`, `LOCAL_ADMIN_PASSWORD` (12 to 256 characters) and optionally `LOCAL_ADMIN_NAME`.
4. Run `npm run db:migrate`.
5. Run `npm run db:bootstrap-admin` once. The script refuses to bootstrap if any owner account already exists.
6. Remove `LOCAL_ADMIN_PASSWORD` from the environment after bootstrap.
7. Set `MYSQL_CATALOGUE_ENABLED=true`, start the site and sign in at `/owner/login`.

Never commit a real password, token, database URL or session cookie.

## Schema introduced

- `product_categories` and `product_category_links`
- `products` with stable legacy ID, canonical slug, integer minor-unit price, currency, lifecycle, measurements, provenance and SEO fields
- `product_variants` with nullable SKU, structured attributes, variant price and stock
- `product_media` metadata referencing a separate product-media storage namespace
- `inventory_movements` with unique idempotency reference
- `inventory_reservations` and `inventory_reservation_items`, including reserved, released, expired and consumed states
- `admin_users` and `admin_sessions` for local owner authentication

## Catalogue and inventory behaviour

- Public catalogue reads use the MySQL repository only when `MYSQL_CATALOGUE_ENABLED=true`; otherwise the legacy adapter remains available.
- Product owner operations include draft create/edit/archive, category assignment, variant create/edit, media upload, image rights confirmation/revocation and publication gates.
- New products receive a default Standard variant with zero stock.
- Stock adjustments lock the variant, preserve an append-only movement record, enforce non-negative balances, respect open reservations, and cap one-of-a-kind stock at one.
- Reservations are idempotent, time-bounded, row-locked and variant-aware. Consumption deducts stock and writes one ledger movement exactly once.
- Product media storage keys are validated before reading. Rights revocation and unpublishing deny public delivery.

## Apply and validate locally

1. Use a disposable MySQL database and a private local media directory.
2. Run `npm run db:migrate`.
3. Run `npm run db:bootstrap-admin` once after setting owner bootstrap variables.
4. Run `npm test` and `npm run test:db`.
5. Enable `MYSQL_CATALOGUE_ENABLED=true` only for local owner/browser acceptance.
6. Create a verified draft product, assign existing category slugs, add a variant and opening stock, upload an original image, confirm its actual usage rights, and publish it.
7. Verify storefront listing/detail, rights revocation, reservation idempotency, release, expiry and consume-once behaviour.
8. Back up MySQL and the media directory, then restore both into a clean disposable destination before any hosting cutover.

Never run this migration or bootstrap against production until a separate reviewed cutover plan and backup/restore test exist.

## Remaining work

- Finish final PR CI on the exact branch head and resolve every check failure.
- Complete adapter contracts and a dry-run-first catalogue/inventory importer that preserves variant relationships, media, rights metadata, opening balances and movement history.
- Add tested backup/restore scripts and an owner acceptance record.
- Migrate customer identity, addresses, cart, wishlist, orders, payment reconciliation, refunds and fulfilment in separate reviewed slices.
- Validate Hostinger compatibility and filesystem durability before a production cutover.

No customer or order data is migrated in this phase. No payment provider is activated. No live import, production write or deployment runs automatically.
