# Self-hosted staging release artifact

The Next.js application is built with `output: "standalone"`. Each successful GitHub Actions CI run builds the production application, copies the traced standalone runtime plus static assets and tracked public assets, and uploads `desert-art-gallery-staging.tar.gz` for seven days.

## Runtime contract

- Node.js 22, matching the CI baseline.
- Start the extracted application with `node server.js`.
- Set `HOSTNAME=0.0.0.0` and the platform-provided `PORT` behind the hosting platform's HTTPS reverse proxy.
- Configure environment variables in the hosting control panel or secret manager; never add a production `.env` to the artifact.
- Point `DATABASE_URL` at the staging Oracle MySQL 8.0.16+ database.
- For local filesystem media, set `MEDIA_STORAGE_ROOT` to a persistent writable volume outside the release directory. Product originals and customer uploads must survive application releases. For managed Node.js hosting, use the private S3-compatible backend rather than a public static-asset directory; see the media storage section below.
- Configure the verified staging origin in `NEXT_PUBLIC_SITE_URL`.
- Keep payments, customer email delivery and public product publishing disabled until their independent acceptance gates are completed.

## What the artifact does not contain

The archive excludes MySQL data, `.env` secrets, `.local-data/`, ignored recovered product photography, private media storage, backups and owner-uploaded files. CI uses an isolated MySQL service and temporary media directory; it does not copy any developer workstation data into the release.

Database migrations are not run automatically when the web process starts. A deployment must first provision and verify its own staging database, run an explicitly approved migration process, and then start the new application release. The local migration command currently accepts only loopback MySQL targets.

## Deployment wiring

The artifact is a portable Next.js standalone release, not an automatic remote deployment. The final deployment workflow must match the actual hosting product: SSH/PM2 on a VPS, a supported Node.js application manager, or a host-specific deployment API. Do not assume cPanel shared hosting supports the same process model as a VPS. Add host-specific secrets and an approval-protected staging environment only after the target host, Node runtime, app root, persistent media path, database endpoint and rollback procedure are confirmed.

## Acceptance checks

1. Download and extract the artifact into a versioned release directory.
2. Confirm `node server.js` starts with the injected staging environment.
3. Verify `/api/health`, owner login, catalogue read paths and private media authorization.
4. Confirm media survives a release-directory swap and application restart.
5. Verify the rollback procedure against a previous artifact before accepting the environment as staging-ready.

## Private S3-compatible media storage

The application supports either local filesystem storage or an S3-compatible private bucket. For Cloudflare R2, configure these runtime-only secrets:

- MEDIA_STORAGE_DRIVER=s3
- MEDIA_S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
- MEDIA_S3_REGION=auto
- MEDIA_S3_BUCKET=<private-bucket-name>
- MEDIA_S3_ACCESS_KEY_ID=<bucket-scoped-object-read-write-key>
- MEDIA_S3_SECRET_ACCESS_KEY=<secret>

The bucket must remain private. The application sends no public object URL to the browser: product and editorial media continue through the existing Next.js media routes, which enforce admin authentication or product publication and rights-confirmed checks. Object uploads set Cache-Control to private, no-store. Do not use a public bucket, public asset directory or broad account-wide storage key for unapproved media.

Local development defaults to .local-data/media. S3 mode is selected only by an explicit MEDIA_STORAGE_DRIVER=s3; it does not require changing MySQL storage keys, schemas or media rows. Switching an existing deployment from filesystem to S3 requires a separate verified copy-and-hash migration of all stored objects before changing the environment variable. Do not switch drivers against a non-empty existing media table without completing that copy and reconciliation.

Cloudflare R2 currently lists a monthly free allowance of 10 GB-month standard storage, one million Class A operations and ten million Class B operations, with no egress charge. Actual costs depend on usage and can exceed the allowance. The 3,116 recovered source photos are not automatically uploaded by this backend; only owner-approved media imports should write objects.
