# Desert Art Gallery

An editorial commerce experience for rare heritage textiles and handcrafted pieces from Jaisalmer, Rajasthan.

## Local development

```bash
npm install
npm run dev
```

Do not publish guessed prices, measurements, stock, artisan biographies, shipping promises, reviews or policy terms. Seed product records are inquiry-only examples; replace them with verified merchant data before sale. Obtain and store authorized original product images instead of hotlinking assets.

See `data/product-import-template.csv` and `docs/production-readiness.md` for catalogue and launch requirements.

## Self-hosted MySQL owner workspace

The MySQL/Drizzle editorial cutover and one-time legacy content import are documented in [MySQL Editorial CMS Cutover — Phase 4](docs/MYSQL-EDITORIAL-CUTOVER-PHASE-4.md).

The catalogue, variants, product media and inventory services are added as a separately gated migration in [MySQL Catalogue Migration — Phase 5](docs/MYSQL-CATALOGUE-MIGRATION-PHASE-5.md). The MySQL owner workspace uses local owner accounts and hashed, expiring sessions; it does not require Supabase Auth.

### First local owner

1. Create a disposable local MySQL database and set `DATABASE_URL`.
2. Copy `.env.example` to `.env`, set `LOCAL_ADMIN_EMAIL`, `LOCAL_ADMIN_PASSWORD` (12+ characters) and `LOCAL_ADMIN_NAME`.
3. Run `npm run db:migrate`.
4. Run `npm run db:bootstrap-admin` once. The command refuses to create another owner if an account already exists.
5. Remove `LOCAL_ADMIN_PASSWORD` from the process environment and local secret file after bootstrap.
6. Set `MYSQL_CATALOGUE_ENABLED=true` and start the application. Sign in at `/owner/login`.

Owner passwords are stored as salted scrypt hashes; sessions use random httpOnly cookies while only SHA-256 token digests are stored in MySQL. Five failed login attempts trigger a temporary lockout.

### Migration boundaries

The MySQL catalogue and owner product management are opt-in. The existing legacy customer-account, customer-order and some fulfilment routes are not fully migrated in this phase. Optional Supabase credentials are retained only for reading the old source during the one-time legacy editorial import. No target MySQL owner session depends on Supabase Auth.

To seed the local catalogue from the supplied CSV template, first run `npm run db:import-products -- ./catalogue.csv` (read-only preview). A database write requires both `--commit --confirm-local-import` and is blocked for production/live database names or a non-empty catalogue. Imported products remain drafts without approved images.

No live data is imported automatically, and no production deployment or payment provider is enabled by these scripts.
