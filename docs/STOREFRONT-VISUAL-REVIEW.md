# Japanese-Inspired English-Language Storefront Visual Review

**Review state:** PR #19 and PR #20 are merged. PR #21 continues the visual-merchandising work; Phase 7 cart and mobile purchase-path hardening is being validated. Exact-head CI and owner-approved catalogue data are required before sign-off.  
**Scope:** Public customer storefront only. Owner/admin interfaces remain separate.  
**Primary implementation:** `src/styles/japan-storefront.css`, imported by `src/app/layout.tsx`.

## Design intent

The storefront borrows selected Japanese ecommerce conventions—clear hierarchy, compact but legible navigation, persistent search, category discovery, useful product information, editorial merchandising and purchase reassurance. It remains an **English-language store based in Jaisalmer, Rajasthan, India**. The visual inspiration does not imply Japanese-language copy, JPY pricing, Japanese address validation or a Japan-market launch.

The product-led information architecture includes a compact announcement row, visible search, shopping navigation, curated collections, editorial product storytelling, product specifications, bag, checkout and a structured footer. The existing warm-ivory, ink, terracotta and sand palette is retained. Inter and Playfair Display are used for English typography.

## Route coverage

The Phase 5 review script captures the public shopping and operations route matrix at 390px, 430px, 768px, 1280px and 1440px. Key customer routes include:

| Route | Primary review focus |
|---|---|
| `/` | Product-led English homepage, hero and collection discovery |
| `/shop` | English search, filters, sort controls and item counts |
| `/collections/[slug]` | Collection presentation and empty states |
| `/products/[slug]` | Product facts, image gallery, price, availability and enquiry |
| `/cart` | Shopping bag, quantity changes and totals |
| `/checkout` | English delivery form and unpaid order draft safeguards |
| `/login`, `/register`, `/account`, `/wishlist` | Customer account and saved-item journeys |
| `/story`, `/artisans`, `/journal`, `/contact` | English editorial and customer-support presentation |
| `/shipping`, `/returns`, `/faq`, `/tracking`, `/privacy`, `/terms` | English customer information and clearly marked provisional policies |

## Data and trust boundaries

- Merchant-owned product titles, descriptions, materials, dimensions, variants, collection names, artisan names and editorial content are not machine-translated or silently rewritten.
- Catalogue currency remains the currency recorded in the catalogue or order. No currency conversion or currency substitution is made.
- The generic delivery-address contract remains generic. No Japan-only address, furigana or postcode lookup feature is introduced.
- Shipping, tax, returns, payment, seller identity and legal terms remain provisional until merchant-approved configuration and legal review are supplied.
- Product images may be published only when the product is published and the relevant usage rights are confirmed.

## Phase 6 visual merchandising focus

- The homepage must surface the shop action and product discovery early. A large text-only hero or monogram panel must not consume the first viewport when approved catalogue products are available.
- Collection tiles may use photography only when the collection is a persisted owner-managed record with a non-empty media path and reviewed alt text. Local preview placeholders are not collection photography.
- Product cards should show the actual category, title, merchant note and available verified facts such as material, size and one-of-a-kind status. A buy-ready cue is permitted only when the persisted product/option has a real price, currency and available stock.
- Preview artwork must be identified as a design placeholder and never shown as product photography.
- Editorial content should support product discovery and make useful curation information visible. Do not repeat generic brand text merely to fill vertical space.

## Visual QA limitations

Automated capture validates route loading, viewport rendering and measurable UI properties. It does not replace human visual inspection, authenticated customer journeys, keyboard/screen-reader testing, contrast review, product-photo rights verification or owner/merchant UAT. A successful screenshot run is not a production launch approval.

## Sign-off checklist

