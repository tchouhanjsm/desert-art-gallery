# Desert Art Gallery — Japan-First Ecommerce Redesign Brief

> **Document type:** Product, brand, UX/UI and implementation brief for the AI coding agent  
> **Status:** Master design direction — use as the source of truth for the redesign  
> **Prepared:** 4 November 2026  
> **Target repository:** `tchouhanjsm/desert-art-gallery`  
> **Recommended repository location:** `docs/JAPAN-ECOMMERCE-REDESIGN.md`

---

## 0. Instruction to the AI agent — read this before changing code

You are acting as a senior Japanese ecommerce product-design and frontend engineering team. Your task is to **replace the existing public-facing storefront theme and redesign the complete customer-facing shopping experience**, not to make a few CSS adjustments to the current theme.

The new direction is a Japanese-first, premium-but-approachable curated lifestyle ecommerce store. Use the following as the primary creative references:

1. [POJ Studio](https://pojstudio.com/) — premium craft positioning, thoughtful editorial product photography, collection-led merchandising, clear shop navigation, meaningful maker/heritage stories, featured products and a well-structured footer.
2. [Macaroni Shoten](https://shop.macaro-ni.jp/) — accessible Japanese curation, everyday lifestyle framing, approachable product discovery and clear lifestyle categories. Its About page describes the store as an editorially curated selection of quality handmade items and carefully selected food/lifestyle products; its visible categories include Kitchen, Living, Food and Daily.

Use the following articles as supporting references for Japanese ecommerce conventions:

- [How Japanese Ecommerce Pages Are Laid Out, Explained (TokyoTronic, 4 October 2026)](https://www.tokyotronic.com/how-japanese-ecommerce-pages-are-laid-out/)
- [Japanese Web Design: What Foreign Companies Need to Know Before Building a Site (Nextcreative, 18 September 2026)](https://nextcreative.jp/en/blog/japanese-web-design-foreign-companies)

**Do not clone either reference site.** Extract the useful design and merchandising principles, then create a coherent identity for Desert Art Gallery and its real catalogue.

### Absolute visual direction

- Remove/replace the current public-facing theme, its visual language, page compositions, global styling and storefront templates wherever they contribute to the current hotel/tourism/editorial-destination impression.
- Do not preserve the existing theme merely by changing colours, fonts, button radii or hero images. Redesign the storefront system end-to-end: header, navigation, announcement area, homepage, product cards, category pages, product pages, cart, checkout-facing UI, content pages, footer, mobile navigation and responsive behaviour.
- Do not delete or rewrite working commerce logic, API contracts, database schemas, authentication, inventory controls, media permissions, checkout/order logic, security controls or migration history simply to achieve the visual redesign.
- Treat this as a **presentation-layer and customer-journey replacement**, with the existing application and backend retained unless a code audit proves a specific change is necessary and safe.
- The customer should understand within approximately three seconds that this is an online shop selling distinctive products—not a hotel, travel destination, tourism service, resort, gallery visit or destination guide.
- Blend **POJ Studio's premium editorial storytelling** with **Macaroni Shoten's approachable curated shopping structure** and **Japanese ecommerce reassurance conventions**. Do not make the design so sparse that essential shopping information is hidden, and do not make it so dense that it becomes a discount-marketplace clone.

### Agent execution requirements

1. Inspect the checked-out repository and current branch before editing. Read `README.md`, all `AGENTS.md` or agent instructions, the `docs/` directory, package scripts, route tree, shared components, styles, product data contracts and relevant tests.
2. Record the current customer-facing routes and identify the exact existing theme/layout/style files that will be replaced.
3. Create a small implementation plan and a route/component map in this document before major code changes. Update this document as decisions are made; do not let code and the design brief drift apart.
4. Implement the new design system and storefront consistently across all customer-facing routes—not only the homepage.
5. Update the existing repository documentation affected by this redesign. Do not merely add this new brief and leave contradictory old instructions untouched. See [Documentation update obligations](#15-documentation-update-obligations).
6. Run the repository's applicable lint, typecheck, test and production-build commands. Perform browser-based visual and responsive QA where the environment supports it.
7. Report what was changed, what was not changed, what remains blocked by missing merchant data, and the exact validation commands/results.

Do not claim that the site is production-ready just because the visual redesign builds successfully.

---

## 1. Project context and strategic positioning

### 1.1 Project context observed in the repository

The public repository README describes the project as an editorial commerce experience for heritage textiles and handcrafted pieces from Jaisalmer, Rajasthan. Repository documentation also identifies existing storefront routes and a substantial commerce foundation, including product/catalogue, inventory, media, owner/admin and order/checkout capabilities.

The repository has important data and release safeguards. In particular, the README and production-readiness documentation warn against publishing guessed prices, measurements, stock, artisan biographies, shipping promises, reviews or policy terms. Product seed records are examples/inquiry-only and must not be treated as live products. Product photography must be authorised and stored through the approved media flow rather than hotlinked from third-party sites.

**The redesign must preserve these safeguards.** A beautiful new UI populated with invented data is a failed implementation.

### 1.2 Positioning statement

Create a Japanese-first curated ecommerce destination for distinctive handcrafted textiles, home objects and lifestyle pieces, presenting the artistry and cultural character of Rajasthan through a refined, contemporary retail experience.

The brand should feel:

- Curated, not mass-produced.
- Warm and human, not corporate or cold.
- Premium in presentation, but approachable and easy to shop.
- Authentic and specific, not exoticised or tourist-oriented.
- Product-led, with the craft story supporting the product decision.
- Japanese in usability and customer communication, while retaining the product's genuine place of origin and identity.

### 1.3 Target customer

Design for Japanese customers who may be interested in:

- Home textiles and interior accents.
- Table styling, dining and everyday living.
- Handmade and craft-led products.
- Distinctive gifts and thoughtful purchases.
- Natural materials, texture, pattern and objects with a meaningful story.
- Discovering products that are not generic mass-market items.

Do not assume all Japanese customers have identical tastes. Validate decisions with Japanese-language reviews, real device testing and, where possible, feedback from target customers in Japan.

### 1.4 Customer-facing narrative

The customer-facing story should focus on the products, materials, verified making processes, craft knowledge and how the items fit into everyday life.

Do not add internal ownership, sourcing-partner, co-partnership or behind-the-scenes commercial relationship details to marketing copy unless the owner explicitly approves them. **This does not permit hiding legally required seller/operator identity.** The actual seller, business operator and transaction information must be presented accurately wherever Japanese law requires it.

---

## 2. Design references and what to learn from them

### 2.1 POJ Studio — primary premium/editorial reference

Reference: [https://pojstudio.com/](https://pojstudio.com/)

Use it to understand:

- How a craft/lifestyle store can feel premium without looking like a hotel or travel brand.
- How a campaign hero can combine product-in-use photography, a short message and an obvious shopping action.
- How the shop navigation groups collections, categories and bestsellers.
- How product discovery can coexist with stories, artisan features and mission content.
- How the homepage can move from campaign to brand meaning, featured collections, editorial stories and customer-favourite products.
- How the footer provides useful shopping, company, support and legal destinations.
- How locale/currency controls can be made discoverable.

POJ's live site currently demonstrates Shop navigation, categories, bestsellers, gifting, product collections, story content, customer favourites, company information and a Japan/JPY locale option. A published ecommerce implementation case study also describes a complete Japanese store renewal and structured product information using metafields/metaobjects and tabbed product details. The lesson is to make the content system manageable as well as attractive.

**Do not copy:** POJ's exact photography, copy, product categories, logos, proprietary layouts or brand identity. Do not make Desert Art Gallery look like a Japanese ceramics store; its own products and origin must remain recognisable.

### 2.2 Macaroni Shoten — primary Japanese curation reference

Reference: [https://shop.macaro-ni.jp/](https://shop.macaro-ni.jp/)  
About: [https://shop.macaro-ni.jp/about](https://shop.macaro-ni.jp/about)

Use it to understand:

- A friendly, curated retail proposition rather than an intimidating luxury posture.
- Everyday lifestyle framing: products are selected because they add something worthwhile to daily life.
- Clear top-level category organisation such as Kitchen, Living, Food and Daily.
- Japanese-language category naming and approachable copy.
- A concise About page that explains what the store selects and why.
- Clear company/contact and Japanese legal-policy destinations.

**Do not copy:** its products, copy, catalogue, logo, exact category taxonomy or platform-specific elements. Translate its curation principle into the real Desert Art Gallery catalogue.

### 2.3 Japanese ecommerce layout guidance — functional reference

Reference: [TokyoTronic — How Japanese Ecommerce Pages Are Laid Out](https://www.tokyotronic.com/how-japanese-ecommerce-pages-are-laid-out/)

Use as guidance for:

- Multi-zone but clearly prioritised headers.
- Persistent search access and useful category navigation.
- Breadcrumbs, filters, sorting controls and item counts.
- Product pages that put price, tax, availability, options and delivery information near the buying controls.
- Visible shipping, returns and customer support information.
- Reviews and customer Q&A only when genuine and implemented.
- Mobile product grids, filter sheets, swipeable galleries and sticky purchase controls.
- Clear and linear checkout with a final order review.

The article is a practical pattern reference, not a universal law. Do not blindly reproduce a dense marketplace layout. This brand is a curated specialty shop, so adopt the elements that reduce uncertainty and aid discovery while maintaining an editorial, premium visual hierarchy.

### 2.4 Japanese web design guidance — localisation and trust reference

Reference: [Nextcreative — Japanese Web Design: What Foreign Companies Need to Know](https://nextcreative.jp/en/blog/japanese-web-design-foreign-companies)

Use as guidance for:

- Localisation beyond direct translation.
- Accessible company/operator information and trust details.
- Structured, sufficiently complete Japanese content.
- Mobile-first design that does not hide decision-critical information behind unnecessary taps.
- Japanese address and contact form conventions.
- Japanese SEO and detailed query-aware content.
- Performance testing from Japan and Asia-Pacific infrastructure considerations.

The article notes that information-density expectations are not universal; younger and design-conscious audiences may prefer cleaner interfaces. Our chosen answer is **calm visual design + complete information architecture**.

---

## 3. Core design concept

### 3.1 Creative direction

**Japanese contemporary lifestyle × Rajasthan artisanal heritage.**

The visual result should feel like a thoughtfully edited Japanese lifestyle shop that happens to specialise in distinctive craft from Rajasthan. The store should not look like a tourism landing page, a hotel booking experience, an Indian souvenir catalogue or a generic Shopify template.

### 3.2 Emotional response in the first three seconds

The target customer should immediately feel:

1. “This is a shop.”
2. “The products look distinctive and considered.”
3. “I can understand the price and browse in Japanese.”
4. “This store seems credible enough to explore.”
5. “I know where to click to shop.”

A possible Japanese brand message (subject to native-speaker review):

> **日々の暮らしに、特別な手仕事を。**  
> Special craftsmanship for everyday living.

A supporting line, only if it accurately describes the real catalogue:

> ラージャスターンの手仕事を、毎日の暮らしへ。  
> Handcrafted work from Rajasthan, brought into everyday life.

Do not use these as final legal or factual claims without owner verification and professional Japanese copy review.

### 3.3 Visual balance

Use:

- Editorial product photography with beautiful, accurate colour and texture.
- Real-life product styling in contemporary Japanese homes and daily-life settings, where appropriate.
- Clean product cut-outs or neutral product backgrounds for shopping grids.
- Warm neutral surfaces, natural materials and restrained accent colours.
- Editorial typography for brand moments and highly legible Japanese sans-serif typography for shopping UI.
- Short, useful campaign copy and consistent CTAs.
- Visible category entry points and product cards early in the homepage.

Avoid:

- Desert landscapes as the primary homepage selling image unless a product is also clearly the focus.
- Hotel/resort architecture, room photography or travel destination hero treatments.
- Long tourism-style introductions before the customer sees products.
- Huge decorative headlines that push shopping out of the first viewport.
- Overly sparse layouts that hide product information, delivery, support or seller identity.
- Excessive banners, flashing elements, countdowns or unverified urgency claims.
- Heavy animation, scroll-jacking, auto-playing audio or distracting motion.

---

## 4. Design system

The following tokens are a starting direction. Implement them as central design tokens/CSS variables, validate contrast and adjust only with a documented reason.

### 4.1 Suggested palette

| Token | Suggested value | Use |
|---|---:|---|
| Warm ivory | `#F5F0E7` | Main page background |
| Soft ivory | `#FBF9F5` | Cards and surfaces |
| Ink | `#25231F` | Main text, header/footer |
| Terracotta | `#A54E34` | Primary accent and selected CTAs |
| Muted sand | `#A79B7D` | Secondary accents and borders |
| Warm grey | `#716A61` | Secondary text |
| Border | `#DED7CC` | Dividers and card borders |
| White | `#FFFFFF` | Product image surfaces where needed |

Rules:

- Maintain WCAG AA contrast for normal text and controls.
- Never use terracotta for small text on ivory unless its contrast is verified.
- Use colour to guide hierarchy, not to decorate every section.
- Do not introduce multiple unrelated accent colours without a real campaign or category need.

### 4.2 Typography

Recommended initial font direction:

- Japanese UI/body: `Noto Sans JP` or another properly licensed Japanese sans-serif with full glyph coverage.
- Editorial headings: `Noto Serif JP` or `Shippori Mincho` in restrained contexts.
- Latin UI and numbers: a compatible neutral sans-serif with tabular numerals for prices where appropriate.

Rules:

- Confirm font licences and actual loaded glyph subsets.
- Avoid faux bold or missing-glyph fallback.
- Support natural Japanese line wrapping and kinsoku shori; do not force fixed-height text containers that clip kana/kanji.
- Test mixed Japanese/Latin product names, numerals, punctuation and long titles.
- Use responsive line-height and type scales; do not simply shrink desktop typography on mobile.

### 4.3 Layout and spacing

- Use a consistent max-width/container system and a predictable spacing scale.
- Prefer strong alignment, generous product imagery and clear section rhythm.
- Make shopping controls easy to identify and tap.
- Product cards should have consistent image ratios but allow product-name height to expand naturally.
- Use responsive layouts rather than hard-coded heights.
- Keep the premium mood through composition and photography, not through hiding information.

### 4.4 Buttons and interaction patterns

- One clearly dominant primary action per decision area.
- Secondary actions should be visually quieter but still discoverable.
- Use clear Japanese functional labels, not clever or ambiguous slogans for shopping actions.
- Provide hover, focus-visible, active, disabled, loading, success and error states.
- Ensure touch targets are comfortable on mobile.
- Do not use colour alone to communicate availability, errors or state.

---

## 5. Storefront information architecture

Rework customer-facing navigation around shopping first. Actual category labels must be derived from the approved catalogue.

### 5.1 Suggested primary navigation

Japanese-first examples:

- すべての商品 — Shop all
- テキスタイル — Textiles
- インテリア — Interior / Home decor
- テーブル・キッチン — Table / Kitchen (only if products exist)
- ギフト — Gifts (only if a real gift range or gifting feature exists)
- 新着商品 — New arrivals
- 人気の商品 — Popular products / Bestsellers (only when ranking data exists)
- ブランドについて — About the brand / Our story

Header utility controls:

- Search (検索)
- Account (ログイン / マイページ)
- Wishlist (お気に入り), only if implemented
- Cart (カート)
- Japanese locale and JPY display where supported
- Customer support / delivery information access

### 5.2 Desktop header

Use a clear, compact multi-zone header:

1. Optional announcement strip for one verified message only (e.g. an actual promotion, shipping notice or store announcement).
2. Main brand row with logo, search, account, wishlist and cart.
3. Primary category navigation row.
4. Breadcrumbs directly below the header on category and product pages.

Search should be easy to find, not buried in a footer or mobile-only drawer. If category navigation becomes wide, use a carefully designed mega-menu with categories, selected products or campaign imagery only where it adds genuine discovery value.

### 5.3 Mobile header

- Compact logo and visible cart/search access.
- Navigation drawer with clear category hierarchy and account/support shortcuts.
- Keep search within easy reach.
- Avoid multiple stacked announcement bars consuming the first screen.
- Do not hide key shipping or support information behind a chain of menus.

### 5.4 Footer

Build a complete, readable Japanese footer with groups such as:

**お買い物ガイド**
- ご利用ガイド
- 送料・配送について
- お支払い方法
- 返品・交換について

**サポート**
- お問い合わせ
- よくあるご質問
- 注文・配送状況 (only if tracking is implemented)

**ブランド**
- 私たちについて
- 素材・ものづくり (only with verified content)
- お知らせ / Journal

**法的情報**
- 特定商取引法に基づく表記
- プライバシーポリシー
- 利用規約

Only link to real, approved pages. Do not create dummy policy links or dead routes to make the footer look complete. The identity of the legal seller/operator must be accurate.

---

## 6. Homepage blueprint — highest priority

Build the homepage as a shoppable editorial storefront. The homepage must immediately communicate what is sold and how to shop.

### Section 1 — Announcement (optional)

Use a restrained strip for one real, current message. Examples include a verified new-arrival announcement, actual campaign or confirmed shipping notice. Do not invent coupons, deadlines, discounts or free-shipping thresholds.

### Section 2 — Header and shopping navigation

Brand, search, account, wishlist, cart and Japanese category navigation. Keep it recognisably ecommerce, not hotel-site navigation.

### Section 3 — Main campaign hero

- Product-led lifestyle image or a strong editorial composition in which the product remains obvious.
- Short Japanese headline that communicates the product/lifestyle value.
- One primary CTA such as `商品を見る` or `コレクションを見る`.
- Optional short supporting copy.
- Avoid a destination-only desert panorama or generic cultural collage.
- On mobile, keep headline and CTA readable without hiding the product.

### Section 4 — Shop by category

Use image-led or restrained icon/image category tiles based on verified catalogue groups. Suggested labels only where applicable:

- テキスタイル
- インテリア
- テーブルウェア
- ギフト
- すべての商品

### Section 5 — Bestsellers / popular products

Use genuine ranking or sales data. If a valid ranking is unavailable, call this `おすすめの商品` (Recommended products) and use an owner-approved curated collection. Do not fabricate bestseller badges, popularity counts or review scores.

Product cards should show:

- Primary product image.
- Japanese product name.
- Actual price and currency.
- Tax display in line with the approved tax configuration.
- Actual stock/availability state.
- Variant information when relevant.
- Wishlist action only if functional.
- Quick add only if variants and inventory can be selected safely.

### Section 6 — Editorial collection / seasonal feature

Present a curated set of products with an editorial introduction. Product tiles should be interleaved with the story, not displaced by it. Campaign pages should remain shoppable.

### Section 7 — Craft and material story

Explain only verified processes, materials, regional context and artisan information. Use close-up photography of real authorised materials, tools, hands/processes and finished products. Avoid generic stock imagery and invented artisan biographies.

### Section 8 — In a Japanese home / styling inspiration

Show how the real products might be styled in everyday spaces. Do not imply product suitability, size or material performance that has not been confirmed. Use real commissioned or licensed photography and clearly distinguish styled images from the product-only view.

### Section 9 — Gift discovery (optional)

Include only if the store can actually support gift selection, gift packaging or gift messaging. Do not imply gift wrapping is offered until it is confirmed.

### Section 10 — Trust and shopping reassurance

Surface accurate information about:

- Who operates the store.
- Where orders are shipped from.
- Delivery regions and expected timelines.
- Shipping costs and duties/taxes where relevant.
- Payment methods actually enabled.
- Returns/exchanges and cancellation terms.
- Customer service contact and support hours, if verified.

### Section 11 — Stories / journal (optional but useful)

Support discovery and organic search with useful Japanese editorial content. Stories must support the brand and products rather than turn the homepage into a travel guide.

### Section 12 — Footer

Use the information architecture in Section 5.4.

**Homepage acceptance test:** From the first screen, a Japanese visitor can identify the shop, understand the product category/value proposition and find the route to shop. The first meaningful scroll reveals products/categories, not a long destination introduction.

---

## 7. Category, collection and search results pages

These are core ecommerce pages, not secondary editorial templates.

### 7.1 Collection/category page structure

1. Breadcrumb.
2. Category title in natural Japanese.
3. Short useful intro (optional; avoid long filler).
4. Category/collection image only if it supports discovery.
5. Result count, e.g. `12件の商品` (actual count).
6. Sort controls, such as おすすめ順, 新着順, 価格の安い順, 価格の高い順, 人気順 (only supported by real sort logic).
7. Filters based on actual catalogue attributes.
8. Product grid.
9. Pagination or load-more behaviour that preserves performance and browser navigation.
10. Helpful category content/FAQ below the products where useful.

### 7.2 Desktop layout

- Use a practical product grid, normally 3–4 columns for this curated store; adjust after testing image size and viewport.
- A left filter column can be used when there are enough useful facets to justify it.
- Keep sort, result count and filter state obvious.
- Do not add empty or fake filters.

### 7.3 Mobile layout

- Normally use a 2-column grid with touch-friendly spacing.
- Use a bottom or side filter sheet with clear apply/reset actions if filters are implemented.
- Keep active filter chips and result count visible.
- Do not make product images too small to assess texture and pattern.

### 7.4 Search

- Search should be visible in the header.
- Support Japanese product names and meaningful synonyms where the search backend allows.
- Provide a useful empty state and spelling/keyword guidance without inventing results.
- Show result counts and useful filters on results pages.
- Do not implement a non-functional search icon or decorative input.

---

## 8. Product detail page — purchase decision first

The product page must answer buying questions before asking the customer to read a long story.

### 8.1 Above-the-fold purchase information

Put the following near the gallery and buy controls, based on available verified data:

1. Breadcrumb.
2. Main image gallery with thumbnails and mobile swipe behaviour.
3. Japanese product name; optional original/English name as secondary text if useful.
4. Genuine review summary only if reviews exist.
5. Price in JPY and appropriate tax disclosure (never guess or hard-code tax treatment).
6. Availability/stock state from the inventory source.
7. Product variants/options when supported.
8. Quantity selector with valid limits.
9. Delivery/shipping estimate and cost if configured and reliable.
10. Payment methods actually supported.
11. Return/exchange link and essential purchase reassurance.
12. Add-to-cart button with correct server-side validation.

### 8.2 Product information below the buy area

Use well-organised tabs or accordions where appropriate. POJ's product information organisation is a useful pattern to study.

Possible sections:

- 商品について — About this product
- サイズ・仕様 — Size and specifications
- 素材 — Material
- つくり手・背景 — Maker / background (verified only)
- お手入れ方法 — Care instructions
- 送料・配送 — Shipping and delivery
- 返品・交換 — Returns and exchanges
- レビュー — Reviews (genuine only)
- よくある質問 — Product Q&A (only if supported)

### 8.3 Product media standards

Use a consistent, useful image sequence when the source images exist:

- Primary complete product image.
- Alternate angle.
- Detail/texture close-up.
- Back/underside/label where relevant.
- Scale or lifestyle image with honest context.
- Packaging image only if the packaging is actually supplied.

Image sequence and roles must follow the repository's existing product media intake workflow. Do not bypass the image rights checks. Do not hotlink image assets from POJ, Macaroni or image-search results.

### 8.4 Product page safeguards

- No fake star ratings, review counts, testimonials or Q&A.
- No false `残りわずか` / low-stock urgency.
- No `一点もの` claim unless verified per SKU.
- No `送料無料` without an approved shipping rule and qualifying conditions.
- No guessed product dimensions, fibre composition, origin, artisan name, care directions or production method.
- Product price and order total must be computed and validated by the trusted server/backend, not accepted from browser-supplied price values.

---

## 9. Cart, checkout and customer account

The customer-facing purchase flow must feel coherent with the new theme but remain trustworthy and secure.

### 9.1 Cart

- Clear product image, name, selected options, quantity, unit price and line total.
- Edit/remove actions.
- Stock/reservation state reflected accurately.
- Shipping/tax estimate only when rules support a reliable estimate.
- Do not surprise customers with undisclosed charges at the last step.
- Empty cart should provide useful shopping paths.

### 9.2 Checkout

Use a clear, linear flow:

1. Customer/contact details.
2. Delivery address.
3. Delivery method and timing (only configured options).
4. Payment method (only enabled provider/methods).
5. Final order review with item, shipping, tax, discount and grand total breakdown.
6. Explicit final purchase action and confirmation state.

Japanese localisation requirements to assess and implement where supported:

- Postal code first, with Japanese postcode lookup if an approved service is configured.
- Prefecture/city/address conventions.
- Building/apartment field where relevant.
- Furigana field where appropriate for the customer/business workflow.
- Polite, specific field-level error messages.
- Clear distinction between required and optional fields.
- Correct JPY formatting and tax/shipping disclosures.

### 9.3 Payment methods

Research and evaluate methods relevant to Japanese customers (for example, credit cards, PayPay, convenience-store payment and other locally used methods) but implement only those supported by an approved payment provider and merchant account. Never display payment logos for methods that are not actually available.

**Do not activate live payments, webhooks or production checkout by changing UI code.** The repository README and checkout-phase documentation explicitly keep payment processing separately gated. Preserve that boundary until the owner approves the provider/security/webhook phase and all required tests pass.

### 9.4 Account, wishlist and orders

- Keep customer data scoped to the authenticated customer.
- Make account and order status labels natural Japanese.
- Wishlist must only be shown as a working feature.
- Do not expose admin or owner functionality in the public storefront.
- The internal owner/admin workspace may retain a separate operational UI; do not force consumer editorial styling onto admin screens.

---

## 10. Japanese localisation and customer trust

Japanese-first means a real Japanese user experience, not a translated English template.

### 10.1 Language

- Japanese is the default customer-facing language for the Japan store.
- Use fluent, natural Japanese reviewed by a native speaker or qualified localisation reviewer.
- Keep English only where it has a clear brand/product purpose.
- Do not expose raw translation keys, machine-translated fragments or inconsistent terminology.
- Maintain a glossary for product categories, craft/material terms, product status and checkout language.

### 10.2 Currency, prices and tax

- Use JPY for the Japan market where the commerce configuration supports it.
- Format prices naturally, e.g. `¥8,800`.
- Show tax treatment clearly and consistently; use `税込` only after tax configuration and legal treatment have been confirmed.
- Do not derive live prices from a rough FX conversion in frontend code.
- No placeholder or guessed prices in production.

### 10.3 Shipping and returns

Clearly state, based on verified policies:

- Dispatch country/location.
- Eligible delivery regions.
- Shipping charges and free-shipping conditions, if any.
- Handling/dispatch time.
- Delivery estimate/range and known limitations.
- Carrier/tracking availability, if supported.
- Duties/import tax responsibility, if applicable.
- Return/exchange window, eligible conditions and return-shipping responsibility.
- Cancellation process and customer contact route.

These details must be configured from approved merchant data and legal/policy review, not invented by the design team.

### 10.4 Legal and operator information

Create or verify the correct Japanese legal information destinations, including `特定商取引法に基づく表記` and privacy policy. Have the responsible merchant/legal reviewer confirm the actual legal operator, seller, address, telephone/contact details, payment, delivery and cancellation disclosures. Do not fabricate a Japanese address, local office, registration number, telephone number or company identity.

### 10.5 Trust presentation

The site should make real trust evidence easy to find:

- Named legal seller/operator and contact details.
- Real company/contact information.
- Clear shipping, payment and return policies.
- Genuine product photography and accurate specifications.
- Real reviews only after verified collection and moderation.
- Secure checkout cues only where technically true.
- A responsive support route with a credible response expectation; do not promise same-day responses unless operationally agreed.

---

## 11. Photography and content art direction

### 11.1 Photography priorities

The photos do more selling than decorative gradients or elaborate animations.

Create or commission photography that shows:

- Products clearly, with accurate colour and texture.
- Products in context in contemporary homes and everyday use.
- Useful close-ups of weave, print, stitching, surface and material.
- Product scale through honest, proportionate context.
- The making process and maker only when accurately documented and authorised.
- Packaging only if it represents what customers actually receive.

### 11.2 Product card imagery

- Use consistent crop ratios and enough resolution for retina displays.
- Avoid cropping away essential product details.
- Use neutral backgrounds where lifestyle images make comparison difficult.
- Use hover alternate images only when a real alternate exists.
- Preserve a fast-loading first image and lazy-load below-the-fold media.

### 11.3 Image rights and storage

Follow `docs/PRODUCT-IMAGE-INTAKE.md` and the existing private media flow. Every public image must have documented commercial usage rights/owner approval. Use local or approved application-managed media paths, not hotlinked search-result assets. Do not commit private intake photographs or customer images.

### 11.4 Editorial tone

- Calm, warm, specific and human.
- Explain why an object is worth considering.
- Use short headlines and informative supporting descriptions.
- Avoid exoticising language, stereotypes, generic “mystical East” storytelling or unsupported sustainability/ethical claims.
- Avoid exaggerated superlatives such as “best in Japan”, “100% authentic”, “rare”, “luxury” or “one-of-a-kind” unless substantiated and approved.
- Do not turn the brand story into a Rajasthan tourism brochure.

---

## 12. SEO, accessibility, performance and technical UX

### 12.1 Japanese SEO

- Provide accurate Japanese page titles, meta descriptions, canonical URLs and Open Graph metadata.
- Use natural Japanese category/product URLs where the existing routing strategy safely supports them; do not break current URLs without redirect mapping.
- Add Product structured data only from verified product data, including price, currency, availability and images.
- Add Breadcrumb structured data for relevant routes.
- Provide a Japanese content plan for category guides, material/care guides, gifting and craft stories based on real expertise.
- Avoid thin, duplicated or machine-translated pages.

### 12.2 Accessibility

- Semantic headings in a meaningful hierarchy.
- Keyboard-operable menus, filters, dialogs and galleries.
- Visible focus rings.
- Useful alt text for informative images; empty alt for decorative imagery.
- Sufficient text and control contrast.
- Reduced-motion support.
- Accessible field labels and error associations.
- Screen-reader announcements for cart updates and validation.
- Do not rely on colour or icon alone to communicate state.

### 12.3 Performance

- Use Next.js image optimisation or the repository's established media strategy.
- Prefer responsive image sources and modern image formats where supported.
- Avoid shipping large desktop hero images to mobile.
- Minimise client-side JavaScript and animation libraries.
- Prevent layout shifts by reserving appropriate image space.
- Use caching/CDN strategy consistent with deployment architecture.
- Measure Core Web Vitals and page load from Japan or representative Asia-Pacific test locations before launch.

### 12.4 Responsive test targets

At minimum test:

- Small mobile: 360px viewport.
- Common mobile: 390–430px viewport.
- Tablet: approximately 768px.
- Laptop: 1280–1440px.
- Wide desktop: 1600px and above.

Test real Japanese copy lengths; a layout that works with short English placeholders is not sufficient.

---

## 13. Explicit DO / DON'T rules

### DO

- DO replace the entire public-facing visual theme and customer-facing page templates.
- DO treat the storefront as ecommerce first and editorial storytelling second.
- DO use POJ Studio for premium editorial/product-story inspiration.
- DO use Macaroni Shoten for Japanese curation/category-discovery inspiration.
- DO follow Japanese shopping conventions where they reduce uncertainty: search, category navigation, breadcrumbs, sort/filter, item counts, tax/pricing clarity, delivery information, returns, operator details and clear checkout.
- DO maintain a coherent design system shared across home, search, category, product, cart and content routes.
- DO design mobile as a primary use case, not merely a squeezed desktop.
- DO show actual products, product prices and purchase pathways early.
- DO make product specifications, materials, size and care details easy to find.
- DO use genuine, authorised photography.
- DO make Japanese content natural and professionally reviewed.
- DO preserve backend/API/data/security behaviour and existing release gates.
- DO update the master design brief and all affected repository documents as implementation evolves.
- DO record decisions, assumptions, blockers and test results.

### DON'T

- DON'T retain the old public theme and simply reskin it.
- DON'T make the homepage resemble a hotel, resort, travel agency, tourism bureau or destination guide.
- DON'T put a large landscape-only hero above a long brand introduction with no obvious shopping action.
- DON'T hide products several screens below the fold.
- DON'T use excessive whitespace at the expense of useful Japanese shopping information.
- DON'T turn the site into a cluttered discount marketplace with stacked flashing banners.
- DON'T copy POJ Studio or Macaroni's brand identity, exact components, content or images.
- DON'T fabricate product data, prices, stock, dimensions, variants, origin claims, artisans, reviews, rankings, shipping estimates, payment methods, discounts or policies.
- DON'T use external image hotlinks or assets without confirmed rights.
- DON'T display non-functional search, cart, wishlist, account, filter or checkout controls.
- DON'T display payment logos for methods that are not enabled.
- DON'T expose internal partner relationships as marketing content; also DON'T suppress legally required seller/operator information.
- DON'T change MySQL, Drizzle, Supabase, authentication, inventory or payment architecture as part of a visual-only task without an independently justified and reviewed technical plan.
- DON'T bypass inventory reservation, price snapshot, tax/shipping rules, RLS, owner security or webhook gates.
- DON'T claim launch readiness before route-by-route, responsive, accessibility, commerce and security validation.

---

## 14. Implementation phases and priorities

### Phase 0 — repository audit and baseline

- Confirm branch and working tree status.
- Read all repository agent instructions.
- Map all customer-facing routes and shared layouts.
- Identify current theme tokens, global CSS, header/footer, page templates and component dependencies.
- Identify which controls are working and which are placeholders.
- Capture baseline screenshots at mobile and desktop breakpoints.
- Run the existing lint, typecheck, tests and build to establish a baseline.
- Record current unresolved production-readiness items.

**Deliverable:** route/component inventory and a short replacement plan added to this brief.

### Phase 1 — new foundation and theme replacement (P0)

- Establish palette, typography, spacing, containers, grids, borders, shadows, buttons, links and focus states.
- Replace public storefront global styles/theme components.
- Build the Japanese-first header, desktop nav, mobile nav and footer.
- Remove legacy tourism/hotel presentation from public routes.
- Keep internal owner/admin screens separate.

**Exit criteria:** the new theme is the only active customer-facing design system; no old theme styles remain unintentionally in use.

### Phase 2 — core shopping pages (P0)

- Homepage.
- Shop-all/category/collection listing.
- Search/results.
- Product detail.
- Product image gallery and responsive product cards.

**Exit criteria:** visitors can discover a real published product, understand real purchase information and use supported shopping actions.

### Phase 3 — buying journey and trust (P0/P1)

- Cart.
- Checkout-facing screens consistent with approved backend capability.
- Customer account/order views if available.
- Shipping/returns/payment/help/legal pages only when approved and implemented.
- Japanese labels, forms, validation, address flow and trust content.

**Exit criteria:** no dead-end shopping controls and no inaccurate commerce promises. Live payment remains disabled until separately authorised.

### Phase 4 — editorial merchandising (P1)

- Collection campaigns.
- Craft/material stories.
- Styling inspiration.
- Gift discovery if genuinely supported.
- Journal/SEO content.

**Exit criteria:** editorial pages lead naturally back to products and are based on verified facts.

### Phase 5 — QA, optimisation and documentation (P0 before release)

- Visual QA on all routes and viewports.
- Japanese copy/layout QA.
- Accessibility and keyboard QA.
- Performance and image optimisation.
- Commerce regression tests.
- Update documentation and production-readiness register.

---

## 15. Documentation update obligations

**Do not finish the task after creating this file.** Audit every tracked Markdown document and relevant CSV/template/documentation file in the repository. Update each document that is affected by the new Japanese-first ecommerce direction, and add links to this master brief where useful.

Do not indiscriminately rewrite unrelated operational documents. Preserve their technical precision. When a document is not affected, leave it unchanged and record why it was excluded if the scope is ambiguous.

### Required documentation work

| File / area | Required action |
|---|---|
| `README.md` | Add a prominent link to `docs/JAPAN-ECOMMERCE-REDESIGN.md`. Replace outdated high-level description of the storefront only where needed. Keep local development, data safety, image rights, MySQL and release instructions accurate. |
| `docs/production-readiness.md` | Add a dated redesign section and update visual readiness, route coverage, Japanese localisation, accessibility, performance and QA status. Distinguish implemented code from merchant-connected/verified capabilities. Do not mark any item complete without evidence. |
| `docs/PRODUCT-IMAGE-INTAKE.md` | Add or cross-link the product photography art direction and remind operators that new presentation standards do not bypass image approval, rights checks, private intake or media import. |
| `docs/ETSY-LISTINGS-IMPORT.md` (if present) | Clarify that imported products remain drafts and that Japanese-facing titles/descriptions, price, stock, images and rights must be approved before publication. Do not change importer behaviour just for copy localisation. |
| `docs/MYSQL-ORDER-CHECKOUT-PHASE-7.md` | Add a brief cross-reference to the UX brief if checkout UI is changed. Preserve server-side pricing snapshots, shipping/tax rules, idempotency, ownership checks, inventory reservations and unpaid-draft safeguards. |
| `docs/LOCAL-MYSQL-DEVELOPMENT.md` | Usually no content changes required. Do not rewrite database installation/safety instructions for a theme project. Add only a link if it helps developers find the redesign brief. |
| Other docs under `docs/` | Audit all. Update any old theme, route, customer-facing copy, localisation, SEO, launch, visual QA or production-readiness assumptions affected by this brief. Preserve unrelated infrastructure/security instructions. |
| `data/product-import-template.csv` and related schemas | Inspect, but do not casually add columns or change importer contracts. If Japanese fields are needed, design a backwards-compatible schema/import plan and tests first. Never lose source product data. |
| `AGENTS.md` / agent instructions (if present) | Add a short pointer that this brief is the source of truth for the Japan-first storefront redesign, without duplicating the entire document. |

### Documentation consistency rules

- Update the master brief when implementation decisions, route status, design tokens or acceptance criteria change.
- Keep `docs/production-readiness.md` aligned with actual shipped code and test evidence.
- Remove contradictory statements only after verifying the relevant implementation status; preserve historical release notes rather than rewriting history.
- Add a dated change-log entry to each materially revised project document where that document uses dated status history.
- Update all references/links if files are renamed or routes change.
- Record any deferred requirement with an owner/input dependency and do not silently mark it done.

---

## 16. Acceptance criteria — definition of done

The redesign is not complete until all applicable items below pass.

### Brand and first impression

- [ ] A Japanese visitor understands within the first viewport that this is an ecommerce store.
- [ ] Product imagery, category discovery and a clear shopping CTA are visible immediately.
- [ ] The old hotel/tourism-style visual theme has been fully removed from public storefront routes.
- [ ] The visual direction feels consistent with the chosen POJ Studio × Macaroni Shoten inspiration without copying either site.

### Shopping structure

- [ ] Header search, categories, account/cart and all visible controls work.
- [ ] Homepage includes real category links and products where the catalogue is published.
- [ ] Category pages show real result counts, relevant sorting and functional filters where implemented.
- [ ] Product cards show accurate Japanese titles, prices and availability.
- [ ] Product details expose accurate specifications and purchase information.
- [ ] Cart and checkout UI reflect backend truth and do not accept client-supplied prices as authority.

### Japanese localisation and trust

- [ ] Japanese is the default experience for the Japan storefront.
- [ ] Japanese copy has been reviewed for naturalness and consistency.
- [ ] Japanese typography, line breaking, forms and address conventions work on actual viewport sizes.
- [ ] Price, tax, shipping, delivery, return and payment information is accurate and visible where relevant.
- [ ] Legal/operator information is accurate and reviewed by the responsible party.
- [ ] No fake reviews, rankings, artisan biographies, discounts, shipping promises or availability claims are displayed.

### Design and engineering quality

- [ ] Desktop, tablet and mobile layouts pass route-by-route visual QA.
- [ ] Keyboard navigation, focus states, contrast, reduced motion and screen-reader basics are tested.
- [ ] Images are authorised, optimised and served through the approved media architecture.
- [ ] No major console errors, broken routes, layout overflow or dead links remain.
- [ ] Lint, typecheck, tests and production build pass (or failures are explicitly documented with evidence).
- [ ] Existing database, authentication, catalogue, inventory, order and media safeguards remain intact.
- [ ] Live payments/deployment are not activated without separate owner approval and their own verification.

### Documentation

- [ ] This master brief reflects the actual implementation.
- [ ] README links to this brief.
- [ ] `docs/production-readiness.md` has an accurate, dated status update.
- [ ] All affected existing documents have been updated or explicitly judged unaffected.
- [ ] The final agent report lists changed files, tests, screenshots/QA evidence and remaining blockers.

---

## 17. Required final report from the AI agent

At the end of implementation, provide:

1. **Theme replacement summary:** what legacy public theme/layout/components were removed or replaced.
2. **New design system:** tokens, typography, shared components and responsive rules.
3. **Route-by-route summary:** homepage, category, search, product, cart, checkout, account, stories, support and legal routes.
4. **Commerce integrity summary:** what backend contracts were preserved and any integration limitations.
5. **Documentation summary:** every Markdown/documentation file updated and why.
6. **Validation summary:** commands run and exact pass/fail results.
7. **Visual QA evidence:** desktop and mobile screenshots or an explicit statement explaining what could not be captured.
8. **Merchant dependencies:** product data, images/rights, Japanese copy, shipping/tax/policies, legal operator details, payment provider or customer support information still needed.
9. **Release recommendation:** ready for internal review, ready for staging, or not ready—and why.

Do not provide a blanket “complete” status if any of the above areas have not been checked.

---

## 18. Research links

- [POJ Studio — official website](https://pojstudio.com/)
- [POJ Studio ecommerce renewal case study](https://commerce-media.info/en/blogs/works/poj-studio)
- [Macaroni Shoten — online shop](https://shop.macaro-ni.jp/)
- [Macaroni Shoten — About](https://shop.macaro-ni.jp/about)
- [TokyoTronic — How Japanese Ecommerce Pages Are Laid Out, Explained (4 October 2026)](https://www.tokyotronic.com/how-japanese-ecommerce-pages-are-laid-out/)
- [Nextcreative — Japanese Web Design: What Foreign Companies Need to Know (18 September 2026)](https://nextcreative.jp/en/blog/japanese-web-design-foreign-companies)
- [Baymard Institute — Ecommerce UX research](https://baymard.com/research)

These are design research references, not legal advice or a substitute for usability testing with Japanese customers.

---

## 19. Change log

| Date | Change |
|---|---|
| 2026-11-04 | Initial master brief created. Establishes full public-facing theme replacement; POJ Studio × Macaroni Shoten creative direction; Japanese ecommerce information architecture, localisation, trust, commerce safeguards, implementation phases, documentation obligations and acceptance criteria. |

**Ongoing rule:** The AI agent must update this file as the implementation evolves and keep it consistent with the code, route map, design tokens, production-readiness register and all affected project documentation.