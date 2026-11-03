# MySQL Order and Checkout Lifecycle — Phase 7

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
