# Production readiness register

Last reviewed: 2026-11-02 (Asia/Kolkata)

This register separates code present in the repository from integrations that have been connected and verified in a merchant environment. An implementation checkbox is not a claim that production credentials, customer data, catalogue rights or live payments have been configured.

## Implemented in code

### Storefront and discovery
- Next.js App Router storefront with responsive editorial home, shop, collection, product, story, artisans, journal, contact and client-care routes.
- Search/category browsing and product detail routes; seed catalogue remains inquiry-only and must not be treated as verified sale inventory.
- Metadata defaults, sitemap and robots routes.
- Guest cart and wishlist state persist locally. Authenticated cart and wishlist state synchronizes to Supabase after server-side catalogue/status/quantity validation.
- Cart preview refreshes current active catalogue prices, availability and rights-confirmed image references; it is not an inventory reservation or checkout quote.

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
- [ ] Add customer registration/email verification and approved staff/owner provisioning.
- [ ] Replace all seed/research product records and image references with verified catalogue data and merchant-authorized original assets in owned storage.
- [ ] Import the merchant-approved catalogue and complete image association, media optimization and rights evidence review.
- [ ] Add a verified product-variant model and server-side inventory reservation/atomic stock decrement for checkout.
- [ ] Complete product, customer, order, promotion, editorial and reporting CRUD, including explicit admin audit review UI.
- [ ] Implement order creation, checkout, idempotency, payment-provider sandbox integration, signed webhook processing and reconciliation.
- [ ] Configure Razorpay for eligible Indian transactions and an approved international payment provider. Never collect or store raw card data.
- [ ] Configure merchant-approved shipping zones/rates, taxes/duties disclosures, carrier tracking and transactional email.
- [ ] Implement newsletter double opt-in/unsubscribe endpoints and consent-aware analytics.
- [ ] Add accessible browser E2E coverage, security testing, dependency remediation, image transformation/CDN delivery and Core Web Vitals monitoring.
- [ ] Approve legal seller identity, privacy/terms/returns/shipping policies, domain/hosting and production deployment runbooks.
- [ ] Import genuine reviews only with documented permission; do not imply purchase verification unless independently implemented and proven.

## Owner-controlled inputs and launch gates

Production activation requires merchant-authorized catalogue data and original photo rights; an approved Supabase project and credentials; payment-provider accounts and webhook secrets; confirmed seller/legal identity and country-specific policies; shipping/tax/duties rules; transactional-email configuration; canonical domain/hosting approval; and explicit owner approval before applying production migrations, sending customer messages, processing real payments, changing DNS or deploying.

## Dated handoff

### 2026-11-02 — catalogue ingestion and inventory integrity
- Verified starting PR head: dfb5dc0b4cad469761a551ad9726f25a9f7f692f on feat/luxury-storefront-foundation, targeting main.
- Added strict CSV parsing and row-level validation, a separate preview/commit flow, exact-file SHA-256 binding, duplicate/category checks and a draft-only atomic import RPC.
- Added import batch history and initial inventory movement records.
- Added a database guard against direct stock edits and an atomic row-locked inventory adjustment RPC; removed stock editing from ordinary product detail updates.
- Added parser and migration-contract regression tests. The exact final head SHA and CI outcome are maintained in PR #1 after the commit is created.
- Not verified: execution of the new migration against the merchant's Supabase project, real RPC/RLS behavior, customer auth/storage integration, payment/shipping/email or production deployment.

## Release status

**Code foundation:** in progress; PR #1 is not merge-ready until the complete agreed scope, owner inputs, required reviews and exact-head checks are satisfied.

**Production-live:** no. No live payment, shipping, customer messaging, production migration or deployment is authorized or claimed.
