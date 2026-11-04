# Japan-inspired, English-language storefront design system

**Source of truth:** [Japan-First Ecommerce Redesign](./JAPAN-ECOMMERCE-REDESIGN.md)  
**Status:** Initial replacement implementation is in PR branch `feat/japan-first-storefront-redesign`; visual, native-language and accessibility acceptance is pending.  
**Applies to:** Public customer storefront only.  
**Owner portal:** Separate operations-focused interface; do not apply consumer storefront styling to `/admin` or `/owner`.

## Creative direction

**Japanese contemporary retail UX × Rajasthan artisanal heritage, presented in English.**

Use POJ Studio for premium product-led editorial presentation and craft storytelling. Use Macaroni Shoten for approachable curation, category discovery and everyday-life framing. Apply Japanese ecommerce conventions—persistent search, clear category navigation, breadcrumbs, meaningful filters and counts, visible product specifications and purchase reassurance—where they reduce uncertainty.

Do not clone either reference. Do not use the former hotel/tourism/destination theme or the superseded Desert Atelier / Desert Modern visual directions. The public site must read as a shoppable online store in its first viewport.

## Design tokens

The active public layer is `src/styles/japan-storefront.css`, imported by `src/app/layout.tsx` after base styles. Its initial tokens follow the master brief:

| Token | Current value | Purpose |
|---|---|---|
| Warm ivory | `#F5F0E7` | Main page canvas |
| Soft ivory | `#FBF9F5` | Cards and content surfaces |
| Ink | `#25231F` | Text, header structure and dark surfaces |
| Terracotta | `#A54E34` | Selected actions and restrained emphasis |
| Muted sand | `#A79B7D` | Fine accent and secondary detail |
| Warm grey | `#716A61` | Secondary information |
| Border | `#DED7CC` | Dividers and control boundaries |

Secondary surface values in the stylesheet derive from these core tokens. Check every foreground/background pair in its actual state; this table is not a completed WCAG AA certification.

## Typography and language

- The document root is `lang="en"`. The customer-facing storefront is English-language; do not translate UI copy into Japanese.
- The visual and interaction model is informed by Japanese ecommerce: persistent search, clear category discovery, detailed product information, visible reassurance and a deliberate checkout sequence. These are design conventions, not a language requirement.
- Customer-facing editorial, navigation, accessibility labels, metadata, cart and checkout copy must be natural, plain English. Product and maker facts must remain evidence-led; do not invent or machine-translate claims.
- Merchant-managed product, maker and journal content is displayed as entered. The owner must supply and review it in English for this release; do not silently rewrite live records or alter imported source data.
- Use the existing Inter/Playfair Display font system with resilient system fallbacks. Do not fetch Google Fonts at runtime. Review English typography, line length, line wrapping and contrast at all breakpoints.

## Storefront composition and behaviour

### Shared shell
- Compact announcement row with only a verified message.
- Brand row with wordmark, persistent desktop search, account, wishlist and cart controls.
- English primary shopping navigation; collection panel appears only when published collections exist.
- Mobile header prioritises logo, search, cart and an accessible navigation drawer.
- Footer links only to real, implemented destinations. Do not add placeholders for legal, shipping, returns or FAQ pages.

### Homepage
- First viewport communicates the store, product category and a clear shop action.
- Product-led hero: use a real published product image only when it is rights-approved and its product is published. Otherwise use an explicitly non-product design placeholder.
- Show verified published collections and products early.
- Editorial stories support product discovery; they must not push shopping below a long destination introduction.

### Shop and collection
- English page headings, item counts, search, category selection and supported sorting.
- Two-column mobile product grid and three/four-column desktop grid as tested.
- Category names remain the values maintained by the owner until Japanese taxonomy translations are approved.
- Search results, counts, sort options, active filters and empty states must remain URL-shareable and functional.

### Product detail
- Product gallery and purchase decision information are grouped together.
- Show only real catalogue price, its actual currency, current stock and configured variants.
- Tax, shipping, delivery and return information appear only when merchant-approved records exist.
- Product detail sections expose supplied material, sizes, measurements, condition and provenance without inventing missing information.
- Rights-confirmed image media is still required; visual redesign does not bypass image permissions.

### Cart and checkout
- English labels for the cart, item edits, delivery fields and order review.
- Existing trusted server pricing, currency consistency, reservation, idempotency, shipping/tax and unpaid-draft requirements remain authoritative.
- Japan-informed checkout sequencing is a presentation aid only. Keep the existing generic address contract; do not introduce Japan-specific address validation, furigana or postcode lookup without a separately reviewed, backwards-compatible service change.
- Never present a payment method, tax-inclusive price or delivery commitment unless configured and verified.

## Owner workspace separation

The root `SiteChrome` hides public header/footer on admin/owner routes. Keep owner forms, tables, inventory, image-rights evidence and operational messages in the separate owner design system. A Japan-informed visual direction does not authorise database, identity, checkout, storage or permission redesign.

## Implementation status

- Implemented: Japan-informed shared header/footer, homepage, shop, product, collection, story, artisan, journal, contact, cart, checkout, account and authentication layouts. English customer copy is the required language.
- Not signed off: full-route visual review, browser keyboard/screen-reader audit, contrast certification, market-specific tax/shipping configuration, and merchant-approved trust/legal content.
- The master brief is authoritative for future decisions and acceptance gates.
