# MySQL Customer Identity and Saved Shopping — Phase 6

**Delivery scope:** local customer registration/sign-in, server-side sessions, account profile, saved addresses, persisted cart and wishlist.
**Target:** native Oracle MySQL through Drizzle. No Docker, hosted database or external identity provider is required for the MySQL customer path.
**Activation:** opt-in only with \`MYSQL_CUSTOMER_AUTH_ENABLED=true\` and \`MYSQL_CATALOGUE_ENABLED=true\`.

## Included

- Adds customer users, hashed customer sessions, address book, saved cart lines and wishlist records in migration \`0003_mysql_customer_identity\`.
- Uses the existing scrypt password implementation. Passwords are not stored in clear text.
- Stores only SHA-256 digests of random session tokens. Browser sessions use an HttpOnly, SameSite=Lax cookie with an eight-hour expiry.
- Adds per-account failed-login counters and a 15-minute lock after five failed attempts. Unknown accounts follow a dummy scrypt verification path and receive the same generic credential error.
- Adds customer registration and sign-in without changing the local owner/admin identity.
- Moves customer profile/address operations and cart/wishlist synchronization to MySQL when the feature flag is enabled.
- Preserves the previous Supabase sign-in/account behavior when the MySQL customer flag is disabled.
- Keeps guest shopping in local storage. On first sign-in, the guest bag is merged with the account bag; subsequent syncs replace the saved state. The last synced customer ID is retained locally to prevent duplicate quantity merging after a reload.
- Product and variant stock shown in MySQL cart previews is read from the MySQL catalogue and accounts for active reservations.

## Explicit boundaries

- The customer migration does not import existing Supabase accounts, customer profiles, addresses, saved carts or wishlists. Existing passwords cannot be recovered from an export. A reviewed customer-data export and a safe account re-enrolment/reset process are still required.
- Existing order history, checkout, order drafts, payment reconciliation and fulfilment remain outside this customer identity slice. In MySQL customer mode, checkout is deliberately unavailable rather than falling through to Supabase.
- Password recovery and email verification are not activated because no approved transactional email service/domain configuration is present. The recovery page explains this and does not pretend to send a message.
- No payment session, card collection, payment capture, refund, customer email or production migration is initiated.
- Customer registration is enabled only when both MySQL feature flags are enabled. Do not activate the flag on production until email verification/recovery delivery, privacy/terms, existing-customer migration and a reviewed production cutover are complete.

## Local verification

1. Apply migrations on a disposable local MySQL database using the existing migration runner.
2. Keep \`MYSQL_CUSTOMER_AUTH_ENABLED=false\` until the migration and customer workflow are accepted.
3. For local acceptance only, set \`MYSQL_CATALOGUE_ENABLED=true\` and \`MYSQL_CUSTOMER_AUTH_ENABLED=true\` after the owner workspace and catalogue setup are ready.
4. Register a test customer, sign out, sign in, and verify that expired/revoked session rows cannot authenticate.
5. Verify profile and address ownership boundaries, 20-address limit, default-address replacement and deletion.
6. Verify guest bag merge is idempotent across reload, account switching and repeated sync; verify archived products and inactive variants are removed.
7. Verify wishlist merge, product de-publication and unavailable product removal.
8. Verify that MySQL customer mode never calls Supabase Auth for protected account pages or saved-shopping sync.
9. Verify checkout returns an explicit not-yet-migrated state and never writes a Supabase order.

## Next bulk phases

- **Phase 7 — MySQL order and checkout lifecycle:** orders/order items, shipping/tax configuration, customer order history, address snapshots, idempotent order drafts, reservation expiry and fulfilment state machine. Keep payments disabled.
- **Phase 8 — payment boundary:** sandbox-only provider sessions, signed webhooks, reconciliation/refunds and idempotency. Enable real payment only after provider and merchant approval.
- **Phase 9 — operational launch readiness:** owner/customer data migration, email delivery, backups/restores, Hostinger filesystem durability, accessibility/browser E2E, security testing, Core Web Vitals and production runbooks.
