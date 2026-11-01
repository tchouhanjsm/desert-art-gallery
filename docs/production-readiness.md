# Production readiness register

Last reviewed: 2026-11-02 (Asia/Kolkata)

This register distinguishes code present in the repository from integrations that have been connected and verified in a real merchant environment. A checked implementation item is not a claim that production credentials, customer data, catalogue rights or live payments have been configured.

## Implemented in code

### Storefront and discovery
- Next.js App Router storefront with responsive editorial home, shop, collection, product, story, artisans, journal, contact and client-care routes.
- Search/category browsing and product detail routes; seed catalogue remains inquiry-only and must not be treated as verified sale inventory.
- Metadata defaults, sitemap and robots routes.
- Guest cart and wishlist state persist locally. Authenticated cart and wishlist state synchronizes to Supabase after server-side catalogue/status/quantity validation.
- Cart preview refreshes current active catalogue prices, availability and rights-confirmed image references; it is not an inventory reservation or checkout quote.

### Supabase foundation and data controls
- A commerce migration defines profiles, catalogue, media, inventory movements, addresses, orders/order items, saved cart/wishlist, discounts, shipping, content, reviews, newsletter, audit and webhook-event tables.
- Row-level security is enabled across application tables. Public catalogue/editorial reads are limited to published records; customer rows are scoped to the authenticated user; administrative reads/writes require the database role policy.
- Product publishing requires a non-null price and at least one rights-confirmed image with evidence.
- Product media is stored in a private bucket. Uploads are limited by size and declared type, and now also checked against file signatures before storage. Rights confirmation remains a separate explicit administrator action.
- Sensitive table mutations are recorded in an audit log as actor, operation, entity and changed field names only; row values such as customer addresses, email, prices and webhook payloads are not copied into audit metadata.
- Payment-state transitions to paid/refunded are blocked for ordinary authenticated sessions and reserved for trusted service-role processing.
- Server-side Supabase service-role client is isolated in a server-only module. Browser code uses only the public anon key.

### Customer and admin foundations
- Customer sign-in, password recovery callback, profile updates, saved-address CRUD and order-history/detail views are present.
- Admin routes are protected by Supabase user validation plus an admin/owner role check.
- Product draft creation/editing, archive/publish actions, private image upload and documented image-rights confirmation are implemented.
- Admin order/customer/content overview pages and a guarded shipment-tracking update action are present. These are not a complete order, customer or editorial CMS workflow.
- Cookie-authenticated cart/wishlist mutation endpoints require an exact same-origin Origin header and reject cross-origin Fetch Metadata.

## Not yet production-ready

- [ ] Connect the merchant-approved Supabase project and apply/verify the migration in that project. The migration has not been run against a live database in this delivery run.
- [ ] Verify RLS, storage access, auth callbacks and account flows against real Supabase anon/authenticated/service-role sessions.
- [ ] Add customer registration/email verification and approved staff/owner provisioning.
- [ ] Replace all seed/research product records and image references with verified catalogue data and merchant-authorized original assets in owned storage.
- [ ] Complete CSV validation, preview, import, image association and inventory reconciliation workflows.
- [ ] Add a verified variant model and server-side inventory reservation/atomic stock decrement.
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

### 2026-11-02 — commerce security and audit foundation
- Verified starting PR head: `4cd1c5daccbd06b16bed0d32479fbb769c9305f4` on `feat/luxury-storefront-foundation`, targeting `main`.
- Fixed a duplicate named constraint that prevented the initial commerce migration from creating the orders table.
- Added field-name-only database audit triggers for sensitive catalogue, customer, order, editorial, shipping and webhook-event mutations.
- Added same-origin enforcement to cookie-authenticated cart/wishlist sync endpoints and signature validation for uploaded image bytes.
- Added focused regression tests for origin validation, image signatures and migration constraint/audit contracts.
- Current exact PR head and CI result are maintained in PR #1: https://github.com/tchouhanjsm/desert-art-gallery/pull/1.
- Not verified: migration execution against the merchant's Supabase project, real auth/storage policies, payments, shipping, email or production deployment.

## Release status

**Code foundation:** in progress; this PR is not merge-ready until the complete agreed scope and required review/checks are satisfied.

**Production-live:** no. No live payment, shipping, customer messaging, production migration or deployment is authorized or claimed.
