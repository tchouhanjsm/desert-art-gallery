# Desert Atelier — Storefront Design System

**Status:** Phase 0 foundation implemented; visual review required  
**Theme:** Desert Atelier — Contemporary Heritage  
**Applies to:** Public customer storefront  
**Owner portal:** Separate operations-focused interface; Tailwind Admin remains its reference

## Design idea

The storefront should feel like entering a carefully edited gallery: warm, tactile and quietly confident. The design uses editorial typography, generous negative space, large image fields, calm navigation and concise commerce information. It should not resemble a generic marketplace or SaaS dashboard.

The visual concept is deliberately restrained so that the gallery's real photography—not decorative UI—becomes the primary visual asset once approved media is supplied.

## Visual direction

- Warm gallery ivory and paper surfaces.
- Deep ink for navigation, footer and strong actions.
- Terracotta for selected emphasis and links.
- Antique brass for fine details and separators.
- Muted sage used sparingly.
- Cormorant Garamond Variable for editorial headings.
- DM Sans Variable for interface, navigation and metadata.

## Initial design tokens

| Token | Value | Role |
|---|---|---|
| Gallery ivory | `#F7F4EE` | Main page surface |
| Gallery paper | `#FBF9F5` | Content sections |
| Warm stone | `#E8DFD2` | Collection surfaces |
| Sand | `#D8C8B2` | Image fields and subtle accents |
| Deep ink | `#28241F` | Text and dark panels |
| Muted text | `#756B60` | Secondary content |
| Terracotta | `#A65D45` | Primary accent |
| Dark terracotta | `#814632` | Text links and hover |
| Antique brass | `#A88D61` | Dividers and highlights |
| Muted sage | `#737664` | Reserved secondary accent |

Tokens are centrally defined in `src/styles/theme.css`. They are initial values, not a claim of completed contrast certification. Check text/background combinations in context before production.

## Homepage composition

1. **Announcement strip:** location and gallery subject, short and quiet.
2. **Utility header:** search, centred wordmark, account, wishlist and bag.
3. **Primary navigation:** shop, collections, story and supporting routes.
4. **Hero:** high-impact editorial statement over a full-bleed, approved gallery image or neutral art-direction placeholder.
5. **Information strip:** location and direct contact path.
6. **Gallery introduction:** split image/copy composition.
7. **Collection discovery:** image-led category cards.
8. **Featured catalogue:** reusable product cards with clear detail, price or enquiry state.
9. **Story interlude:** darker editorial panel linking to the gallery story.
10. **Gallery principles:** clear details, responsible representation and direct conversation.
11. **Contact close:** one direct action.

## Product card behaviour

- Photograph occupies the majority of card area.
- Category is compact uppercase metadata.
- Product title uses display typography.
- Short note is optional and must not invent product attributes.
- Price appears only when a real price and currency are available.
- Otherwise show "Price on enquiry".
- Development-only records show a visible "Preview artwork" label.
- The card links to the existing product route.

## Product detail composition

- Breadcrumb and category context.
- Image gallery is the primary visual column.
- Product title, note and price/enquiry panel are grouped in the detail column.
- Stock status is explicit and does not imply availability when stock is missing.
- Purchase controls remain subject to current server-side commerce eligibility.
- Product attributes are rendered only when supplied.
- Product photography in development fallback is visibly identified as a preview.

## Shop composition

- Editorial title and short explanation.
- Published item count.
- Search, category filter and sort controls.
- Responsive product grid.
- Useful no-results and empty-catalogue states.
- Query state remains in the URL for sharing and browser navigation.

## Motion and accessibility

- Use motion to signal hover/focus, not to decorate every element.
- Respect `prefers-reduced-motion`.
- Maintain visible keyboard focus.
- Keep semantic headings and landmarks.
- Use descriptive alt text for meaningful gallery imagery.
- Decorative image fields use empty alt text.
- Ensure mobile controls remain large enough to operate comfortably.
- Complete a contrast and keyboard audit before launch.

## Media integrity

The current repository contains a textile-themed placeholder SVG and development-only product records. These are suitable only for design previews. They are not actual product photographs and must not be represented as real inventory imagery.

Production product photography must be supplied or approved by the gallery with usage rights and accurate alt text. Do not invent provenance, maker details, dimensions, reviews or stock claims to fill visual space.

## Template decisions

- Storefront: bespoke implementation in the existing Next.js application. Epic Design Labs' Next.js Ecommerce Starter is a reference for accessible interaction patterns only; its current Next.js 16 package is not a direct drop-in for this Next.js 15 application.
- Owner portal: Tailwind Admin's MIT-licensed Next.js version is the selected component reference for the later owner-portal phase. It must be selectively adapted and must not replace the storefront.
- Preserve upstream licence and copyright notices for any code copied or adapted.

## Review checklist

- [ ] Review homepage at desktop, tablet and mobile widths.
- [ ] Review shop controls and product grid at desktop and mobile widths.
- [ ] Review product gallery, sticky details and purchase controls.
- [ ] Review keyboard focus and reduced-motion behaviour.
- [ ] Check colour contrast of all text/action states.
- [ ] Replace placeholders with approved gallery imagery before production.
- [ ] Confirm all existing route and commerce behaviours remain intact.
- [ ] Run typecheck, unit tests, lint and production build locally.
