# Japan-first storefront visual review

**Source of truth:** [Japan-First Ecommerce Redesign](./JAPAN-ECOMMERCE-REDESIGN.md)  
**Review state:** Pending. No new browser screenshots or route-by-route visual acceptance are attached to this PR branch yet.  
**Supersedes:** The November 2 Desert Atelier screenshot assessment as the active target. That report remains historical evidence only.

## Baseline and implementation reviewed

The redesign branch replaces the active public styling imports with `src/styles/japan-storefront.css`, sets the document locale to Japanese and introduces Japanese-first shared navigation/footer and customer-facing page labels.

The new information architecture is shopping-first: compact multi-zone header, visible search, primary shopping navigation, product-led homepage, early collection/product discovery, Japanese shop controls, purchase information beside the product gallery, cart, checkout and an operational footer.

## Route map

| Route | Template / primary components | Current PR branch state |
|---|---|---|
| `/` | `src/app/page.tsx` | Rebuilt Japanese shoppable homepage |
| `/shop` | `src/app/shop/page.tsx`, `ShopBrowser` | Japanese search/filter/sort labels; functional logic retained |
| `/collections/[slug]` | Collection route | Japanese UI labels; owner collection names/descriptions preserved |
| `/products/[slug]` | Product detail, `ProductGallery`, `AddToBagButton` | Japanese decision UI; source product facts preserved |
| `/cart` | Cart page, `CartPageClient`, `CartProvider` | Japanese labels; cart contracts retained |
| `/checkout` | Checkout page and `CheckoutForm` | Japanese labels and postal-first field order; generic backend address schema retained |
| `/login`, `/register`, `/account`, `/wishlist` | Customer UI routes | Japanese labels in the customer-facing branch components |
| `/story`, `/artisans`, `/journal`, `/contact` | Editorial/support routes | Japanese page UI labels; merchant-entered editorial data preserved |
| `/admin/*`, `/owner/*` | Owner operations workspace | Separate styling and authentication boundary retained |

## Current limitations to verify

- No native-speaker review of Japanese page copy has been completed.
- Japanese UI labels do not translate Etsy product titles/descriptions. The CSV has no Japanese-language fields; catalogue translation needs a reviewed content workflow.
- The CSV source currency is USD. The Japanese UI displays the source record currency; it does not convert prices to JPY or assert tax inclusion.
- The generic address schema has no furigana/name-reading field or Japanese postcode lookup integration. Those require a backwards-compatible data/API plan.
- Merchant-approved Japanese shipping, duties, tax, seller/legal identity, returns, payment and customer-support content is not supplied in the CSV.
- Japanese glyph coverage, system-font differences, contrast and text wrapping remain to be checked in real browsers.
- No current route screenshots, E2E browser review or Lighthouse artifact is claimed in this document.

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
- [ ] Japanese glyph/line-break/copy review
- [ ] Accessibility and keyboard review
- [ ] Lighthouse and Core Web Vitals review

Do not mark any checklist item complete until screenshot or test evidence is linked with the branch commit SHA.


## Follow-up audit — 2026-11-04

The route capture script currently samples home, shop, one development preview product and cart at 390, 768 and 1440 px. This is a smoke-capture subset, not the full visual acceptance matrix. Expand it before release to cover every customer route, both account implementations, collection/story/artisans/journal/contact/wishlist/checkout, and admin/owner visual isolation. Use persisted, rights-approved product data only when evaluating real catalogue imagery; keep preview-artwork captures clearly labelled.
