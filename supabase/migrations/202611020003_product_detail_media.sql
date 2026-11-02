-- Product detail media ordering and publication accessibility safeguards.
-- This migration changes schema/functions only; it does not publish products or alter stock.

-- Retain one deterministic primary image per product before enforcing uniqueness.
with ranked_primary_images as (
  select
    id,
    row_number() over (
      partition by product_id
      order by sort_order asc, created_at asc, id asc
    ) as position
  from public.product_images
  where is_primary = true
)
update public.product_images as image
set is_primary = false
from ranked_primary_images as ranked
where image.id = ranked.id
  and ranked.position > 1;

create unique index if not exists product_images_one_primary_per_product_idx
on public.product_images(product_id)
where is_primary = true;

create index if not exists product_images_gallery_order_idx
on public.product_images(product_id, is_primary desc, sort_order asc, created_at asc);

-- A published product must have at least one rights-confirmed image with
-- meaningful alt text and a recorded rights-evidence reference.
create or replace function public.guard_product_publication()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $product_publish$
begin
  if new.status = 'active' then
    if new.price_minor is null then
      raise exception 'A verified price is required before publishing a product';
    end if;

    if not exists (
      select 1
      from public.product_images pi
      where pi.product_id = new.id
        and pi.is_primary = true
        and pi.rights_confirmed = true
        and length(btrim(pi.rights_evidence)) > 0
        and length(btrim(pi.alt_text)) > 0
    ) then
      raise exception 'A rights-confirmed product image with descriptive alt text is required before publishing';
    end if;

    if new.published_at is null then
      new.published_at = now();
    end if;
  end if;

  return new;
end;
$product_publish$;

-- Select the public-facing primary image in one transaction. The product row
-- lock serializes competing primary-image changes for the same product.
create or replace function public.set_product_primary_image(
  p_product_id uuid,
  p_image_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $set_primary_image$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator permissions are required';
  end if;

  if p_product_id is null or p_image_id is null then
    raise exception 'A product and image are required';
  end if;

  perform 1
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Product was not found';
  end if;

  if not exists (
    select 1
    from public.product_images
    where id = p_image_id
      and product_id = p_product_id
      and rights_confirmed = true
      and length(btrim(rights_evidence)) > 0
      and length(btrim(alt_text)) > 0
  ) then
    raise exception 'The primary image must belong to this product and have confirmed rights and descriptive alt text';
  end if;

  update public.product_images
  set is_primary = false
  where product_id = p_product_id
    and is_primary = true;

  update public.product_images
  set is_primary = true
  where id = p_image_id
    and product_id = p_product_id;

  return jsonb_build_object(
    'product_id', p_product_id,
    'image_id', p_image_id,
    'primary_selected', true
  );
end;
$set_primary_image$;

revoke all on function public.set_product_primary_image(uuid, uuid) from public;
revoke all on function public.set_product_primary_image(uuid, uuid) from anon;
grant execute on function public.set_product_primary_image(uuid, uuid) to authenticated;

comment on function public.set_product_primary_image(uuid, uuid) is
  'Admin-only transactional primary-image selection. The selected image must have confirmed usage rights and descriptive alt text.';
