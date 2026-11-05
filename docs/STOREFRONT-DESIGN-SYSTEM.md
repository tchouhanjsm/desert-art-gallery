# Japanese-Inspired English-Language Storefront Design System

**Source of truth:** [Japanese-Inspired Ecommerce Redesign](./JAPAN-ECOMMERCE-REDESIGN.md)  
**Status:** Customer-facing copy and metadata are English. Japanese ecommerce conventions inform layout and shopping behaviour only.  
**Applies to:** Public customer storefront.  
**Owner portal:** Separate operations-focused interface; do not apply consumer storefront styling to `/admin` or `/owner`.

## Product and language decision

Desert Art Gallery is a Rajasthan-based store selling textiles and handcrafted objects. The customer storefront language is **English**. The word *Japanese-inspired* describes selected visual and interaction conventions—not the language, sales territory, product origin, currency or legal market.

Do not add Japanese-language headings, labels, checkout fields, metadata, translations, Japanese address validation, furigana or JPY assumptions. Do not translate merchant-supplied product titles, descriptions, variant labels, artisan names or factual details. Preserve those source values and render them as supplied.

## Creative direction

**Contemporary Japanese editorial retail conventions × Rajasthan artisanal heritage.**

Use a considered, product-led experience with:
- Clear, persistent navigation and search.
- Strong category and collection discovery with useful counts and filters.
- A high-information-density layout that remains calm, legible and carefully spaced.
- Editorial product storytelling, material and provenance details, and transparent purchase information.
- Deliberate visual hierarchy, restrained colour, fine dividers and a consistent grid.
- Fast, predictable shopping interactions on mobile as well as desktop.

Use POJ Studio for premium craft positioning and editorial storytelling. Use Macaroni Shoten for approachable curation, category discovery and everyday-life framing. Do not clone either reference.

## Design tokens

The active public layer is `src/styles/japan-storefront.css`, imported by `src/app/layout.tsx` after base styles.

| Token | Current value | Purpose |
|---|---|---|
| Warm ivory | `#F5F0E7` | Main page canvas |
| Soft ivory | `#FBF9F5` | Cards and content surfaces |
| Ink | `#25231F` | Text, header structure and dark surfaces |
| Terracotta | `#A54E34` | Selected actions and restrained emphasis |
| Muted sand | `#A79B7D` | Fine accent and secondary detail |
| Slate indigo | `#3C5058` | Editorial depth for selected dark sections |
| Desert olive | `#77785E` | Restrained secondary accent for supporting details |
| Muted ochre | `#C0A16C` | Small warm highlight; never a substitute for accessible text contrast |
| Warm grey | `#716A61` | Secondary information |
| Border | `#DED7CC` | Dividers and control boundaries |

The slate, olive and ochre values extend the approved warm-ivory, ink, terracotta and sand foundation; they are supporting accents, not a competing theme. Use indigo selectively for editorial depth and reserve olive/ochre for limited secondary detail. Validate contrast for actual foreground/background states. These tokens are not, by themselves, proof of WCAG AA compliance.

## Typography and language

- Root document language must be `lang="en"`.
- Use the locally bundled Inter Variable for UI/body copy and Playfair Display Variable for editorial/display headings.
- Font packages are already declared in `package.json`; load them locally. Do not introduce runtime Google Fonts requests.
- Use natural English line wrapping. Avoid fixed-height text boxes that clip headings, descriptions or product specifications.
- Format numeric counts and dates with the English-India locale where a locale is needed (`en-IN`). Currency always comes from the actual catalogue or order record; do not convert or relabel it.
- UI labels, accessibility names, status messages, form labels, SEO metadata and policy-page copy must be in English.
- Merchant-owned product titles, descriptions, materials, variants, collection names and artisan/editorial content are source data. Preserve their source language and wording; do not machine-translate or fabricate details.

## Storefront composition and behaviour

### Shared shell
- Compact announcement row with only a verified message.
- Brand row with wordmark, persistent desktop search, account, wishlist and shopping-bag controls.
- Primary shopping navigation with collection panel only when published collections exist.
- Mobile header prioritises logo, search, bag and an accessible navigation drawer.
- Footer links only to real, implemented destinations.

### Homepage
- First viewport communicates that this is an online shop, the merchandise category and a clear shopping action.
- Product-led hero uses a real published product image only when the item is published and the media is rights-approved. Otherwise use a clearly identified design placeholder.
- Surface verified collections and products early.
- Editorial stories support product discovery; they must not push shopping below a long introduction.

### Shop and collection
- English page headings, item counts, search, category selection and supported sorting.
- Two-column mobile product grid and three/four-column desktop grid as tested.
- Category and collection names remain owner-maintained source data.
- Search results, counts, sort options, active filters and empty states remain functional and URL-shareable where supported.

### Product detail
- Group the product gallery and purchase decision information together.
- Show only the actual catalogue price, its actual currency, current stock and configured variants.
- Show tax, shipping, delivery and return information only when merchant-approved records exist.
- Expose supplied material, sizes, measurements, condition and provenance without inventing missing information.
- Rights-confirmed image media is still required; visual redesign does not bypass image permissions.

### Cart and checkout
- English labels for the bag, item edits, delivery fields and order review.
- Existing trusted server pricing, currency consistency, reservation, idempotency, shipping/tax and unpaid-draft requirements remain authoritative.
- Address fields remain generic and suitable for the configured destination; do not add Japan-specific field assumptions.
- Never present a payment method, tax-inclusive price or delivery commitment unless configured and verified.

## Owner workspace separation

The root `SiteChrome` hides public header/footer on admin/owner routes. Keep owner forms, tables, inventory, image-rights evidence and operational messages in the separate owner design system. A Japanese-inspired customer layout does not authorise database, identity, checkout, storage or permission redesign.

## Acceptance status

English-language UI, source-language preservation, local typography, responsive shopping discovery, accessible control names and route-level visual QA are enforced through tests and CI. Human visual inspection, authenticated customer journeys, keyboard/screen-reader testing, contrast certification, rights-approved product photography and merchant/legal launch inputs remain separate acceptance gates.

## Presentation ownership and reusable composition — 2026-11-05

The global CSS boundary is intentionally small:

- `src/app/globals.css` contains neutral reset rules and shared base font tokens.
- `src/styles/japan-storefront.css` is the one active public customer stylesheet.
- `src/styles/admin-theme.css` is the separate active owner/operations stylesheet.
- `src/app/layout.tsx` is the only global stylesheet import point.

The superseded Desert Atelier `theme.css`, `phase1.css`, `editorial.css` and inactive `admin.css` were removed after the route/component import audit. Do not reintroduce layered legacy themes or move owner selectors into the public stylesheet.

`StorefrontPageHeading` and `StorefrontSectionHeading` provide consistent semantic mastheads and merchandising headings while preserving each route's existing classes and composition. Category result counts are derived from the records already supplied by the catalogue service; no category labels or counts are seeded.
