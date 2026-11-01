# Production readiness register

Last reviewed: 2026-11-02 (Asia/Kolkata)

This register separates code present in the repository from integrations that have been connected and verified in a merchant environment. An implementation checkbox is not a claim that production credentials, customer data, catalogue rights or live payments have been configured.

## Implemented in code

### Storefront routes and discovery foundations
- Next.js App Router route scaffolding exists for home, shop, collection, product, story, artisans, journal, contact and client-care pages.
- Search/category browsing and product detail routes are present. Seed product records are inquiry-only and are now returned only in development when Supabase is not configured.
- Production builds without Supabase no longer publish the seed product/collection catalogue. Production product and collection routes remain dynamic and depend on published Supabase records.
- Unverified merchant-domain and Unsplash image hotlinks were removed from the preview catalogue, homepage and story page. Development preview records and editorial placeholders use an original local textile-inspired SVG until merchant-authorized originals are uploaded.
- Supabase product cards require an active record and a rights-confirmed image in owned private storage. Collection hero images are signed only when their rights flag is confirmed.
- Metadata defaults, sitemap and robots routes exist.

**Visual readiness limitation:** the current global stylesheet contains cart/account/import component styles but does not yet provide the complete base design system for the editorial storefront (design tokens, page layout, navigation, hero, product/collection grids, typography and responsive breakpoints). The route scaffolding is not yet a verified luxury-ready or accessibility-reviewed customer experience. A full responsive design-system and route-by-route QA phase remains outstanding.

### Supabase foundation and data controls
- Commerce migrations define profiles, catalogue, media, inventory movements, addresses, orders/order items, saved cart/wishlist, discounts, shipping, editorial content, reviews, newsletter, audit and webhook-event tables.
- Row-level security is enabled across application tables. Public catalogue/editorial reads are limited to published records; customer rows are scoped to the authenticated user; administrative reads/writes require the database role policy.
- Product publishing requires a non-null price and at least one rights-confirmed image with evidence.
- Product media is stored in a private bucket. Uploads are limited by size and declared type, and checked against file signatures before storage. Rights confirmation remains a separate explicit administrator action. The Next.js server-action request limit is aligned to the 12 MB image cap plus multipart overhead.
- Sensitive table mutations are recorded in an audit log as actor, operation, entity and changed field names only; row values such as customer addresses, email, prices and webhook payloads are not copied into audit metadata.
- Payment-state transitions to paid/refunded are blocked for ordinary authenticated sessions and reserved for trusted service-role processing.
- Server-side Supabase service-role client is isolated in a server-only module. Browser code uses only the public anon key.

### Customer and admin foundations
- Customer sign-in, password recovery callback, profile updates, saved-address CRUD and order-history/detail views are present.
- Admin routes are protected by Supabase user validation plus an admin/owner role check.
- Product draft creation/editing, archive/publish actions, private image upload and documented image-rights confirmation are implemented.
- Admin order/customer/content overview pages and a guarded shipment-tracking update action are present. These are not a complete order, customer or editorial CMS workflow.
- Cookie-authenticated cart/wishlist mutation endpoints require an exact same-origin Origin header and reject cross-origin Fetch Metadata.

### Catalogue ingestion and inventory integrity
- Admin-only CSV validation supports quoted commas, escaped quotes, embedded newlines, strict headers, UTF-8 input, 2 MB files and batches of up to 500 products.
- Row-level validation checks generated slugs, duplicate slugs/SKUs, existing catalogue conflicts, category references, currency-specific minor-unit precision, comparison pricing, integer quantities, pipe-delimited attributes and JSON-object measurements.
- Preview and commit are separate operations. A SHA-256 file hash binds the commit to the exact file previewed; commit revalidates the file and current catalogue before writing.
- CSV imports create unpublished drafts only. They do not accept image URLs, confirm photo rights or publish products. Merchant-authorized originals must be uploaded and rights evidence recorded separately.
- A database RPC imports the complete batch atomically, records initial stock as inventory movements and writes a batch history record. Failed batches roll back rather than leaving partial products.
- Direct product CRUD cannot change on-hand quantity. A database guard requires stock changes to use the inventory RPC, which locks the product row, rejects negative/overflow balances and writes the matching movement in the same transaction.
- Product editor stock adjustments support restock, correction, damage, return and other reasons with an optional operational reference. Recent movements are visible in the product editor.

