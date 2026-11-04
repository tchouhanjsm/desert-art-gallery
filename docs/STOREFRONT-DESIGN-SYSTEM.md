# Japan-first storefront design system

**Source of truth:** [Japan-First Ecommerce Redesign](./JAPAN-ECOMMERCE-REDESIGN.md)  
**Status:** Initial replacement implementation is in PR branch `feat/japan-first-storefront-redesign`; visual, native-language and accessibility acceptance is pending.  
**Applies to:** Public customer storefront only.  
**Owner portal:** Separate operations-focused interface; do not apply consumer storefront styling to `/admin` or `/owner`.

## Creative direction

**Japanese contemporary lifestyle retail × Rajasthan artisanal heritage.**

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

- The document root is `lang="ja"`.
- The current CSS uses a Japanese-aware system-font stack: Noto Sans JP, Hiragino, Yu Gothic and Meiryo for UI; Noto Serif JP / Yu Mincho / Hiragino Mincho for display copy.
- These are fallback names, not proof that every client has the same font installed. Japanese glyph, weight, punctuation and line-break review remains open.
- Do not fetch Google Fonts at runtime. Any bundled font choice must include full Japanese glyph coverage, license review, subset/bundle-size review and lockfile updates.
- UI labels are Japanese-first. Merchant-supplied product titles, descriptions, material strings, category labels and artisan/editorial text are preserved as supplied until Japanese content is entered and reviewed by a qualified Japanese-language reviewer. Do not machine-translate product claims or factual copy into production.
- Maintain natural Japanese wrapping and kinsoku shori; avoid fixed-height text boxes that clip glyphs.

## Storefront composition and behaviour

### Shared shell
- Compact announcement row with only a verified message.
- Brand row with wordmark, persistent desktop search, account, wishlist and cart controls.
- Japanese primary shopping navigation; collection panel appears only when published collections exist.
- Mobile header prioritises logo, search, cart and an accessible navigation drawer.
- Footer links only to real, implemented destinations. Do not add placeholders for legal, shipping, returns or FAQ pages.

### Homepage
- First viewport communicates the store, product category and a clear shop action.
- Product-led hero: use a real published product image only when it is rights-approved and its product is published. Otherwise use an explicitly non-product design placeholder.
- Show verified published collections and products early.
- Editorial stories support product discovery; they must not push shopping below a long destination introduction.

### Shop and collection
- Japanese page heading, item count, search, category selection and supported sorting.
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
- Japanese labels for cart, item edits, delivery fields and order review.
- Existing trusted server pricing, currency consistency, reservation, idempotency, shipping/tax and unpaid-draft requirements remain authoritative.
- Japan-specific postal-first field ordering is a presentation aid only. The current address contract remains generic; furigana, Japanese address validation and postcode lookup require a separately designed, backwards-compatible data/service change.
- Never present a payment method, tax-inclusive price or delivery commitment unless configured and verified.

## Owner workspace separation

The root `SiteChrome` hides public header/footer on admin/owner routes. Keep owner forms, tables, inventory, image-rights evidence and operational messages in the separate owner design system. A Japanese storefront does not authorise database, identity, checkout, storage or permission redesign.

## Implementation status

- Implemented in this PR branch: Japanese document language and metadata, shared header/footer, home/shop/product/collection/story/artisan/journal/contact/cart/checkout/account/auth UI labels, and Japanese CSS layer.
- Not signed off: Japanese native-speaker copy review, font/glyph QA, full route screenshot review, browser keyboard/screen-reader audit, contrast certification, JPY price configuration and merchant-approved trust/legal content.
- The master brief is authoritative for future decisions and acceptance gates.
