# Production readiness register

Last reviewed: 2026-11-04 (Asia/Kolkata)

This register separates code present in the repository from integrations that have been connected and verified in a merchant environment. An implementation checkbox is not a claim that production credentials, customer data, catalogue rights or live payments have been configured.

## Current Japan-first redesign status — 2026-11-04

The controlling customer-facing specification is [`docs/JAPAN-ECOMMERCE-REDESIGN.md`](./JAPAN-ECOMMERCE-REDESIGN.md). The Japanese-first storefront implementation was merged to `main` in PR [#17](https://github.com/tchouhanjsm/desert-art-gallery/pull/17) at merge commit `5758694f0f20a67546998d7bae6455c4e557e8ea` on 4 November 2026. Continue from `main`; do not resume development on the merged feature branch.

The active public root layout no longer imports the superseded Desert Atelier/Desert Modern theme layers. `src/styles/japan-storefront.css` owns the customer storefront presentation; `src/styles/admin-theme.css` owns operations presentation. The commerce/backend safeguards remain unchanged by the theme merge.

**Automated validation verified:** PR final head `fd7acf6b04672923ad991e834c1b94d0e34a4c52`, GitHub Actions CI run [#348](https://github.com/tchouhanjsm/desert-art-gallery/actions/runs/41869692118), completed successfully. MySQL setup/migrations, TypeScript typecheck, unit/integration tests, ESLint, production build, Lighthouse collection/assertions, Lighthouse artifact upload and staging archive packaging all passed.

**Lighthouse lab snapshot (run #348, CI test database):** home Performance 0.93 / Accessibility 0.95 / Best Practices 0.96 / SEO 1.00, LCP 1.67 s, TBT 309 ms, CLS 0.000; shop Performance 0.97 / Accessibility 0.96 / Best Practices 0.96 / SEO 1.00, LCP 1.90 s, TBT 75 ms, CLS 0.099. These are two single-run lab reports, not field Core Web Vitals or route-wide acceptance. The staging archive was built as an artifact; it was not deployed to a hosting environment.

**Still not verified or approved:** all-route visual acceptance, authenticated customer/owner journeys, native-speaker Japanese copy review, Japanese glyph/line-break coverage, full accessibility/contrast review, Japan-based customer testing, JPY pricing/tax, merchant shipping/returns, legal seller details, payment provider or production deployment. The CSV retains English source product text and USD prices; storefront UI localisation is not catalogue translation or currency conversion.

### Storefront routes and discovery foundations

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
- [x] Merge the Japan-first public presentation layer into `main` (PR #17); this is code integration only, not visual, localisation, merchant or production acceptance.
- [ ] Verify mobile overflow, keyboard navigation, focus, contrast, touch targets, reduced motion and assistive-technology behavior with browser-based QA.
- [ ] Replace the local textile placeholder with merchant-authorized original photography in owned storage after rights review; confirm rights for every product, collection, editorial and artisan image.
- [ ] Add customer registration/email verification and approved staff/owner provisioning.
- [ ] Import the merchant-approved catalogue and complete image association, media optimization and rights evidence review.
- [x] Add merchant-managed product variants, per-variant inventory movements and authenticated server-side inventory reservations (live database execution remains unverified).
- [ ] Complete product, customer, order, promotion, editorial and reporting CRUD, including explicit admin audit review UI.
- [x] Implement authenticated order-draft creation from active reservations, immutable reservation price/variant snapshots, checkout idempotency, destination-specific shipping/tax validation and an admin-only fulfilment state machine (code only; no payment is initiated).
- [ ] Configure and verify the trusted scheduled invocation for reservation expiry; the service-role-only expiry RPC exists but is not scheduled.
- [ ] Implement payment-provider sandbox integration, signed webhook processing, reconciliation and order payment-state transitions.
- [ ] Configure Razorpay for eligible Indian transactions and an approved international payment provider. Never collect or store raw card data.
- [x] Add owner-only shipping-zone, shipping-rate and destination tax-rule management; checkout requires explicit active records and snapshots the entered duties/tax disclosures.
- [ ] Verify the configured shipping/tax rules with the merchant's tax adviser and fulfilment partners; the current tax engine supports additive basis-point components only and does not calculate customs duties.
- [ ] Integrate carrier tracking events and transactional email.
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


## Dated handoff — 2026-11-02 06:21 IST

### Current increment: merchant-managed variants and short-lived inventory reservations

- Added `product_variants` with merchant-supplied labels/attributes, optional price overrides, per-option stock, status, SKU uniqueness, ordering and admin-only writes. Public reads require both an active variant and active parent product.
- Added variant stock movements to the existing inventory ledger. Variant stock cannot be directly edited; an administrator-only row-locked RPC records each adjustment and rejects reductions below active reservations.
- Added variant selection to product details. The storefront displays only active database variants, requires a selection when active variants exist, resolves the selected price from the variant override or verified product base price, and never fabricates option labels or attributes.
- Cart identity is now product plus optional variant UUID. Guest storage, authenticated cart sync, cart preview and cart page controls preserve separate quantities for separate options. Sync drops stale/inactive options and recalculates stock/price from the current catalogue.
- Added authenticated same-origin `POST /api/cart/reserve`. It requires a UUID `Idempotency-Key`, accepts at most 20 lines, validates active product/variant relationships, and calls a database RPC. The RPC derives prices from database rows, locks product then variant in deterministic order, subtracts active holds, limits each hold to 5–30 minutes and caps each customer at three active reservations. It rejects duplicate lines, changed idempotency payloads and overselling.
- Added customer-owned reservation reads, idempotent release, and a service-role-only expiry function. Reservation state does not change order/payment state and no payment provider is invoked.
- Added admin draft/create/update/archive controls for variants and a variant-specific inventory movement form. Product-level stock editing is hidden while active variants exist.
- Added unit tests for UUID validation, scalar attribute constraints, price fallback, availability and product/variant cart identity; expanded migration contract tests for RLS, locks, idempotency, expiry and restricted execution.

### Safety boundaries and known limitations

- Reservation API currently requires an authenticated customer. Guest reservation support is intentionally not enabled until a secure guest-session/idempotency-token design is implemented.
- The expiry function is ready for a trusted scheduler/service-role job, but no cron or background scheduler is configured. Expired holds are excluded from availability immediately by timestamp; status cleanup occurs on the next reservation request or trusted expiry invocation.
- Reservation is a short-lived stock hold only. There is no order creation, payment capture, order-paid transition, shipping calculation or customer email in this increment.
- Variant and reservation migrations are committed but not applied to a live Supabase project. Live RLS/RPC concurrency tests remain unrun.
- Merchant must supply actual option labels, attributes, SKUs, price overrides and stock. No sizes, colours, materials or option values are seeded.

### Verification and next handoff

- Branch: `feat/luxury-storefront-foundation`; base remains `main`.
- The source files and tests were read from the live branch before editing. Local clone/test execution is unavailable because this runtime cannot resolve `github.com`; GitHub Actions is required for final typecheck, unit tests, lint and build evidence.
- Next engineering increment: order lifecycle and checkout preflight, but only after reservation expiry scheduling, guest reservation decision, shipping/tax configuration model and owner-approved fulfilment inputs are addressed. Do not add payment capture until order creation, reconciliation and signed webhook flows are complete.


### Follow-up hardening — variant mutation concurrency

- Variant mutations now lock the parent product row, using the same product-first lock order as reservations and stock adjustments.
- Changing a variant's active/draft/archived state is rejected while any unexpired reservation exists for that product. This prevents a held variant line from being switched into product-level stock mode during the reservation window.
- Variant records cannot be moved between products.
- Changed the cart-domain helper to a relative import so Vitest can resolve it without relying on Next.js path-alias runtime behavior.
- Verified the variant stock adjustment integer validation uses the same whole-number grammar as the existing product stock action.


### Follow-up — cart sync, reservation replay and CI lint correction

- The first CI attempt for the variant phase passed TypeScript and all unit tests (13 files / 73 tests) but failed ESLint on an unescaped apostrophe in the admin variant-stock note. Corrected the JSX text.
- Corrected the variant stock adjustment integer regex to use a single digit-class escape, matching the existing product stock action.
- Cart account synchronization now distinguishes the current authenticated account from the previously synchronized account. It merges guest and saved account lines only when the account identity changes; subsequent cart edits replace the saved state instead of adding the same saved quantity repeatedly. Path changes after sign-in trigger synchronization.
- Added unit coverage for first-account merge, same-account replacement and account-switch merge.
- Reservation API now returns 201 for a new hold, 200 for an active idempotent replay, and 409 when the reused key points to an expired or released hold.
- Variant activation now rejects active product-level holds, and all variant mutations use the parent product lock. This closes the race between switching a product from product-level stock to variant-level stock.


### Follow-up — stock truth and cart persistence safety

- Applied the same one-of-a-kind quantity cap at product selection, cart preview, authenticated cart synchronization and the database reservation boundary. The cap is activated only by the record's explicit `is_one_of_a_kind` flag; no catalogue claim is inferred.
- Reordered authenticated cart persistence so valid upserts complete before stale rows are pruned. If an upsert fails, the previously saved cart remains intact instead of being deleted first.
- Added regression coverage for the one-unit cap and retained server-side reservation enforcement as the final authority.


## Dated handoff — 2026-11-02 07:22 IST

### Current increment: order drafts, checkout preflight and fulfilment controls

- Starting verified PR head: `ffa53b2e41ea6d7c1a129d41265d635e772a4cec`; base `main`: `9d6ad54e0cb1a3337e25e431b4fc55a5857f4845`.
- Added migration `202611020005_order_checkout_lifecycle.sql`: immutable order snapshots from an active inventory reservation, reservation-scoped and request-scoped idempotency, expiring unpaid draft orders, owner-only tax/shipping configuration policies, direct order/order-item write revocation, admin-only fulfilment transitions plus reservation release/expiry propagation to unpaid order drafts.
- Added an authenticated same-origin checkout API and customer delivery form. It accepts no client price, requires one currency, validates the delivery address, and only prepares an unpaid draft when exactly one active shipping zone matches and an active rate plus explicit tax rule exist for the destination/currency.
- Added owner-only shipping-zone, shipping-rate and tax-rule create/update/activate/deactivate management. Rates require a merchant-entered duties disclosure; tax requires an explicit disclosure, including an explicit zero-rate record when no tax applies. No sample prices, zones, tax rates or delivery promises are seeded.
- Checkout creates a draft only. It does not create a payment session, collect card data, or mark an order paid. The order snapshots reservation title/SKU/variant/attributes/price, shipping option, tax components and disclosure text.
- Replaced direct admin order updates with a row-locked fulfilment RPC that only permits paid → processing → shipped → delivered. Carrier and tracking number are required before marking shipped. Payment/refund states remain outside this action.
- Added currency-specific decimal parsing and bounded address/country validation tests. Added migration-contract coverage for idempotency, fail-closed shipping/tax configuration, immutable snapshots, RLS/grants, fulfilment transitions and expiry.
- **Not run locally:** repository clone failed because this runtime could not resolve github.com; no local typecheck, unit tests, lint, build or browser E2E was claimed. GitHub Actions must run against the new exact PR head after the commit is pushed.
- **Not verified:** the migration has not been applied to a merchant Supabase project; no live RLS/RPC/concurrency test, scheduled expiry invocation, shipping/tax/legal review, browser accessibility/E2E or production deployment was performed.
- **Owner inputs still required:** approved Supabase project and migration authorization; actual country coverage, shipping rates, delivery windows and duties wording; tax adviser-approved tax components/disclosures; canonical seller/legal policies; payment accounts and webhook secrets; transactional email and hosting/scheduler approval.
- **Tax limitation:** the implemented quote uses additive basis-point components against item subtotal plus shipping where explicitly configured. It is not a jurisdiction-complete tax engine and does not calculate customs duties, import VAT, tax-on-tax or carrier brokerage. Do not activate a destination until the owner/accountant confirms the configured model is legally appropriate.
- **Next engineering increment:** payment-session abstraction and signed webhook/reconciliation boundary in sandbox-only mode, after verifying order-draft and expiry behavior against an approved Supabase test project. Keep real payment capture disabled.


## Dated handoff — 2026-11-04 — Japan-first ecommerce redesign

- Adopted `docs/JAPAN-ECOMMERCE-REDESIGN.md` as the customer-facing source of truth. Former Desert Atelier and Desert Modern theme descriptions are historical only.
- Replaced the active shared public header/footer, set document language to Japanese, and implemented a new public CSS layer with warm-ivory/ink/terracotta/sand tokens.
- Reworked the home page as product-led Japanese commerce, localised shop discovery and product detail UI, collections, story/artisans/journal/contact, cart, checkout, account and auth labels. The owner/admin interface remains separate.
- Preserved backend contracts: no schema/migration/auth/inventory/payment/media-rights change is intended in this presentation milestone.
- Inspected the uploaded Etsy export: 527 rows; USD only; all source quantity values are 1; 5,216 source image URL references; 60 blank SKU rows; 13 duplicate SKU groups; repeated titles; no category/section or variation data. See `docs/ETSY-LISTINGS-IMPORT.md`.
- Current blockers: owner-reviewed category taxonomy; SKU/title/photo reconciliation; Japanese product translations; JPY retail-price and tax policy; shipping/duties/returns and legal operator details; native-speaker copy review; JP font/glyph QA; route-by-route visual/accessibility/performance evidence.
- No CSV import, photo upload, rights approval, product publication, payment activation or production deployment is claimed by this PR.


## Follow-up — 2026-11-04 — Japan-first storefront regression hardening

- The exact-head CI run #317 on commit `2e61b635b31e67728251366dab401d45589e461c` stopped at TypeScript checking. It identified two incorrectly localised Supabase SDK calls in `src/app/login/legacy-login-form.tsx`: `resetPasswordForEmail` and `signInWithPassword`. These API identifiers (and the local password setter) are restored to standard TypeScript names in the follow-up patch.
- The homepage now selects its hero from persisted catalogue products with a non-empty image URL. Development-only preview records have no database ID and cannot be rendered as published hero photography. The existing catalogue service continues to control published status and media rights.
- Added unit coverage for preview-only catalogues, selecting a persisted product after preview records, and rejecting empty image URLs.
- The Lighthouse report upload now runs only when its manifest exists. This avoids a secondary missing-artifact failure when an earlier validation step stops the job; it does not suppress the underlying typecheck/test/lint/build failure.
- The new exact-head workflow run is required to verify the patch. Visual screenshots, Japanese native-speaker review, accessibility and performance evidence remain outstanding. This update does not authorise product publication, photo rights approval, payment activation or production deployment.

- Follow-up UI isolation review: the tablet breakpoint's legacy generic product-grid selector is now explicitly scoped to `.jp-storefront`; the Japanese search toggle's `aria-controls` now targets the actual search form rather than its input. A regression assertion covers the responsive CSS scope. This does not replace browser/assistive-technology testing.


## Follow-up — 2026-11-04 — Japanese customer information and mobile navigation

- Replaced the six English dynamic information pages (`/shipping`, `/returns`, `/faq`, `/tracking`, `/privacy`, `/terms`) with Japanese-first content in a typed information-page module.
- Added Japanese page metadata and explicit `noindex, follow` metadata while the content remains provisional. Unknown slugs continue to return not-found; no legal-operator page or missing business facts have been invented.
- Shipping, returns, privacy and terms carry visible draft notices. The privacy/terms pages explicitly state that they are not final legal notices; merchant identity, actual policies and jurisdictional review remain required.
- Added guide and policy destinations to the Japanese footer. The mobile header no longer hides the account and wishlist links; source-level regression checks cover their availability.
- Japanese copy is an initial translation for engineering review, not a native-speaker approval. Exact-head CI, browser visual QA, policy approval and accessibility testing remain outstanding.
- Added a tablet footer breakpoint: the new five-column desktop information architecture collapses to a two-column grid below 1000px, with the brand block spanning the row. The existing narrower mobile breakpoint remains intact.


## Follow-up — 2026-11-04 — Japanese customer-facing copy completion

- Translated remaining static interface headings and microcopy on homepage, shop, collection, story, artisans, journal and contact routes.
- Localised the legacy Supabase customer order-detail draft notice, including its reservation-expiry fallback. It states in Japanese that no payment was requested or received.
- Translated visual-design alt text, the short brand tagline and the footer location descriptor. Merchant-owned product titles, descriptions, category names, collection labels and artisan names/biographies remain source content until owner-approved Japanese copy is supplied.
- Added `src/lib/japanese-copy-contract.test.ts` to guard key Japanese route headings and the no-payment draft notice against accidental English regressions.
- The branch remains a draft PR. Native-speaker review, route-by-route visual QA and exact-head CI remain outstanding.


## CI follow-up — run #343 — 2026-11-04

- Exact-head workflow run #343 validated commit `73237825b157e9152960921178df79259541adc9`. MySQL startup/migrations and TypeScript typecheck passed.
- The unit/integration suite reported 5 failures and 299 passes (304 tests total). These were stale tests rather than application type errors: the font test required removed layout font imports; the route-existence test did not recognise the statically enumerated `[slug]` information route; and three conversion-contract assertions still expected English copy from before Japanese localisation.
- Updated the font contract to verify the Japanese system-font stack and absence of remote font dependencies, taught navigation tests to validate known static information slugs, and changed conversion-contract assertions to the Japanese status and accessible control labels.
- A new exact-head CI run is required to verify the corrected test suite. Lint, production build, Lighthouse and staging artifact steps were skipped after the failing test step in run #343.


## Dated handoff — 2026-11-04 — Japan-first storefront merge and CI validation

- PR #17 merged to `main` at `5758694f0f20a67546998d7bae6455c4e557e8ea`; the final PR head was `fd7acf6b04672923ad991e834c1b94d0e34a4c52`.
- Exact-head CI run #348 passed: MySQL migrations, TypeScript, all unit/integration tests, lint, production build, Lighthouse, Lighthouse artifact upload and self-hosted staging archive packaging.
- Lighthouse collected only `/` and `/shop`; see the Japan-first master brief and visual-review report for scores and metric details. These results do not constitute all-route, field-performance or visual acceptance.
- A staging archive was generated by CI. No remote staging deployment, production deployment, merchant data import or media upload was performed by the merge.
- Phase 5 route/viewport QA automation is in draft [PR #18](https://github.com/tchouhanjsm/desert-art-gallery/pull/18); exact-head CI and its screenshot/manifest artifact still require review. Native-speaker Japanese review, authenticated UAT, accessibility testing, image-rights approval and merchant/legal launch inputs remain open.
