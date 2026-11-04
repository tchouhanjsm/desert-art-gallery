# Self-hosted staging release artifact

The Next.js application is built with `output: "standalone"`. Each successful GitHub Actions CI run builds the production application, copies the traced standalone runtime plus static assets and tracked public assets, and uploads `desert-art-gallery-staging.tar.gz` for seven days.

## Runtime contract

- Node.js 22, matching the CI baseline.
- Start the extracted application with `node server.js`.
- Set `HOSTNAME=0.0.0.0` and the platform-provided `PORT` behind the hosting platform's HTTPS reverse proxy.
- Configure environment variables in the hosting control panel or secret manager; never add a production `.env` to the artifact.
- Point `DATABASE_URL` at the staging Oracle MySQL 8.0.16+ database.
- Set `MEDIA_STORAGE_ROOT` to a persistent writable volume outside the release directory. Product originals and customer uploads must survive application releases.
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
