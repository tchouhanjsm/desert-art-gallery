# MySQL Order and Checkout Lifecycle — Phase 7

> **Customer UX reference:** public Japanese checkout presentation follows [Japan-First Ecommerce Redesign](./JAPAN-ECOMMERCE-REDESIGN.md). This is a presentation-layer localisation only; the address, order, shipping, tax, reservation, idempotency and payment-state contracts below remain authoritative.

**Branch:** feat/mysql-order-checkout-phase7, based on merged Phase 6.
**Scope:** reservation price snapshots, merchant shipping/tax configuration, unpaid order drafts, customer order history, owner order inspection and trusted reservation expiry.
**Activation:** requires MYSQL_CATALOGUE_ENABLED=true and MYSQL_CUSTOMER_AUTH_ENABLED=true. Keep customer mode disabled until local Phase 6 acceptance is complete.

## Delivered

- Adds reservation-time product, variant, options, currency and unit-price snapshots. Order creation never accepts a browser-supplied price.
- Adds shipping zones, rates, delivery windows, and duties disclosures; no example price or delivery promise is seeded.
- Adds destination/currency tax rules and explicit disclosure. An explicit zero-rate rule is required where the approved policy says no tax applies.
- Creates one unpaid draft from a live, customer-owned inventory reservation.
- Uses integer minor units and BigInt intermediate arithmetic, checks JavaScript's exact integer limit, and stores the server-computed total.
- Requires exactly one active shipping zone, a matching active shipping rate, and at least one active tax rule for the destination/currency.
- Enforces unique reservation-to-order and customer/idempotency relationships; checkout request hashes reject key reuse with changed details.
- Snapshots the delivery address, customer email, product/item descriptions, selected options, prices, shipping details and tax disclosures.
- Adds customer order history/details with customer-ID ownership scoping.
- Adds owner/admin order list/detail and event history. Fulfilment transitions are limited to paid -> processing -> shipped -> delivered; shipment requires carrier and tracking number.
- Reservation release/expiry cancels/expires a linked unpaid draft.
- Adds POST /api/cron/expire-mysql-reservations, protected by a timing-safe bearer-token comparison against INVENTORY_EXPIRY_CRON_SECRET.

## Boundaries and required review

- No payment table, provider session, card collection, capture, refund, webhook or paid-state transition is implemented. Only the future verified payment-provider phase may mark an order paid.
- The tax calculation is additive basis-point arithmetic on item subtotal and optionally shipping. It is not a complete tax engine: no tax-on-tax, jurisdictional thresholds, customs, import VAT or destination-specific reporting. Do not activate tax rules without accountant approval.
- Shipping is country-code based; no postcode rules or carrier API are configured.
- No sample destinations, rates, tax rules, charges or delivery promises are inserted.
- Old customer orders/passwords and legacy order history are not migrated.
- The cron endpoint is not scheduled automatically. Configure it only after setting a random secret of at least 32 characters in the host secret store and testing on a disposable local database.
- No production migration, real payment or deployment is performed.

## Local acceptance

1. Sync to the Phase 7 branch and use Node 22, matching CI.
2. Preserve .env, .local-data/mysql, local media/imports/backups and any existing work before branch switching.
3. Verify npm run db:ping and npm run db:status; inspect the current schema before applying migrations.
4. Run npm run db:migrate only after a backup and after confirming the active database is the local desert_art_gallery database.
5. Keep MYSQL_CUSTOMER_AUTH_ENABLED=false until a customer can register, sign in and manage an address.
6. Configure only merchant-approved shipping zones/rates and accountant-approved tax policies. Do not use test/example rates in real orders.
7. Verify one-currency cart, reservation expiry, price snapshots, ownership, idempotent order replay and changed-payload rejection.
8. Confirm overlapping zones, missing shipping rates, missing tax rules and old reservations without snapshots all fail closed.
9. Verify customer A cannot read customer B's orders; owner/admin can inspect events but cannot mark a draft paid.
10. Call the expiry endpoint with correct/incorrect bearer secrets and verify release updates linked unpaid drafts.
11. Before hosting, test a full backup and restore of MySQL and the media directory.

