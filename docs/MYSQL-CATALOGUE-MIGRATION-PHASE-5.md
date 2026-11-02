# MySQL Catalogue Migration — Phase 5

**Status:** Schema and integration-test foundation in progress. Do not enable for production.
**Base:** merged PR #5, main commit `448b7cf`.
**Scope:** catalogue, categories, product media metadata, variants, inventory movements and stock reservations.
**Active commerce adapter:** existing Supabase until local acceptance and explicit owner-approved cutover.

## Architecture boundary

This phase adds a MySQL schema for the existing product and inventory domain. It does not switch the public catalogue or owner actions to MySQL, and it does not migrate customers, addresses, orders, payments or authentication. No production traffic is redirected.

## Apply locally

1. Start a disposable MySQL 8.0.36+ database.
2. Set `DATABASE_URL` and `MEDIA_STORAGE_ROOT` in the local environment.
3. Run `npm run db:migrate`.
4. Run `npm test` and `npm run test:db`.
5. Inspect tables, indexes and constraints before proceeding to adapter implementation.

Never run this migration on production until a separate reviewed cutover plan and backup/restore test exist.

## Schema introduced

- `product_categories` and `product_category_links`
- `products` with stable legacy ID, canonical slug, minor-unit price, currency, lifecycle and SEO fields
- `product_variants` with unique SKU, structured attributes, variant price and stock
- `product_media` metadata referencing the media storage interface
- `inventory_movements` with unique idempotency reference
- `inventory_reservations` and `inventory_reservation_items`

Stock changes must be implemented through transactional services that lock affected variants, prevent negative inventory and record a movement with a unique idempotency reference. The table schema alone is not an inventory service.

## Import boundary

The existing Supabase catalogue remains authoritative during this foundation. The importer is not executed automatically. A later importer must preserve IDs or produce an auditable mapping, source counts/digests, images and rights metadata, variant relationships, stock opening balances and movement history. It must default to dry-run, require explicit `--commit`, refuse a populated destination and roll back SQL and copied media on failure.

## Remaining work

- MySQL product/category/variant repositories and server-side services.
- Row-locked stock adjustments and variant-aware reservations.
- Adapter contracts shared with the existing Supabase implementation.
- Product/media upload and deletion lifecycle.
- Owner product CRUD and catalogue diagnostics under a disabled-by-default local feature flag.
- Real importer with dry-run and explicit commit.
- Backup/restore scripts and owner/browser acceptance.
- Local disposable MySQL execution and end-to-end storefront verification.

No payment, customer, order or account migration is part of this phase.
