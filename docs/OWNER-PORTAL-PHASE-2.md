# Owner Portal — Phase 2 Implementation

**Status:** Implemented UI foundation; live operational acceptance remains pending  
**Theme:** Desert Art Gallery Owner Workspace  
**Branch:** `feat/desert-atelier-storefront-phase0-1`

## What changed

- Added a dedicated nested admin layout so the owner workspace no longer displays the public storefront header/footer.
- Added responsive owner navigation for overview, products, media, orders, customers, site content and shipping/tax.
- Replaced the basic admin overview with live operational metrics, recent orders, low-stock products, recently updated catalogue records and quick actions.
- Added a central read-only media library that aggregates product image records, signs previews for authenticated administrators, and links to the product editor for rights confirmation, ordering and primary-image management.
- Refreshed the product catalogue list around the new owner workspace UI.
- Redesigned Contact and Story pages to provide a clearer enquiry path and more coherent editorial layouts.
- Added separate owner-workspace styling so operations UI remains distinct from the customer storefront theme.

## Important scope boundaries

- Existing Supabase-backed server operations remain in use for this phase. The planned MySQL/Drizzle/Better Auth migration is not included.
- The media library currently indexes product images. It does not yet provide a standalone cross-site upload destination; uploads continue through a product editor so every image is attached to a product and can be governed by product-level usage-rights checks.
- Site content records are still read-only in the existing content page. Full homepage/collection/artisan/journal CRUD is a later milestone.
- The customer storefront still uses development placeholder artwork. It is not production photography and must be replaced with owner-approved images.
- No Hostinger deployment, purchase or migration is included.

## Owner portal acceptance scenarios

1. An authorised owner opens `/admin` and sees database-backed counts and operational links.
2. The owner navigates between Products, Media, Orders, Customers and Content using the dedicated owner navigation.
3. The owner opens Media library and can identify whether each product image has confirmed usage rights.
4. The owner follows a media record to its product editor to reorder, set primary, upload or confirm rights.
5. The owner can return to the public storefront without seeing owner controls there.
6. A mobile-width owner can reach every workspace section through the horizontally scrollable navigation.

## Follow-up work

- Build dedicated collection, homepage, artisan and journal editors with draft/preview/publish lifecycle.
- Add safe standalone media workflows only when a clear content target and ownership relationship are defined.
- Add audit views for content and inventory actions.
- After MySQL migration, port the same domain operations and UI without changing owner-facing workflows.
- Conduct local browser acceptance and role/permission testing before handover.
