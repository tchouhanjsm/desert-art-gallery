# Desert Art Gallery — Owner Operations Portal

**Status:** Phase 2 UI foundation and Phase 3 editorial CMS implemented; live operational acceptance pending  
**Design direction:** Gallery Operations — warm neutral workspace with deep-ink navigation  
**Data source:** Existing Supabase-backed repositories and actions pending planned MySQL migration

## Product objective

The portal is for a gallery owner, not a developer. Daily tasks must be discoverable and possible without GitHub, a database console or a deployment.

## Navigation

- Overview
- Products
- Media library
- Website content
- Orders
- Customers
- Shipping & tax
- Public storefront
- Sign out

The admin area has its own application shell. Public storefront header/footer are hidden on `/admin/*`. Routes remain protected by the existing authentication middleware and server-side action permission checks.

## Visual system

- Deep ink sidebar with restrained brass/terracotta detail.
- Warm off-white work surface and white cards.
- Cormorant Garamond for high-level page headings and summary figures.
- DM Sans for tables, labels, navigation and form controls.
- Strong visible action hierarchy, short labels and practical feedback states.
- Responsive off-canvas sidebar on smaller screens.

## Implemented UI foundations

- Dedicated nested admin layout and responsive navigation shell.
- Overview metric cards, activity tables, low-stock panels and quick actions styled.
- Product catalogue, product editor, order/customer/content pages receive common form/table styling.
- Media library route lists product images from the existing product media table and provides:
  - Product-associated upload
  - Descriptive alt text
  - Private-storage upload
  - Rights evidence and explicit confirmation
  - Primary-image selection
  - Display-order updates
- Sign-out and public-storefront links are available in the portal shell.

## Media integrity and rights workflow

Uploads use the existing server action, which validates file type/signature and the 12 MB limit, creates a unique storage path and records image metadata. New images remain private and unapproved until explicit rights evidence is recorded. A primary image can only be selected through the existing database RPC once the image is rights-confirmed.

The media library does not claim to be provider-independent storage. The current implementation still uses the current Supabase private bucket until the later backend and hosting migration is implemented.

## Not included in this phase

- Supabase-to-MySQL migration.
- Persistent media implementation for Hostinger.
- Full CMS editing for home hero, collections and editorial content.
- Bulk image deletion or storage orphan cleanup.
- Payment provider or order-creation changes.

## Owner acceptance journey

1. Sign in as an administrator/owner.
2. Open Media library.
3. Select an existing draft product.
4. Upload an original image and provide alt text.
5. Record rights evidence and explicitly confirm authorization.
6. Set the approved image as primary and adjust its gallery position.
7. Open the product editor and publish only after required verified details are complete.
8. Verify the approved image appears on the storefront.

## Review before handover

- [ ] Confirm all pages are usable at desktop and mobile widths.
- [ ] Verify admin role protection and sign-out.
- [ ] Test media upload with valid and invalid file signatures.
- [ ] Verify rights confirmation and primary-image RPC.
- [ ] Verify images remain private until approval.
- [ ] Validate media URL expiry and refresh behaviour.
- [ ] Test all product/order/customer links.


## Public storefront boundary — Japan-first redesign (2026-11-04)

The public customer storefront now follows [Japan-First Ecommerce Redesign](./JAPAN-ECOMMERCE-REDESIGN.md). This does not change the owner portal's role, permissions or operational workflow. Keep `/admin` and `/owner` on their separate operations-focused UI; do not force Japanese consumer storefront navigation, category merchandising or customer-facing typography onto owner forms/tables. The owner workspace remains responsible for catalogue verification, Japanese product-copy entry/review, category mapping, photo-to-product approval, image-rights evidence, merchant policy configuration and controlled publication.