## Tax model limitations

The configured rates are independent additive components calculated on the item subtotal and optionally shipping, rounded to the nearest minor unit per rule. The model does not support compound tax. It does not infer or recommend any rate. The business owner and qualified tax adviser must decide which rules and disclosures apply.

## Next phases

- Phase 8 — payment security: sandbox-only provider sessions, signed webhook verification, webhook idempotency, payment reconciliation, refunds and a verified paid-state transition.
- Phase 9 — launch operations: customer migration/re-enrolment, transactional email and verification, backup/restore, durable hosted media, security/accessibility/browser E2E, performance and production runbooks.


## Japanese checkout presentation boundary (2026-11-04)

The storefront branch translates customer-facing checkout labels and places postal code near the start of the address form. It does not add furigana fields, Japanese postcode lookup, prefecture-specific validation or address-model columns. The current backend contract remains generic (`recipient_name`, `address_line_1/2`, `city`, `region`, `postal_code`, `country_code`, `phone`). Any Japan-specific fields require a separately reviewed backwards-compatible persistence/API plan and tests.

The UI must continue to fail closed when no merchant-approved shipping zone/rate or country/currency tax disclosure exists. No JPY conversion, tax-inclusion label, shipping price/timeline or payment method is inferred by localisation.


## Checkout UX resilience follow-up — 2026-11-05

This frontend-only follow-up preserves the Phase 7 server contracts and makes two customer-journey corrections:

- Reservation and order-draft idempotency keys are generated as a pair and retained for the same normalized checkout request. A retry after an ambiguous network response reuses both keys; an edited order request receives a new pair. Cart-line order and harmless address/note whitespace differences do not create a different fingerprint.
- Choosing a saved address is now explicit state. Editing any address field switches the selector to the custom-address option and explains that the saved address itself is not modified.
- The order summary exposes the configured shipping charge once a rate is selected. It does not invent a tax amount or final total: configured tax and the final total remain server-computed and are shown in the resulting order review.

No schema, API route, inventory behaviour, shipping/tax calculation, order lifecycle, payment or seller-policy behaviour changes. Live payment remains disabled.


## Checkout UX resilience — exact-head validation (2026-11-05)

The frontend retry/address/order-summary increment was validated by [PR #22 CI run #384](https://github.com/tchouhanjsm/desert-art-gallery/actions/runs/41989843935) on `e71ae85bdf2975e50cfdede960076e5ebcef55a8`.

Passed: MySQL setup/migrations, TypeScript typecheck, **320 unit/integration tests**, lint, production build, 120 Playwright route/viewport captures, Lighthouse budget/assertions and self-hosted staging archive packaging.

Lighthouse results (Performance / Accessibility / Best Practices / SEO): homepage **92 / 95 / 96 / 100**; shop **90 / 96 / 96 / 100**. Lighthouse assertions: zero failures. The route manifest had zero capture failures, horizontal overflow, broken images, missing/generic alt labels, unnamed buttons, HTTP errors, failed requests or page errors. Its 15 console 404 messages were limited to empty-database product/collection routes and the intentional not-found route.

Artifacts: [route review](https://api.github.com/repos/tchouhanjsm/desert-art-gallery/actions/artifacts/13397956203), [Lighthouse](https://api.github.com/repos/tchouhanjsm/desert-art-gallery/actions/artifacts/13397562703), [staging package — not deployed](https://api.github.com/repos/tchouhanjsm/desert-art-gallery/actions/artifacts/13397876821).

These automated results do not prove an authenticated checkout with live merchant shipping/tax configuration. Owner-approved staging UAT and customer-account checks remain required. No provider, payment webhook, payment capture or paid-state transition was enabled.
