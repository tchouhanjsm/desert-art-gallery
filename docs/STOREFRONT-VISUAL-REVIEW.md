# Japan-informed, English-language storefront visual review

**Source of truth:** [Japan-First Ecommerce Redesign](./JAPAN-ECOMMERCE-REDESIGN.md)  
**Review state:** The original storefront implementation merged via PR #17, but it incorrectly shipped Japanese-language UI copy. A corrective English-copy phase is being developed separately. Lighthouse lab reports exist for home and shop only; full route-by-route screenshot and human visual acceptance are still pending.  
**Supersedes:** The November 2 Desert Atelier screenshot assessment as the active target. That report remains historical evidence only.

## Baseline and implementation reviewed

The current `main` baseline uses `src/styles/japan-storefront.css` for the Japan-informed visual system but sets the document locale to Japanese and hard-codes Japanese customer-facing labels. This is a language-contract defect being corrected: the intended storefront is English-language, with Japanese retail conventions informing layout and shopping behaviour.

The intended information architecture is shopping-first: compact multi-zone header, visible search, clear primary navigation, product-led homepage, early collection/product discovery, useful filters and sort controls, purchase information beside the product gallery, cart, checkout and an operational footer. All UI labels and customer messages must be in English.

## Route map

| Route | Template / primary components | Main implementation state |
|---|---|---|
| `/` | `src/app/page.tsx` | Japan-informed, English-language shoppable homepage |
| `/shop` | `src/app/shop/page.tsx`, `ShopBrowser` | English search/filter/sort labels; functional logic retained |
| `/collections/[slug]` | Collection route | English UI labels; owner collection names/descriptions preserved |
| `/products/[slug]` | Product detail, `ProductGallery`, `AddToBagButton` | English purchase-decision UI; source product facts preserved |
| `/cart` | Cart page, `CartPageClient`, `CartProvider` | English labels; cart contracts retained |
| `/checkout` | Checkout page and `CheckoutForm` | English labels and deliberate checkout sequence; generic backend address schema retained |
| `/login`, `/register`, `/account`, `/wishlist` | Customer UI routes | English labels in the customer-facing branch components |
| `/story`, `/artisans`, `/journal`, `/contact` | Editorial/support routes | English page UI labels; merchant-entered editorial data preserved |
| `/admin/*`, `/owner/*` | Owner operations workspace | Separate styling and authentication boundary retained |

## Current limitations to verify

- English interface-copy review and all-route untranslated-string audit remain to be completed.
- The English UI does not automatically translate merchant-managed product titles/descriptions. The CSV contains English source text; preserve it and obtain owner review before publication.
- The CSV source currency is USD. The storefront displays the source record currency; it does not convert prices to JPY or assert tax inclusion.
- The generic address schema has no furigana/name-reading field or Japanese postcode lookup integration. Those require a backwards-compatible data/API plan.
- Merchant-approved shipping, duties, tax, seller/legal identity, returns, payment and customer-support content is not supplied in the CSV.
- English font rendering, contrast and text wrapping remain to be checked in real browsers.
- CI run #348 produced Lighthouse HTML/JSON reports for `/` and `/shop`; no all-route screenshots, authenticated E2E review, field Core Web Vitals or human visual sign-off is claimed.

## Review checklist

- [ ] Home first-screen and first-scroll shopping discovery
- [ ] Header desktop and mobile search/navigation
- [ ] Shop search/category/sort and no-results
- [ ] Collection listing and empty state
- [ ] Product detail gallery, variant selection, price/availability and enquiry
- [ ] Cart page and drawer
- [ ] Checkout field errors and fail-closed configuration blockers
- [ ] Account/login/register/wishlist
- [ ] Story/artisans/journal/contact
- [ ] Footer links, legal-content absence and contact disclosure
- [ ] Owner/admin visual isolation
- [ ] 360 / 390–430 / 768 / 1280–1440 / 1600+ widths
- [ ] English copy, typography and line-wrap review
- [ ] Accessibility and keyboard review
- [ ] Lighthouse and Core Web Vitals review

Do not mark any checklist item complete until screenshot or test evidence is linked with the branch commit SHA.


## CI Lighthouse evidence — PR #17, run #348

The final PR head completed the CI validation job successfully, including Lighthouse. Single-run reports were collected only for the homepage and shop:

| Route | Performance | Accessibility | Best Practices | SEO | LCP | TBT | CLS |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/` | 0.93 | 0.95 | 0.96 | 1.00 | 1.67 s | 309 ms | 0.000 |
| `/shop` | 0.97 | 0.96 | 0.96 | 1.00 | 1.90 s | 75 ms | 0.099 |

These are CI lab measurements on the blank test database, not field Core Web Vitals. The home TBT and shop CLS are optimisation candidates. Two Lighthouse URLs do not cover the complete route matrix.

## Phase 5 route and viewport evidence

The Playwright capture matrix in `src/lib/storefront-review.ts` now defines 24 customer/operations routes across 360, 414, 768, 1440 and 1600 px. The runner writes full-page screenshots and a JSON manifest to ignored `.local-data/visual-review/`. CI uploads its result as a short-lived artifact. The harness is under review in draft [PR #18](https://github.com/tchouhanjsm/desert-art-gallery/pull/18); do not claim its capture artifact exists until that exact-head workflow completes.

The CI test database contains no merchant catalogue. Dynamic product and collection routes may correctly resolve to not-found; screenshots of those empty states are not product-image or catalogue acceptance. `/admin` is unauthenticated and may redirect to `/owner/login`; signed-in owner/dashboard views still require staging UAT.

Human visual inspection, authenticated customer journeys, keyboard/screen-reader testing, English copy quality, glyph coverage, real rights-approved images and Japan-based performance validation remain outstanding.
