# Desert Art Gallery

An editorial commerce experience for rare heritage textiles and handcrafted pieces from Jaisalmer, Rajasthan.

## Local development

~~~bash
npm install
npm run local:prepare
npm run dev
~~~

Do not publish guessed prices, measurements, stock, artisan biographies, shipping promises, reviews or policy terms. Seed product records are inquiry-only examples; replace them with verified merchant data before sale. Obtain and store authorized original product images instead of hotlinking assets.

See data/product-import-template.csv and docs/production-readiness.md for catalogue and launch requirements.

## Native local MySQL development

Local development uses a native Oracle MySQL server (8.0.16 or newer); Docker and Compose are not part of the developer workflow. The application connects through DATABASE_URL. Native MySQL installation and service management are device-specific, so inspect the installed OS, architecture and MySQL distribution before installing or changing a service.

Run npm run local:prepare to create the ignored .local-data workspace, npm run db:ping to test loopback connectivity, npm run db:status to inspect server version and migration state, and npm run db:migrate to apply schema migrations. See docs/LOCAL-MYSQL-DEVELOPMENT.md for setup and safety requirements.

The private workspace reserves .local-data/mysql for a dedicated local MySQL data directory, .local-data/media for application-managed media, .local-data/imports for private source files and .local-data/backups for backups. None of these private files should be committed. The prepare command does not initialize or move an existing database. A native MySQL installation may keep its data in a system-managed directory until a separate instance is safely configured for the project directory. Do not repoint or reinitialize an existing database as a shortcut.

## Product photography intake

Place authorized original photographs under .local-data/imports/product-images/<verified-product-slug>/ and run npm run media:preview. The read-only preview checks filenames, supported image signatures, size and sequence rules. It does not upload or publish photos. See docs/PRODUCT-IMAGE-INTAKE.md.

## Site URL and contact identity

Local development uses http://localhost:3000 as the default site origin. NEXT_PUBLIC_SITE_URL drives metadata, robots and sitemap URLs. Before production deployment, set it to the gallery's verified official HTTPS origin. Do not use an unconfirmed domain as a canonical URL.

The public contact page intentionally does not display an email address until the gallery's official contact channel has been confirmed.

## Self-hosted MySQL owner workspace

The MySQL/Drizzle editorial cutover and one-time legacy content import are documented in docs/MYSQL-EDITORIAL-CUTOVER-PHASE-4.md.

The catalogue, variants, product media and inventory services are added as a separately gated migration in docs/MYSQL-CATALOGUE-MIGRATION-PHASE-5.md. The MySQL owner workspace uses local owner accounts and hashed, expiring sessions; it does not require Supabase Auth.

### First local owner

1. Create a disposable local MySQL database and set DATABASE_URL.
2. Copy .env.example to .env only when .env does not already exist; set LOCAL_ADMIN_EMAIL, LOCAL_ADMIN_PASSWORD (12+ characters) and LOCAL_ADMIN_NAME.
3. Run npm run db:migrate.
4. Run npm run db:bootstrap-admin once. The command refuses to create another owner if an account already exists.
5. Remove LOCAL_ADMIN_PASSWORD from the environment and local secret file after bootstrap.
6. Set MYSQL_CATALOGUE_ENABLED=true and start the application. Sign in at /owner/login.

Owner passwords are stored as salted scrypt hashes; sessions use random httpOnly cookies while only SHA-256 token digests are stored in MySQL. Five failed login attempts trigger a temporary lockout.

### Migration boundaries

The MySQL catalogue and owner product management are opt-in. Existing customer-account, customer-order and some fulfilment routes are not fully migrated in this phase. Optional Supabase credentials are retained only for reading old source data during the one-time editorial import. No target MySQL owner session depends on Supabase Auth.

The CSV importer accepts the standard product-template CSV and Etsy's native Listings Download export. Preview with npm run db:import-products -- ./.local-data/imports/EtsyListingsDownload.csv; the command is read-only unless both --commit --confirm-local-import are supplied. Writes are blocked for production/live database names, non-empty product catalogues and previously imported source hashes. Etsy rows remain separate drafts with tags, source metadata and opening stock preserved. Etsy source photo URLs are references only: images are not downloaded and image rights are not assumed. See docs/ETSY-LISTINGS-IMPORT.md.

No live data is imported automatically, and no production deployment or payment provider is enabled by these scripts.

## CI

Pull-request CI runs against a GitHub-managed MySQL service and validates migrations, typecheck, tests, lint and production build. This hosted service does not require a local database container runtime on the developer device.
