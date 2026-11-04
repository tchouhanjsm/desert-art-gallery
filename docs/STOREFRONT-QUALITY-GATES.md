# Japan-informed, English-language storefront quality gates

**Source of truth:** [Japan-First Ecommerce Redesign](./JAPAN-ECOMMERCE-REDESIGN.md)  
**Status:** Required before staging or release. A green CI workflow alone is not visual or merchant acceptance.

## 1. Route coverage

Capture and inspect the public customer journeys, not only the homepage:

| Route | Required states |
|---|---|
| `/` | Published catalogue, no published catalogue, with/without collections |
| `/shop` | Initial, search, category, sort, no results, no products |
| `/collections/[slug]` | Published collection with products, empty collection |
| `/products/[slug]` | Gallery with multiple images, one image, variant selection, unavailable stock, enquiry-only state |
| `/cart` | Empty, populated, stale stock, unavailable line, currency mismatch |
| Cart drawer | Open/close, empty, populated, keyboard operation |
| `/checkout` | No configuration, missing shipping/tax rules, configured destination, field errors, unpaid draft response |
| `/login`, `/register`, `/account`, `/wishlist` | Signed-out, signed-in, empty and populated states where available |
| `/story`, `/artisans`, `/journal`, `/contact` | Published/empty states; no unapproved people, images or contact details |
| Not found | English-language recovery path to the shop |

The `/admin` and `/owner` workspaces are separately tested as operations interfaces and are not part of public storefront visual theming.

## 2. Required viewports

At minimum test:

- 360 px small mobile
- 390–430 px common mobile
- 768 px tablet
- 1280–1440 px laptop/desktop
- 1600 px and wider desktop

Use realistic English production-length strings, long product names, numerals, prices and detailed material descriptions. Verify readable line lengths, wrapping and control sizing across viewports. Do not validate using only short placeholder labels. Japanese retail UX conventions must not be confused with Japanese-language UI.

## 3. Visual and usability checks

- [ ] First viewport unmistakably communicates online shopping, real product types and a clear shopping CTA.
- [ ] Product/category discovery appears early; no tourism/hotel/destination-led hero or long introduction above shopping.
- [ ] Search, navigation, category links, breadcrumbs, filters and sort are functional, discoverable and URL-stable.
- [ ] Actual product names, prices, currencies, stock, options and images match their source records.
- [ ] Price/tax labels do not claim JPY or tax inclusion until the merchant price/tax setup supports it.
- [ ] Shipping/returns/payment/legal content appears only when approved and implemented.
- [ ] No fake reviews, popularity, best-seller markers, maker biographies, urgency or free-shipping claims.
- [ ] Mobile two-column product cards remain large enough to assess textile detail.
- [ ] Keyboard, focus-visible, touch-target, screen-reader announcement and reduced-motion behaviour work.
- [ ] No horizontal overflow, clipped Japanese glyphs, broken images, console errors or dead links.
- [ ] Customer header/footer do not leak into admin/owner routes.

## 4. Image and media checks

- [ ] Published product cards and product pages use the approved application media route/storage path.
- [ ] No Etsy image URL or external reference-site image is hotlinked.
- [ ] Primary image mapping, alt text, MIME, file size, checksum, sort order and image rights are verified.
- [ ] Private media remains inaccessible until existing permission/publication rules allow it.
- [ ] Preview artwork is explicitly identified and never represented as product photography.

## 5. Performance gates

Use the existing `npm run visual:review` and Lighthouse workflow. Review actual HTML/JSON artifacts rather than inferring performance from CI status.

- Mobile LCP target: below 2,500 ms.
- Lighthouse performance target: at least 0.80.
- Record the measured result, test location/network, commit SHA and artifact link.
- Include representative testing from Japan or Asia-Pacific before launch.
- Do not sacrifice product-image quality or rights enforcement to meet a score.

## 6. Automated quality

Run the repository's current commands:

```bash
npm run typecheck
npm run test
npm run lint
npm run build
```

Run the available browser/E2E suite as applicable and inspect migration/security/commerce regression results. Record exact commands, versions, commit SHA and pass/fail outcomes.

## 7. Evidence required

Attach to the PR or release record:

1. Route-by-route screenshots at the required breakpoints.
2. English copy and typography review notes, including readability and accessibility.
3. Accessibility/keyboard checklist and remediation.
4. Lighthouse report and measured Core Web Vitals.
5. Commerce regression results for cart, inventory, shipping/tax fail-closed behaviour and order-draft idempotency.
6. Open merchant/legal blockers.

A redesign is not production-ready until owner inputs, image rights, English catalogue/editorial content, tax/shipping/legal and route QA are verified.


## 8. CSS, navigation and indexability safeguards

- [ ] Global CSS contains only neutral reset/tokens; public-storefront presentation selectors are scoped under `.jp-storefront`.
- [ ] Admin and owner workspaces render independently of the customer storefront CSS.
- [ ] Mobile menu and category disclosures expose their expanded state and are keyboard-operable; Escape and focus return are verified in-browser.
- [ ] Sitemap contains published catalogue products/collections only; development preview records must not be indexed.
- [ ] Production robots excludes both `/admin/` and `/owner/`; staging excludes all routes.


## 9. Automated route and viewport capture

The repository's Playwright visual-review command captures the 24-route matrix in `src/lib/storefront-review.ts` at 360, 414, 768, 1440 and 1600 px (120 route/viewport combinations). The manifest records the main-document status, final URL, title/document language, horizontal overflow, H1 count, images without an `alt` attribute, buttons without a detectable accessible name, browser console errors, page errors and failed requests.

Local run:

```bash
npx playwright install chromium
npm run visual:review
```

Start the local application first and ensure `/api/health` returns success. Set `STOREFRONT_REVIEW_BASE_URL` and `STOREFRONT_REVIEW_OUTPUT_DIR` to target a local or staging environment and choose a separate output folder. Captures and the JSON manifest are written to ignored `.local-data/visual-review/`; never commit screenshots, customer data or private media.

CI runs the same matrix against a production build and uploads the capture set as a seven-day workflow artifact. The CI database is intentionally blank: product and collection routes may return 404, which is recorded as an expected data-empty outcome. That does not prove a real product page has passed visual review. The `/admin` route is unauthenticated and may redirect to owner login; the capture does not authenticate or test privileged workflows.

Review every artifact manually. Automated captures do not provide pixel-diff baselines, screen-reader acceptance, English copy review, complete keyboard testing, real merchant media validation or authenticated customer/owner UAT. Do not mark visual or production acceptance complete based on artifact generation alone.
