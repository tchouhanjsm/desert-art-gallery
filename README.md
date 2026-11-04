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

Recovered originals are kept out of Git and staged only after explicit owner approval. The read-only mapping review can be turned into private importer-compatible copies with `npm run media:stage-recovered`; it never modifies the recovered originals or writes product-media rows. See docs/PRODUCT-IMAGE-INTAKE.md.

Place authorized original photographs under .local-data/imports/product-images/<verified-product-slug>/ and run npm run media:preview. The read-only preview checks filenames, supported image signatures, size and sequence rules. It does not upload or publish photos. See docs/PRODUCT-IMAGE-INTAKE.md.

## Site URL and contact identity

Local development uses http://localhost:3000 as the default site origin. NEXT_PUBLIC_SITE_URL drives metadata, robots and sitemap URLs. Before production deployment, set it to the gallery's verified official HTTPS origin. Do not use an unconfirmed domain as a canonical URL.

The public contact page intentionally does not display an email address until the gallery's official contact channel has been confirmed.

## Self-hosted MySQL owner workspace

The MySQL/Drizzle editorial cutover and one-time legacy content import are documented in docs/MYSQL-EDITORIAL-CUTOVER-PHASE-4.md.

The catalogue, variants, product media and inventory services are added as a separately gated migration in docs/MYSQL-CATALOGUE-MIGRATION-PHASE-5.md. The MySQL owner workspace uses local owner accounts and hashed, expiring sessions; it does not require Supabase Auth. The optional customer identity mode uses separate customer records and sessions and is gated by MYSQL_CUSTOMER_AUTH_ENABLED=true together with MYSQL_CATALOGUE_ENABLED=true. Email verification and recovery delivery are not enabled.

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

The CSV importer accepts the standard product-template CSV and Etsy's native Listings Download export. Preview with npm run db:import-products -- ./.local-data/imports/EtsyListingsDownload.csv; the command is read-only unless both --commit --confirm-local-import are supplied. The MySQL owner workspace also provides the same preview-and-confirm workflow at /admin/products/import, linked from the Products page. Writes are blocked for production/live database names, non-empty product catalogues and previously imported source hashes. Etsy rows remain separate drafts with tags, source metadata and opening stock preserved. Etsy source photo URLs are references only: images are not downloaded and image rights are not assumed. See docs/ETSY-LISTINGS-IMPORT.md.

No live data is imported automatically, and no production deployment or payment provider is enabled by these scripts.

## CI

The Next.js build uses standalone output. CI packages the traced Node.js runtime, static assets and tracked public assets into `desert-art-gallery-staging.tar.gz` for seven days. The artifact excludes local databases, credentials, recovered product photographs and application-managed media. See docs/CI-RELEASE-ARTIFACT.md for runtime and staging requirements.

Media storage uses local `.local-data/media` by default. The same storage interfaces can use a private S3-compatible bucket for managed staging/production by setting `MEDIA_STORAGE_DRIVER=s3`; product and editorial objects continue through the app's protected media routes. The `/api/health` response validates media configuration but does not claim to have tested the remote bucket. See docs/CI-RELEASE-ARTIFACT.md before configuring a live bucket.
Do not switch an existing deployment from filesystem media to S3 until every stored object has been copied, hash-verified and reconciled against its MySQL media key; changing the driver alone does not migrate files.

Pull-request CI runs against a GitHub-managed MySQL service and validates migrations, typecheck, tests, lint and production build. This hosted service does not require a local database container runtime on the developer device. A successful build also publishes a short-lived self-hosted Node.js staging artifact.


The MySQL customer order lifecycle and merchant shipping/tax configuration are documented in docs/MYSQL-ORDER-CHECKOUT-PHASE-7.md. Keep payment processing disabled until the provider/webhook security phase is reviewed and enabled separately.
