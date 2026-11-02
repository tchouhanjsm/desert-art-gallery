-- Owner-managed editorial CMS media metadata and public-read safeguards.
-- Existing Supabase media remains private until content and image rights are approved.

alter table public.collections
  add column if not exists hero_image_alt text not null default '',
  add column if not exists hero_image_rights_evidence text not null default '';

alter table public.artisan_profiles
  add column if not exists portrait_alt_text text not null default '';

alter table public.journal_posts
  add column if not exists cover_image_alt text not null default '';

alter table public.collections
  drop constraint if exists collection_hero_rights_evidence_required;
alter table public.collections
  add constraint collection_hero_rights_evidence_required
  check (not hero_image_rights_confirmed or length(btrim(hero_image_rights_evidence)) > 0);

-- Homepage hero images are stored on the published homepage content record.
-- This storage policy allows public reads only after both publication and rights confirmation.
drop policy if exists site_content_hero_media_public_read on storage.objects;
create policy site_content_hero_media_public_read
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'product-media'
  and exists (
    select 1
    from public.site_content content
    where content.is_published = true
      and content.body ->> 'hero_image_path' = name
      and content.body ->> 'hero_image_rights_confirmed' = 'true'
      and length(btrim(coalesce(content.body ->> 'hero_image_alt', ''))) > 0
      and length(btrim(coalesce(content.body ->> 'hero_image_rights_evidence', ''))) > 0
  )
);

comment on column public.collections.hero_image_alt is 'Descriptive alternative text for the collection hero image.';
comment on column public.collections.hero_image_rights_evidence is 'Evidence reference required when collection hero image rights are confirmed.';
comment on column public.artisan_profiles.portrait_alt_text is 'Descriptive alternative text for an approved maker portrait.';
comment on column public.journal_posts.cover_image_alt is 'Descriptive alternative text for the approved journal cover.';
