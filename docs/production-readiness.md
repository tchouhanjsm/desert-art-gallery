# Production readiness register

## Foundation implemented
- Next.js App Router and TypeScript scaffolding
- Bespoke responsive editorial design, shared navigation and footer
- Shop search/filter, collections, product routes, metadata, sitemap and robots
- Draft product CSV import header

## Required before commercial launch
- [ ] Confirm canonical domain and hosting target
- [ ] Replace image URLs with merchant-authorized originals in owned storage/CDN
- [ ] Verify catalogue, prices, stock, SKUs, sizes, measurements, materials, condition and provenance
- [ ] Add Supabase schema, migrations and tested row-level security
- [ ] Add secure customer/admin authentication and RBAC
- [ ] Implement persistent cart with server-side inventory/price revalidation
- [ ] Implement orders, idempotency, signed webhooks and audit logs
- [ ] Integrate Razorpay for eligible India payments and an international gateway
- [ ] Configure shipping rates, duties/tax disclosures and carrier tracking
- [ ] Integrate transactional email and consent-aware newsletter
- [ ] Finalize merchant-approved legal and consumer policies
- [ ] Import genuine reviews only with explicit permission
- [ ] Build admin CRUD for products, orders, customers, content and reports
- [ ] Add automated unit, integration, accessibility, E2E and security tests
- [ ] Configure consent-aware analytics and production Core Web Vitals monitoring

## Admin catalogue operations implemented
- Product drafts can be created and edited by authenticated administrators.
- Original product media can be uploaded to private storage with alt text.
- An administrator must record a rights evidence reference and explicitly confirm authorization for each image before it can qualify for publication.
- Product publication is guarded by a database trigger requiring a price and at least one rights-confirmed image.
- Admin order, customer and content overview pages are available; fulfillment actions, editorial CRUD and customer communications remain follow-on work.

## Honest limitations
This milestone does not implement payment processing, customer login, order fulfilment, inventory reservation, shipping calculation, admin CRUD, persistent wishlist/cart or newsletter subscription. No transaction is represented as complete.
## Editorial CMS foundation implemented
- Artisan profiles and journal posts are unpublished by default and only published records are public.
- Portrait, product and journal-cover media require an explicit rights-confirmed flag plus a non-empty evidence reference.
- Private media is served through short-lived signed URLs; public reads are constrained by RLS and storage policies.
- Paid/refunded order status changes are reserved for trusted service-role webhook processing.
- Newsletter records support consent and pending/confirmed/unsubscribed states; actual double-opt-in and unsubscribe routes remain a follow-on implementation.
