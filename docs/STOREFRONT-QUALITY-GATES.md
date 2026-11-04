# Japan-first storefront quality gates

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
| Not found | Japanese recovery path to the shop |

The `/admin` and `/owner` workspaces are separately tested as operations interfaces and are not part of public storefront visual theming.

## 2. Required viewports

At minimum test:

- 360 px small mobile
- 390–430 px common mobile
- 768 px tablet
- 1280–1440 px laptop/desktop
- 1600 px and wider desktop

Use Japanese production-length strings, long English source product names, mixed Japanese/Latin, full-width punctuation, numerals, prices and long material descriptions. Verify line wrapping and kinsoku shori. Do not validate using only short English placeholders.

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
2. Japanese copy and typography review notes, ideally by a native speaker.
3. Accessibility/keyboard checklist and remediation.
4. Lighthouse report and measured Core Web Vitals.
5. Commerce regression results for cart, inventory, shipping/tax fail-closed behaviour and order-draft idempotency.
6. Open merchant/legal blockers.

A redesign is not production-ready until owner inputs, image rights, Japanese content, tax/shipping/legal and route QA are verified.
