# Phase 8 — Razorpay sandbox payment security

**Status:** implementation in progress. Sandbox-only; no live payments or production credentials.
**Backend:** native MySQL / Drizzle. The public customer UI remains English.
**Provider:** Razorpay Standard Checkout, test mode only. The adapter calls Razorpay's HTTPS API directly and adds no SDK dependency.

## Why this phase exists

Phase 7 creates immutable unpaid order drafts from customer-owned stock reservations. It does not create provider orders, verify captured funds, process payment webhooks or issue refunds. Phase 8 adds a separate payment ledger so the order's paid state is never inferred from a browser redirect or customer-supplied amount.

## Security boundaries

- `PAYMENTS_ENABLED` defaults to `false`.
- The application accepts only `PAYMENT_PROVIDER=razorpay`, `PAYMENT_MODE=test`, and a key ID beginning `rzp_test_`. Live keys or live mode are rejected.
- API credentials and the webhook secret remain server-side. Only the public test key ID and provider order ID may reach the browser.
- The server creates provider orders from the persisted MySQL order total and currency. Browser amounts are never trusted.
- Checkout signatures are verified server-side using the provider order ID and payment ID. The server then fetches provider payment status and checks order, amount, currency and captured state before marking an order paid.
- Webhook verification uses the exact raw request body and HMAC SHA-256. Event identifiers are deduplicated durably; event processing must tolerate retries and out-of-order delivery.
- Only a verified captured payment can unlock fulfilment. An authorised but uncaptured payment remains pending.
- Refund requests are recorded before contacting the provider and use a stable idempotency key so an ambiguous network retry cannot create a second refund request.
- No card number, CVV, bank credential or UPI PIN is collected or stored by this application.
- A captured payment arriving after the order reservation expires is quarantined for owner refund review; it does not unlock fulfilment.

## Schema

- `payment_attempts`: provider order/payment references, immutable amount/currency snapshot, idempotency and state.
- `payment_webhook_events`: provider event identity, payload digest and processing result only; raw webhook bodies are not persisted.
- `payment_refunds`: refund amount, reason, provider reference, idempotency key and state.

## Local sandbox configuration

Copy the Razorpay test key ID, key secret and test webhook secret from the Razorpay test-mode dashboard into the local `.env`. Do not paste or commit secrets. Keep `PAYMENTS_ENABLED=false` until the full sandbox UAT has been reviewed. When enabling a disposable local test environment, use `PAYMENT_MODE=test` only.

## Acceptance gates

- [ ] Create a provider order only from a customer-owned, unexpired MySQL order draft and live reservation.
- [ ] Replay the same payment-session idempotency key without creating a second provider order.
- [ ] Refuse a changed request under a previously used key.
- [ ] Reject live key IDs and live mode.
- [ ] Reject invalid checkout signatures and invalid webhook signatures.
- [ ] Do not mark an authorised payment as paid.
- [ ] Mark paid only after provider status, order ID, amount, currency and captured state match the immutable order snapshot.
- [ ] Deduplicate repeated webhook event IDs atomically.
- [ ] Prevent failed/authorised/out-of-order events from downgrading a captured payment.
- [ ] Keep captured payments linked to expired reservations out of fulfilment and make refund review visible.
- [ ] Enforce partial/full refund limits, stable idempotency and webhook-confirmed refund state.
- [ ] Reconcile missing webhook delivery from provider payment status without accepting browser claims.
- [ ] Keep test-mode only; production payment activation remains a separate owner-approved release decision.

## Merchant inputs still required

A verified Razorpay merchant account, test API keys, test webhook secret and confirmation of the webhook URL are needed for end-to-end provider UAT. They are not required for unit tests or GitHub CI. Live credentials, supported live payment methods, seller/legal identity, country coverage, tax and shipping approvals remain separate launch gates.

## Provider references

- [Razorpay Standard Checkout server integration](https://razorpay.com/docs/server-integration/python/test-app/): server-side order creation, checkout-signature verification and captured-payment requirement.
- [Razorpay webhook validation](https://tfs.np.razorpay.in/docs/webhooks/validate-test): raw-body HMAC SHA-256 verification and unique event identifiers.
- [Razorpay webhook best practices](https://github.com/razorpay/markdown-docs/blob/master/webhooks/best-practices.md): at-least-once delivery and out-of-order events.
- [Razorpay idempotent refunds](https://github.com/razorpay/markdown-docs/blob/master/api/refunds/normal-refunds-idempotent.md): `X-Refund-Idempotency` and same-payload retry behaviour.

No production migration, live provider credentials, live payment, customer communication, product import or deployment is included.
