# Desert Art Gallery — delivery progress report

**Reporting date:** 2 November 2026  
**Repository:** https://github.com/tchouhanjsm/desert-art-gallery  
**Current main commit:** 4e7c5d2 (PR #8 merged)

## Executive status

The project has progressed beyond a static design prototype. It now contains a responsive editorial storefront foundation, owner operations interfaces, a content-management workflow, a MySQL/Drizzle catalogue and inventory foundation, private product-media handling, and guarded catalogue import tooling.

The remaining work is concentrated in the customer transaction journey and production acceptance: native local MySQL has not yet been validated on the development device; customer identity, cart, wishlist, orders and checkout still have legacy Supabase dependencies; payment-provider integration and operational launch controls are not complete; and merchant-authorized product photography has not yet been supplied and reviewed.

**Indicative engineering progress: approximately 55%.**  
**Production launch readiness: approximately 25–30%.**

These are engineering estimates, not audited completion percentages or a valuation of the contract. The difference exists because code being present is not the same as local, merchant, security and production acceptance being complete.

## Delivered in the repository

### 1. Storefront and discovery foundation
- Next.js App Router storefront routes for home, shop, collection, product detail, story, artisans, journal and contact.
- Responsive design system, shared navigation, footer and editorial typography.
- Search, category and sort state reflected in shareable shop URLs.
- Product detail foundation with verified product fields and a keyboard-operable image gallery.
- Product claims and images are guarded; development artwork is not represented as approved merchant photography.
- Unknown public domain and contact details were removed rather than guessed.

### 2. Owner operations and editorial management
- Owner/admin workspace foundation and product-management routes.
- Owner-managed homepage, collection, maker and journal content workflows.
- Draft, publish and archive concepts for editorial content.
- Product editing, category and variant management, media ordering, primary-image selection and rights-confirmation controls.
- Local owner credentials use salted scrypt password hashes and expiring, digest-only session tokens.

### 3. MySQL catalogue and inventory foundation
- MySQL/Drizzle schema and migration system.
- Products, categories, variants and private product-media metadata.
- Inventory movement ledger and controlled stock-adjustment operations.
- Idempotent, time-bounded inventory reservations with release/expiry/consume behaviour.
- Product CSV and Etsy Listings Download preview/import tooling.
- Etsy imports create drafts; source image URLs are references only and do not confer image rights.

### 4. Reliability and engineering controls
- GitHub Actions validation for MySQL migrations, typecheck, unit/integration tests, lint and production build.
- Health endpoint for application, MySQL connectivity and migration status.
- Private .env and .local-data/ exclusions.
- Rights, alt-text and publication checks on product media.
- Production URL is not guessed and production payment/deployment is not activated.

## Workstreams and honest status

| Workstream | Code status | Acceptance status | Remaining work |
|---|---|---|---|
| Storefront UI and discovery | Foundation implemented | Browser visual/accessibility sign-off pending | Cross-device review, final content and original imagery |
| Owner portal and editorial CMS | Core workflows implemented | Local owner acceptance pending | Real merchant content, end-to-end owner workflow QA |
| Catalogue and inventory | MySQL schema/services implemented | Native MySQL execution on owner device pending | Local migration, stock/reservation acceptance and backup restore |
| Product media | Private storage and rights workflow implemented | Real images not yet supplied/reviewed | Image intake, quality review, upload, alt text and rights evidence |
| Customer accounts | Legacy Supabase implementation exists | MySQL migration not complete | Identity, registration, recovery, customer sessions |
| Cart and wishlist | Legacy implementation exists | MySQL migration not complete | Persistent MySQL state and guest/account merge tests |
| Orders and checkout | Legacy order-draft/checkout foundations exist | MySQL migration and merchant rule validation pending | Transactional orders, snapshots, shipping/tax approval |
| Payments and refunds | Safe boundaries/foundation exist | Live provider integration not complete | Sandbox integration, signed webhooks, reconciliation, refunds |
| Fulfilment and notifications | Legacy management foundations exist | End-to-end operational acceptance pending | MySQL cutover, carrier events and transactional email |
| Production deployment | Not released | Not accepted | Domain, hosting, policies, backups, security, monitoring and launch approval |

## Next delivery sequence

1. **Native local MySQL workflow:** remove the local Docker requirement, add native database diagnostics, validate MySQL version/connection, prepare private workspace directories and confirm local migrations.
2. **Photography intake:** prepare private product-image folders, validate filenames and file signatures, then associate owner-supplied originals with verified product records and rights evidence.
3. **Customer identity and workspace:** migrate customer accounts, sessions, addresses, cart and wishlist to MySQL without disrupting the legacy path before replacement acceptance.
4. **Order lifecycle:** migrate order creation, immutable item/shipping/tax snapshots, idempotency, inventory reservation consumption and owner order operations.
5. **Payments and operations:** integrate a sandbox payment provider, signed webhooks, reconciliation, refunds, carrier tracking and transactional email.
6. **Launch acceptance:** browser E2E, responsive/accessibility review, dependency/security remediation, performance measurement, backup/restore, hosting validation and owner sign-off.

## Merchant inputs required

- Original product photographs and written confirmation of usage rights.
- Final catalogue details: product names, descriptions, prices/currencies, sizes, measurements, materials, condition, stock and any provenance claims.
- Verified official domain and contact channels.
- Approved seller/legal identity and privacy, terms, returns, shipping and cancellation policies.
- Shipping destinations, rates, delivery commitments and tax/duties disclosures approved by the merchant/adviser.
- Payment-provider merchant accounts and webhook credentials.
- Hosting and transactional-email choices.
- Final owner acceptance of product content, photographs and purchase journey.

No production details are to be invented to make the storefront look complete.

## Release and risk statement

The project is **in active implementation, not production-live**. No claim is made that live merchant migrations, payment capture, production email, shipping integrations, final accessibility audits, or hosting deployment have been completed. GitHub CI success verifies the checked code in the hosted test environment; it does not substitute for native local MySQL, browser, merchant or production acceptance.

The next PR is intended to remove the Docker dependency from local development and prepare a controlled photography intake workflow. It will not import or publish any customer assets automatically.
