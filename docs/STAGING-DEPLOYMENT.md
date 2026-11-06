# Staging environment and owner dashboard

This guide prepares a **separate soft-launch environment** for Desert Art Gallery. It is not permission to change production DNS, production database records, payment settings or the live storefront.

## Staging objective

Use a dedicated staging hostname such as `staging.<verified-gallery-domain>`:

- `https://staging.<verified-gallery-domain>/` — private staging storefront.
- `https://staging.<verified-gallery-domain>/admin` — authenticated MySQL owner dashboard.
- `https://staging.<verified-gallery-domain>/owner/login` — local owner sign-in.
- `https://staging.<verified-gallery-domain>/api/health` — application/database/migration readiness.

Use a separate staging database and persistent media directory. Never point this deployment at the local development database or the live production database.

## What is implemented in MySQL mode

The staging owner dashboard is backed by the application MySQL database:

- Overview — total, published, draft and archived catalogue counts; recent orders; low-stock alerts; photographs awaiting rights review.
- Products — draft and published product management, variants, inventory, image metadata and product-level rights review.
- Orders — order draft and fulfilment records. Payment execution is not enabled.
- Shipping & tax — owner-only configuration screens. Only merchant-approved destination rules should be entered.

Customer administration, the full editorial CMS and the standalone media library remain separate MySQL milestones. Do not expose a MySQL navigation link to an unfinished module. Product photography remains manageable inside each MySQL product editor.

The MySQL owner session uses a hashed random token in an HTTP-only cookie and a hashed password in the `admin_users` table. Create a distinct staging owner; do not copy the production owner password into staging.

## Hosting/database compatibility gate

This application currently requires **Oracle MySQL 8.0.16 or newer**. It rejects MariaDB and old MySQL versions in its MySQL runtime checks. Verify the actual server identity with `SELECT VERSION(), @@version_comment;` before applying migrations.

- Hostinger's current Business/Unlimited/Cloud hosting can run Next.js Node.js applications, but Hostinger documents that its Web and Cloud database service uses MariaDB. That database is not compatible with this application's current MySQL server contract. A Hostinger VPS with a separately installed Oracle MySQL 8 server is the compatible self-managed route; verify the chosen VPS image and installed database version yourself.
- GoDaddy's published Web Hosting (cPanel) software list includes MySQL 5.6/5.7 and MariaDB 10.6, which do not meet this project's Oracle MySQL 8.0.16+ requirement. A GoDaddy VPS with Oracle MySQL 8, or a separate verified Oracle MySQL 8 service, is required for the current database contract.
- Do not assume a product labelled "MySQL" is Oracle MySQL 8. Check the actual engine and version. Do not substitute MariaDB or switch database providers without explicit compatibility work.

Next.js should run as a Node.js server, not a static export. The repository already contains `build` and `start` scripts. Use Node.js 24 for the initial staging deployment where the selected host supports it, matching the current local Node major. Otherwise select a host-supported Node.js major compatible with Next.js 15 and use the same major for build and runtime.

## Required environment

Set these through the hosting provider's secret/environment settings, not Git:

~~~dotenv
APP_ENV=staging
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://staging.<verified-gallery-domain>

DATABASE_URL=mysql://<staging-user>:<staging-password>@127.0.0.1:3306/desert_art_gallery_staging
STAGING_DATABASE_NAME=desert_art_gallery_staging

MYSQL_CATALOGUE_ENABLED=true
MYSQL_CUSTOMER_AUTH_ENABLED=false

MEDIA_STORAGE_ROOT=/var/lib/desert-art-gallery-staging/media

INVENTORY_EXPIRY_CRON_SECRET=<random-secret-at-least-32-characters>
~~~

Adjust the database host if the staging MySQL service is not on the same server. The staging database name must contain a distinct `staging` segment. Keep the database user restricted to that staging database.

Initially keep customer authentication disabled unless customer-registration and account flows are part of the approved staging test. Do not add payment-provider keys or activate payment processing in this phase. Keep optional Supabase variables unset in MySQL-only staging unless a separately reviewed legacy import needs them.

The selected deployment must provide persistent writable storage at `MEDIA_STORAGE_ROOT`. It must be outside the disposable application release/build directory. Create the directory for the app's service account with restrictive permissions. Back up that directory together with the staging database.

## Repository deployment

