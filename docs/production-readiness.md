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

**Visual readiness limitation:** a responsive global design foundation and core editorial route layouts are now implemented, including navigation, page hierarchy, product/collection grids and mobile breakpoints. Browser visual capture, keyboard/assistive-technology review, contrast testing and route-by-route accessibility QA have not yet been reported; the storefront is not signed off as production-ready.

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
- [x] Implement the responsive editorial design foundation and shared route layouts.
- [ ] Verify mobile overflow, keyboard navigation, focus, contrast, touch targets, reduced motion and assistive-technology behavior with browser-based QA.
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


### 2026-11-02 — responsive editorial storefront and navigation foundation
- Added the missing global design foundation: colour/type/spacing tokens, page containers, editorial hero, collection/product grids, product detail, shop controls, story/artisan/journal layouts, footer, responsive breakpoints, visible focus states and reduced-motion handling.
- Reworked the shared header with a skip link, labelled search, expanded-state mobile navigation and close-on-navigation behavior.
- Replaced unsupported product/provenance/one-of-a-kind marketing language with factual gallery positioning and explicit product-detail confirmation language.
- Homepage collection/product sections now render only when published records exist; the empty catalogue state is explicit rather than showing empty grids.
- Removed footer destinations for shipping, returns, FAQ, tracking, privacy and terms because those routes/policies are not implemented or approved. Replaced them with existing pages and direct gallery email.
- Added route-contract tests so primary/footer navigation cannot point at missing static App Router pages.
- Browser visual capture, keyboard/assistive-technology audit and automated accessibility tests remain unreported; this is a design foundation, not a claim of production visual sign-off.
- The first design-system CI attempt caught a TypeScript tuple-union inference error in the footer navigation configuration; sections now use an explicit shared `NavigationSection` type. The final-head rerun is pending.
- Final branch/head SHA and exact-head workflow result are recorded in the PR #1 description after CI completes.
- Next engineering increment: customer-facing product discovery and product detail completeness (query-state search/filter/sort, verified attributes/variants and availability semantics), with server-side data validation and focused tests.


### 2026-11-02 — URL-synced product discovery
- Fixed the header-search handoff: `/shop?q=...` now hydrates the shop search field from the URL on first load.
- Search, category and sort state are serialized into shareable query parameters. Category/sort/clear actions create browser-history entries; typing replaces the current entry to avoid one history item per character, and back/forward navigation restores the selected state.
- Added allowlisted sort parsing and category validation against the currently supplied published catalogue; unsupported values fall back to safe defaults.
- Search input is capped at 100 characters, Unicode-normalized, stripped of control characters and matched case/diacritic-insensitively against the published product name, category and supplied short description only.
- Price sorting keeps records without a verified price after priced records in either direction; it does not invent or infer a price.
- Unrelated campaign parameters are preserved when shop filters change.
- Added unit coverage for URL hydration, invalid query values, Unicode normalization, category filtering, unpriced sorting and URL serialization.
- Browser-level navigation, keyboard and E2E verification remain unreported; the final exact-head CI result is recorded in PR #1.
- Next engineering increment: enrich product-detail presentation with only verified catalogue fields and improve image/attribute handling without inventing measurements, materials, condition or provenance.


### 2026-11-02 — discovery navigation and copy hardening
- Category and sort changes now create browser-history entries so back/forward restores the previous discovery state. Search typing replaces the current entry to avoid creating one history item per keystroke; clearing filters is a navigable action.
- Replaced an unverified “handmade” catalogue description with neutral textile/object listing language. Product claims remain item-specific and publication-gated.
- Query-state tests and the exact-head CI suite passed before this refinement; a new exact-head CI run is required for the follow-up commit.


### 2026-11-02 — published product detail and image gallery foundation
- Product detail retrieval now queries the requested active slug directly instead of loading the entire published catalogue and signing up to 100 unrelated image URLs for one detail page.
- Product detail data now includes only supplied database fields: full description, materials, sizes, scalar measurements, condition notes, provenance, craft story and SEO metadata. Empty fields are omitted; no measurements, units, materials or condition are inferred.
- Added a keyboard-operable product image gallery. Only rights-confirmed images are signed and exposed; the primary image is displayed first, followed by merchant-defined display order and creation time.
- Increased private image URL lifetime from 15 to 60 minutes to reduce expiry during a customer browsing session. URLs remain signed and are not made public.
- Admin uploads now append after the existing image order and mark the first image as the provisional primary. The image remains private until rights are confirmed.
- Admins can update image display order and select a primary image through an administrator-only transactional database function. The selected primary image must have confirmed usage rights, evidence and descriptive alt text.
- Added a single-primary-image partial unique index and a gallery-order index. The publication trigger now requires a rights-confirmed image with non-empty alt text and evidence.
- Added regression tests for scalar-only measurement presentation, deterministic gallery ordering, primary-image authorization and publication media requirements.
- Migration 202611020003 has not been applied to a live Supabase project. Existing production media records, if any, must be reviewed before migration authorization.
- Exact-head CI, browser visual QA, assistive-technology checks and live Supabase RPC/RLS execution remain separate verification gates.


### 2026-11-02 — deterministic self-hosted typography and CI build resilience
- The product-detail commit passed typecheck, all 59 unit tests and ESLint, but its production build failed inside Next.js Google Font loading while parsing the remote Cormorant Garamond response.
- Root cause: the build depended on a live Google Fonts fetch at compile time. This is an external network dependency and can fail independently of application code.
- Replaced next/font/google with pinned Fontsource variable-font packages for Cormorant Garamond and DM Sans. Font files are bundled and served by the application; production builds no longer need to contact Google Fonts.
- Added the SIL Open Font License attribution register and a regression test that prevents reintroducing remote Google font imports or removing the self-hosted dependencies.
- GitHub Actions run #56 passed on commit 89d908b31744fd51a4d9341349bcc343ac17d109: 12 test files / 61 tests, typecheck, ESLint and production build. The build compiled successfully and generated 26 static pages. Any later commit remains subject to the same exact-head checks.


### 2026-11-02 — primary-image accessibility and CSS compatibility hardening
- Public product cards and detail galleries now exclude media without a confirmed rights flag, an owned storage path and non-empty descriptive alt text. This also protects already-active records that predate the stricter publication trigger.
- The publication guard now specifically requires the primary image to meet the rights, evidence and alt-text requirements; a secondary image can no longer satisfy the main-image publication gate.
- Added regression coverage for missing alt text, missing storage paths and unconfirmed image rights.
- Fixed the Autoprefixer warning on the admin image-order form by using the interoperable flex-end alignment value.
- No production data was read or changed. The new migration remains unapplied pending owner authorization.
