# Repository agent instructions

Before changing customer-facing storefront, merchandising, localisation, UX, UI or visual QA, read `docs/JAPAN-ECOMMERCE-REDESIGN.md` in full. It is the source of truth from 4 November 2026 onward.

- Follow its Japanese-first POJ Studio × Macaroni Shoten direction. The previous Desert Atelier / Desert Modern storefront themes are superseded.
- Audit the checked-out branch, routes, components, docs and tests before editing. Keep the master brief, route map and affected documentation aligned with implementation.
- Preserve backend/API/data/authentication/inventory/order/payment/media-rights boundaries unless a separate reviewed plan authorises a change.
- Keep owner/admin experiences separate from the public customer storefront.
- Do not fabricate product information, Japanese translations, JPY prices, stock, variants, reviews, shipping/returns/legal details or seller identity.
- Keep Etsy imports as drafts and recovered images private. Never commit source exports, `.local-data`, credentials or original photo archives.
- Run typecheck, tests, lint and production build; attach route-by-route visual, Japanese typography, accessibility and performance evidence before calling the storefront ready.