## Not yet production-ready

- [ ] Connect the merchant-approved Supabase project and apply/verify both migrations in that project. No live database migration was run in this delivery.
- [ ] Verify RLS, storage access, import/adjustment RPC permissions, transaction rollback and auth callbacks with real Supabase anon/authenticated/service-role sessions.
- [ ] Build the complete luxury editorial design system and responsive route layouts; verify mobile overflow, keyboard navigation, focus, contrast, touch targets, reduced motion and assistive-technology behavior.
- [ ] Replace the local textile placeholder with merchant-authorized original photography in owned storage after rights review; confirm rights for every product, collection, editorial and artisan image.
- [ ] Add customer registration/email verification and approved staff/owner provisioning.
- [ ] Import the merchant-approved catalogue and complete image association, media optimization and rights evidence review.
- [ ] Add a verified product-variant model and server-side inventory reservation/atomic stock decrement for checkout.
- [ ] Complete product, customer, order, promotion, editorial and reporting CRUD, including explicit admin audit review UI.
- [ ] Implement order creation, checkout, idempotency, payment-provider sandbox integration, signed webhook processing and reconciliation.
- [ ] Configure Razorpay for eligible Indian transactions and an approved international payment provider. Never collect or store raw card data.
- [ ] Configure merchant-approved shipping zones/rates, taxes/duties disclosures, carrier tracking and transactional email.
- [ ] Implement newsletter double opt-in/unsubscribe endpoints and consent-aware analytics; current mailto fallback is not a subscription system.
- [ ] Add accessible browser E2E coverage, security testing, dependency remediation, image transformation/CDN delivery and Core Web Vitals monitoring.
- [ ] Approve legal seller identity, privacy/terms/returns/shipping policies, domain/hosting and production deployment runbooks.
- [ ] Import genuine reviews only with documented permission; do not imply purchase verification unless independently implemented and proven.

## Owner-controlled inputs and launch gates

Production activation requires merchant-authorized catalogue data and original photo rights; an approved Supabase project and credentials; payment-provider accounts and webhook secrets; confirmed seller/legal identity and country-specific policies; shipping/tax/duties rules; transactional-email configuration; canonical domain/hosting approval; and explicit owner approval before applying production migrations, sending customer messages, processing real payments, changing DNS or deploying.

## Dated handoff

### 2026-11-02 — catalogue ingestion, inventory integrity and asset-rights fallback
- Starting PR head for the catalogue phase: dfb5dc0b4cad469761a551ad9726f25a9f7f692f on feat/luxury-storefront-foundation, targeting main.
- Added strict CSV parsing and row-level validation, a separate preview/commit flow, exact-file SHA-256 binding, duplicate/category checks and a draft-only atomic import RPC.
- Added import batch history and initial inventory movement records.
- Added a database guard against direct stock edits and an atomic row-locked inventory adjustment RPC; removed stock editing from ordinary product detail updates.
- Fixed currency minor-unit parsing for the repository TypeScript target without changing compiler strictness; chunked catalogue duplicate queries to avoid oversized PostgREST URLs.
- Corrected a Next.js Link lint failure. Final exact-head CI is recorded in PR #1.
- Added a production-safe catalogue fallback: unverified preview records are development-only, seed images are local placeholders, and unverified external merchant/Unsplash image hotlinks were removed from the homepage, story and preview catalogue.
- Next engineering increment: complete the core responsive design system and editorial storefront presentation, then perform route-by-route visual/accessibility QA.
- Not verified: execution of the new migration against the merchant's Supabase project, real RPC/RLS behavior, customer auth/storage integration, payment/shipping/email or production deployment.

## Release status

**Code foundation:** in progress; PR #1 is not merge-ready until the complete agreed scope, owner inputs, required reviews and exact-head checks are satisfied.

**Production-live:** no. No live payment, shipping, customer messaging, production migration or deployment is authorized or claimed.
