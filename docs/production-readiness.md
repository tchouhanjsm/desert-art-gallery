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

## Honest limitations
This milestone does not implement payment processing, customer login, order fulfilment, inventory reservation, shipping calculation, admin CRUD, persistent wishlist/cart or newsletter subscription. No transaction is represented as complete.