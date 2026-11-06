# Desert Art Gallery

A curated, English-language ecommerce store for textiles and handcrafted objects from Jaisalmer, Rajasthan. Japanese retail references inform presentation only. The commercial target market remains pending explicit owner confirmation; do not infer country, currency, tax, shipping or address rules from the design references.

## Product, UX and design source of truth

**Read first:** [Japan-First Ecommerce Redesign](docs/JAPAN-ECOMMERCE-REDESIGN.md). This is the controlling brief for the public storefront, English-language storefront and source-content preservation, customer journeys, visual references, route map, acceptance gates and future redesign work. A dated owner clarification says India is the market and Japan is inspiration only, while later historical sections describe Japan as the customer market. Treat the dated clarification as operative for presentation work; owner confirmation is required before market-specific commerce changes. The former Desert Atelier / Desert Modern public themes are superseded. See [Storefront Design System](docs/STOREFRONT-DESIGN-SYSTEM.md), [Quality Gates](docs/STOREFRONT-QUALITY-GATES.md) and [Production Readiness](docs/production-readiness.md) for implementation status.

Product data and photography must remain evidence-led: the Etsy export contains USD source prices and English text; do not automatically convert currency or machine-translate product claims. Keep products as drafts until identity, content, image rights and merchant policies are reviewed.

## Local development

**Runtime standard:** Node.js 22.x (see `.nvmrc` and the `engines` field in `package.json`). Use the npm version bundled with that Node.js release; do not install npm globally as a separate setup step.

For a fresh checkout, or after an intentional dependency-manifest/lockfile change, install the exact committed dependency tree once:

~~~bash
nvm use
npm ci
npm run local:prepare
~~~

For normal development and branch switches, do not reinstall dependencies. Start the app directly:

~~~bash
npm run dev
~~~

Run `npm ci` again only when the committed `package.json` or `package-lock.json` changed and the local dependency tree needs to be synchronized. CI uses the same Node 22 standard and `npm ci`, so an uncommitted or stale dependency resolution cannot silently pass as the canonical build.

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


## Japanese-inspired storefront visual review

Start the local app with its intended local MySQL and media configuration, then install the Playwright browser once and capture the full route/viewport matrix:

```bash
npx playwright install chromium
npm run visual:review
```

The script requires a healthy `/api/health` response. Override `STOREFRONT_REVIEW_BASE_URL` to review another local/staging URL and `STOREFRONT_REVIEW_OUTPUT_DIR` to choose a separate output folder. Screenshots and the JSON manifest are written under ignored `.local-data/visual-review/`; they are not committed. CI adds a synthetic published product/collection fixture to exercise real MySQL-backed routes, rights-checked media, the two-image gallery and a populated pre-checkout bag. The seeder is hard-locked to the disposable GitHub Actions database and media directory; it is not a local or production data command. Generated images and test price are not merchant content. The capture remains unauthenticated and does not replace owner-approved product/photo review, signed-in UAT, accessibility review or staging sign-off.


## Presentation layer ownership

The active public presentation is owned by `src/styles/japan-storefront.css`; neutral reset rules and base font tokens remain in `src/app/globals.css`; the separate owner workspace is styled by `src/styles/admin-theme.css`. The root `src/app/layout.tsx` is the single entry point for these global stylesheets. Do not add a second public theme or import global styles from page/component files.

The superseded `theme.css`, `phase1.css`, `editorial.css` and inactive `admin.css` layers were removed after auditing the App Router and component source tree. Shared `StorefrontPageHeading` and `StorefrontSectionHeading` components standardise public heading semantics while preserving route-specific classes. Category counts in homepage discovery and shop filters are derived from the exact catalogue records supplied to those views; they are not seeded or hard-coded.


## Local backup and recovery

Create a private, checksummed MySQL and local-media backup with `npm run local:backup`, verify it later with `npm run local:backup:verify -- <backup-id>`, and restore only into an explicitly confirmed empty local database and media directory with `npm run local:restore`. Read [Local Backup and Restore](docs/LOCAL-BACKUP-RESTORE.md) before running recovery commands. The local tools refuse remote/production database targets and do not back up S3-compatible media.