1. Confirm PR #13 is open and the exact head has green CI.
2. Deploy the PR branch `feat/mysql-order-checkout-phase7` to the staging hostname only. Do not point production DNS at this branch.
3. Configure the staging environment variables and persistent media directory.
4. Install the repository dependencies and build the Next.js app. The repository does not currently commit a package lock; do not run `npm ci` until a reviewed lockfile is committed.
5. Start the Node.js server with `npm run start`, behind the host's HTTPS reverse proxy. Keep the Node process supervised by the hosting provider, systemd or a process manager.
6. Configure host-level access protection for staging: HTTP Basic Authentication, an IP allowlist or a VPN. The staging `robots.txt` disallow rule is only a crawler directive, **not** access control.

Recommended commands in the staging deployment directory:

~~~bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
npm run start
~~~

Run checks against the staging release before exposing the staging hostname. Do not upload the 2.18 GB recovered photo archive as part of the application deployment.

## Database migration

Before applying migrations:

1. Confirm the command is running in the staging host/session.
2. Print and verify the target database name without printing credentials.
3. Take a staging database backup.
4. Confirm the target database is empty or is the existing dedicated staging database expected by this release.
5. Apply the repository's reviewed Drizzle migrations.

Run:

~~~bash
npm run db:migrate
~~~

Do not use the local `npm run db:ping` utility for a remote staging database; that developer utility intentionally accepts loopback MySQL only. Use the staging health endpoint and a controlled database client to confirm the actual remote MySQL engine/version and connection.

## One-time staging owner bootstrap

Set the following transient variables in the staging deployment environment or one controlled SSH session:

~~~dotenv
STAGING_ADMIN_EMAIL=<owner-email>
STAGING_ADMIN_PASSWORD=<unique-staging-password-at-least-12-characters>
STAGING_ADMIN_NAME=Gallery Staging Owner
STAGING_BOOTSTRAP_CONFIRMATION=CREATE_INITIAL_STAGING_OWNER
~~~

Then run:

~~~bash
npm run db:bootstrap-staging-admin
~~~

The command requires `APP_ENV=staging`, an exact `STAGING_DATABASE_NAME` match to `DATABASE_URL`, a database name containing a distinct `staging` segment and the explicit confirmation token. It refuses to create an initial owner if any admin account already exists. It does not print the password. Remove the password and confirmation variables from the hosting environment immediately after the one-time bootstrap.

The existing `npm run db:bootstrap-admin` remains restricted to local loopback MySQL. Do not use it for a remote staging database.

## Staging acceptance checklist

- [ ] HTTPS works and the staging hostname is protected by a host-level access gate.
- [ ] `/api/health` returns HTTP 200 with application, database and migrations ready.
- [ ] `/owner/login` authenticates the staging owner and redirects to `/admin`.
- [ ] An unauthenticated request to `/admin` redirects to owner sign-in.
- [ ] The admin sidebar displays Overview, Products, Orders, and Shipping & tax only.
- [ ] Overview counts, recent products/orders and low-stock alerts match staging MySQL.
- [ ] Product create/edit, variant and inventory operations work without changing live data.
- [ ] Order draft and shipping/tax pages load; no real payment can be initiated.
- [ ] Product image upload/read works with persistent `MEDIA_STORAGE_ROOT`.
- [ ] Draft media stays private and unapproved until explicit rights review.
- [ ] Draft/unapproved photos can be previewed only through the authenticated `/api/admin/product-media/` route; unauthenticated requests return no image bytes.
- [ ] Restarting/redeploying the app does not delete the media directory or staging database.
- [ ] `robots.txt` disallows the staging site; host-level access protection remains enabled.
- [ ] Database and media backups are tested.

## Explicitly not part of this soft launch

- Production DNS cutover or production database migration.
- Real payment processing or payment webhooks.
- Public launch of unreviewed Etsy catalogue entries or recovered photographs.
- Bulk import of the recovered product photo archive.
- Customer messaging, email verification, carrier integration or unapproved policy content.

A staging deployment is accepted only after the checklist passes against the actual host, database and browser session. CI success alone is not evidence that the staging environment has been provisioned.


## Backup and restore proof before staging acceptance

Before using real staging data, perform a provider-specific database and private-media backup, then restore it into a separate disposable staging database and media directory. The local `npm run local:backup` / `npm run local:restore` commands are intentionally loopback-only and must not be used against the remote staging host. Keep a verified previous release artifact separately from database/media recovery; rolling back application code is not a substitute for restoring compatible data.