- [ ] Root document language and customer UI are English.
- [ ] No untranslated Japanese static UI copy remains in customer routes or shared components.
- [ ] Merchant-provided product and editorial data remain unchanged.
- [ ] Header, navigation, search, product discovery and checkout remain usable at mobile and desktop widths.
- [ ] No horizontal overflow, clipped content, missing accessible names, broken images or unexpected HTTP errors.
- [ ] Payment, shipping, tax and legal states are truthful and do not imply unsupported capabilities.
- [ ] All route/viewport artifacts have been manually inspected.
- [ ] Authenticated customer and owner workflows have been tested separately.


## Phase 7 — cart resilience and product purchase-path clarity

The current frontend increment adds the following customer-journey safeguards:

- Cart rows are anchored to locally stored cart identity and are not hidden when server preview data is pending or unavailable. Only a matching server preview may contribute price, currency, current inventory, or product media.
- Cart page and drawer use the reusable resilient image component and a neutral, explicit placeholder when no approved image is available.
- The cart drawer is implemented as a keyboard-operable modal dialog with labelled heading, initial focus, tab containment, Escape handling, focus restoration and background scroll locking.
- Decrement and remove remain available on unresolved lines; increase remains disabled until the server preview confirms available quantity.
- The product-detail sticky mobile action scrolls to actual buying controls only when the product has a verified purchasable option. Otherwise it directs the customer to the existing enquiry route.
- Draft/inactive variants are excluded from the public available-stock decision.

The exact-head workflow [#381](https://github.com/tchouhanjsm/desert-art-gallery/actions/runs/41986240749) passed on 5 November 2026: migrations, typecheck, 320 tests, lint, build, 120 Playwright captures at 390/430/768/1280/1440px and Lighthouse. Lighthouse scores were homepage 98/95/96/100 and shop 96/96/96/100 (performance/accessibility/best-practices/SEO); assertions had zero failures. The capture manifest records zero broken images, missing/generic alt text, horizontal overflow, unnamed buttons, HTTP errors or failed requests. Its 15 console 404s are the expected empty-database product/collection and not-found routes, not broken images. Automated screenshots are not full manual sign-off: the CI catalogue is empty, so product detail, variants, populated cart and approved photography remain unverified. Owner-connected staging UAT remains required. No image migration, backend change, payment activation or policy claim is part of this work.


## Presentation continuation — shared composition and catalogue counts — 2026-11-05

The current frontend increment introduces shared `StorefrontPageHeading` and `StorefrontSectionHeading` components and applies them to homepage merchandising sections, shop, collections, cart, wishlist, customer information, contact, story, makers and journal pages. Route-specific class names, content and actions remain supplied by their existing pages.

Homepage category links and shop category select/chips now show counts computed from the catalogue records passed to those views. Counts are not configured separately and are not rendered when the corresponding category is absent. This does not introduce new catalogue content.

The four legacy stylesheet layers were removed after verifying global style imports across App Router and component files. The active customer stylesheet remains `japan-storefront.css`; owner/admin remains on `admin-theme.css`. Exact-head CI and automated responsive review must run again after this increment. No manual screenshot inspection or live-catalogue acceptance is implied by the refactor.


## Populated catalogue smoke acceptance — 2026-11-06

CI now supplements the empty-state route sweep with one synthetic published product, one synthetic published collection and generated geometric test artwork in an isolated MySQL database/media root. The product route verifies the two-image gallery and thumbnail change; the collection route verifies its cover image and linked product; the customer smoke verifies variant selection, add-to-bag and the server-derived price/stock preview. The two dynamic fixture routes must return HTTP 200 across mobile, tablet and desktop captures.

The fixture is created only inside the GitHub Actions disposable test job after the backup/restore acceptance step. Its explicit environment/database/path guard rejects any other target. Generated media and a labelled INR test value are not merchant photography, real products or proposed prices. The suite stops before checkout, order creation, stock reservation and payment.

This improves automated confidence in the populated public storefront path; it does not replace manual review with an owner-approved product and authorised photo set, authenticated customer UAT, accessibility sign-off, actual local recovery or deployment to an owner-approved staging host.
