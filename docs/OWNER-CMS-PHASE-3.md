# Owner CMS — Phase 3 Implementation

**Status:** Implemented on the feature branch; database migration and live acceptance pending  
**Audience:** Gallery owner, project maintainer and release reviewer

## Scope delivered

The existing owner portal now has an editable content workspace at `/admin/content` for four content areas:

1. Homepage hero content.
2. Product collections.
3. Maker profiles.
4. Journal and editorial stories.

The work reuses the current Next.js admin shell, Supabase server client, private `product-media` bucket and existing role checks. It does not migrate the backend to MySQL and does not deploy to Hostinger.

## Owner workflows

### Homepage

- Edit eyebrow, two-line headline with accent words, description and two CTA labels.
- Save and explicitly publish the homepage record.
- Upload a homepage hero image, add descriptive alt text, and record usage-rights evidence.
- The storefront reads only published homepage content.
- The uploaded hero image is delivered only when the rights confirmation and evidence are present.

The first homepage record is created by saving its text. Refresh the content page, then upload the hero image to that record.

### Collections

- Create collections as drafts.
- Edit name, slug, description and display order.
- Upload a collection hero image with alt text.
- Confirm rights with an evidence reference.
- Publish only when an attached image has confirmed rights.

Approved hero imagery is used on the homepage collection card and the collection detail page.

### Maker profiles

- Create new profiles as drafts.
- Edit the approved display name, role, short bio, full biography, specialties, years of experience and order.
- Upload a portrait with alt text and usage-rights evidence.
- Publish only after the profile and any attached portrait are approved.

The public maker page displays the biography and uses the approved portrait's alt text. Names, personal stories, portraits and experience information must be supplied and reviewed by the people featured; the software does not invent or verify those claims.

### Journal

- Create story drafts with title, slug, category, excerpt and Markdown content.
- Edit stories and change status between draft, published and archived.
- Upload a cover image, add alt text and confirm usage rights.
- Publication sets the published timestamp; archiving removes the story from public listing and article queries.

The article renderer supports paragraphs plus `##` and `###` headings. It treats other Markdown as plain text; it is not a full Markdown or HTML renderer.

## Media and rights controls

- Editorial uploads use the private `product-media` bucket.
- Accepted file types: JPEG, PNG, WebP and AVIF.
- Maximum file size: 12 MB.
- The file signature is checked against the declared MIME type.
- Filenames are generated with UUIDs and placed under a target-specific editorial prefix.
- New uploads reset rights-confirmed state and clear old evidence.
- Public media access is restricted by storage policies to content that is published, rights-confirmed and has the required evidence. Descriptive alt text is also required for homepage and collection hero images.
- If database metadata cannot be saved, the just-uploaded object is removed.

Replacing an image does not automatically delete the previous object. Orphan cleanup and a reusable asset library remain future work; this avoids deleting an image that might still be referenced elsewhere.

## Required database migration

New metadata columns and a storage read policy are added by:

`supabase/migrations/202611020006_owner_cms_media.sql`

Apply it **after** the existing migrations 001–005. The migration fails closed for legacy collection image approvals that do not have both an alt text and rights evidence: those approvals are revoked before the new constraint is added. An owner must review and reconfirm those images.

The migration has not been applied to a live database as part of this code change. Until it is applied, the content workspace will show a schema compatibility message and the new CMS data queries cannot operate.

## Storefront integration

- Homepage hero copy reads the published `site_content` record, with the existing editorial defaults used when no published record exists.
- Homepage hero image is shown only when approved and its signed URL can be created.
- Collection card and detail pages use the approved collection hero image and descriptive alt text.
- Public maker and journal pages use the owner-managed portrait/cover alt text.

## Explicit boundaries

- The current data layer remains Supabase/PostgreSQL for this phase. The planned MySQL/Drizzle/Better Auth migration is still a later phase.
- This CMS does not claim that local or Hostinger media storage is production-ready.
- Hostinger plan selection, purchase, deployment and durable upload-volume proof are deferred.
- No payment gateway or order lifecycle changes are included.
- There is no general-purpose drag-and-drop page builder. The homepage editor controls the defined hero fields; layout changes remain code-reviewed work.
- There is no bulk media deletion/orphan cleanup yet.

## Acceptance checklist

- [ ] Apply migration 006 after migrations 001–005 in a disposable/test database.
- [ ] Confirm existing collection images lacking rights evidence are no longer approved.
- [ ] Save homepage text and verify it is reflected on the public homepage after publication.
- [ ] Upload a homepage hero image; verify it remains unavailable until rights are confirmed with evidence.
- [ ] Create, edit and publish a collection; verify its approved image appears in collection discovery and detail.
- [ ] Create a maker profile; verify draft profiles do not appear publicly and published profiles show their approved biography and portrait alt text.
- [ ] Create and publish a journal post; verify article text, cover, metadata and status transitions.
- [ ] Try unauthorised/non-admin actions and verify they are rejected by server checks and RLS.
- [ ] Test invalid file signatures, oversized files, missing alt text and missing evidence.
- [ ] Test all flows at desktop and mobile widths.
- [ ] Run typecheck, unit tests, lint and production build.
- [ ] Confirm the migration and media backup/restore procedures before production handover.
