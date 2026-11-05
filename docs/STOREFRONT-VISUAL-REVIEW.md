# Japanese-Inspired English-Language Storefront Visual Review

**Review state:** PR #19 English-language correction is merged. Phase 6 visual-merchandising and ecommerce-experience work is in progress; screenshots from the exact Phase 6 head and owner-approved catalogue data are required before sign-off.  
**Scope:** Public customer storefront only. Owner/admin interfaces remain separate.  
**Primary implementation:** `src/styles/japan-storefront.css`, imported by `src/app/layout.tsx`.

## Design intent

The storefront borrows selected Japanese ecommerce conventions—clear hierarchy, compact but legible navigation, persistent search, category discovery, useful product information, editorial merchandising and purchase reassurance. It remains an **English-language store based in Jaisalmer, Rajasthan, India**. The visual inspiration does not imply Japanese-language copy, JPY pricing, Japanese address validation or a Japan-market launch.

The product-led information architecture includes a compact announcement row, visible search, shopping navigation, curated collections, editorial product storytelling, product specifications, bag, checkout and a structured footer. The existing warm-ivory, ink, terracotta and sand palette is retained. Inter and Playfair Display are used for English typography.

## Route coverage

The Phase 5 review script captures the public shopping and operations route matrix across five viewport sizes. Key customer routes include:

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
