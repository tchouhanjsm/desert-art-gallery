-- Desert Art Gallery commerce foundation
-- Apply with Supabase CLI migrations. No payment/card data is stored here.
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer','staff','admin','owner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin','owner')
  );
$$;

create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if new.role is distinct from old.role
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and not public.is_admin() then
    raise exception 'Only an administrator can change account roles';
  end if;
  return new;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  hero_image_path text,
  hero_image_rights_confirmed boolean not null default false,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  slug text not null unique,
  short_description text not null default '',
  description text not null default '',
  sku text unique,
  currency char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  price_minor bigint check (price_minor is null or price_minor >= 0),
  compare_at_price_minor bigint check (compare_at_price_minor is null or compare_at_price_minor >= 0),
  quantity_on_hand integer not null default 0 check (quantity_on_hand >= 0),
  status text not null default 'draft' check (status in ('draft','active','archived')),
  is_one_of_a_kind boolean not null default false,
  materials text[] not null default '{}',
  sizes text[] not null default '{}',
  measurements jsonb not null default '{}'::jsonb,
  condition_notes text not null default '',
  provenance text not null default '',
  craft_story text not null default '',
  seo_title text,
  seo_description text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint active_products_require_price check (status <> 'active' or price_minor is not null),
  constraint compare_price_not_below_price check (
    compare_at_price_minor is null or price_minor is null or compare_at_price_minor >= price_minor
  )
);

create index if not exists products_status_published_idx on public.products(status, published_at desc);
create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_search_idx on public.products using gin (
  to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(short_description,'') || ' ' || coalesce(description,''))
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null unique,
  alt_text text not null,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  rights_confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.collection_products (
  collection_id uuid not null references public.collections(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (collection_id, product_id)
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  quantity_delta integer not null check (quantity_delta <> 0),
  reason text not null,
  reference text,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists inventory_movements_product_date_idx on public.inventory_movements(product_id, created_at desc);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipient_name text not null,
  address_line_1 text not null,
  address_line_2 text,
  city text not null,
  region text,
  postal_code text not null,
  country_code char(2) not null,
  phone text,
  is_default_shipping boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists addresses_user_idx on public.addresses(user_id);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending_payment' check (status in ('pending_payment','paid','processing','shipped','delivered','cancelled','refunded')),
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  shipping_minor bigint not null default 0 check (shipping_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  total_minor bigint not null check (total_minor >= 0),
  shipping_address jsonb not null,
  billing_address jsonb,
  customer_note text,
  tracking_carrier text,
  tracking_number text,
  tracking_url text,
  placed_at timestamptz not null default now(),
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_user_date_idx on public.orders(user_id, created_at desc);
create index if not exists orders_status_date_idx on public.orders(status, created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_title text not null,
  product_sku text,
  quantity integer not null check (quantity > 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  line_total_minor bigint not null check (line_total_minor >= 0),
  selected_options jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items(order_id);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  selected_options jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id, selected_options)
);
create index if not exists cart_items_user_idx on public.cart_items(user_id);

create table if not exists public.wishlist_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null default '',
  discount_type text not null check (discount_type in ('percentage','fixed')),
  discount_value integer not null check (discount_value > 0),
  currency char(3),
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  usage_count integer not null default 0 check (usage_count >= 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country_codes text[] not null default '{}',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.shipping_zones(id) on delete cascade,
  name text not null,
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor >= 0),
  min_delivery_days integer check (min_delivery_days is null or min_delivery_days >= 0),
  max_delivery_days integer check (max_delivery_days is null or max_delivery_days >= min_delivery_days),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_content (
  id uuid primary key default gen_random_uuid(),
  content_key text not null unique,
  title text not null default '',
  body jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  customer_display_name text not null,
  rating smallint not null check (rating between 1 and 5),
  review_text text not null,
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected')),
  source text not null default 'website' check (source in ('website','etsy','other')),
  permission_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log(created_at desc);

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  processing_error text,
  received_at timestamptz not null default now(),
  unique(provider, provider_event_id)
);

-- Updated-at triggers.
do $$
declare t text;
begin
  foreach t in array array['profiles','categories','collections','products','addresses','orders','cart_items','discount_codes','shipping_zones','shipping_rates','site_content','customer_reviews'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role before update on public.profiles
for each row execute function public.protect_profile_role();

-- Enable RLS on every application table.
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.collections enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.collection_products enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.cart_items enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.discount_codes enable row level security;
alter table public.shipping_zones enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.site_content enable row level security;
alter table public.customer_reviews enable row level security;
alter table public.audit_log enable row level security;
alter table public.payment_webhook_events enable row level security;

-- Profiles: users read/update their own contact fields; role changes are trigger-protected.
drop policy if exists profiles_read_self_or_admin on public.profiles;
create policy profiles_read_self_or_admin on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin on public.profiles for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Public catalogue only exposes published records. Drafts remain administrator-only.
drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories for select to anon, authenticated
using (is_published or public.is_admin());
drop policy if exists categories_admin_all on public.categories;
create policy categories_admin_all on public.categories for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists collections_public_read on public.collections;
create policy collections_public_read on public.collections for select to anon, authenticated
using (is_published or public.is_admin());
drop policy if exists collections_admin_all on public.collections;
create policy collections_admin_all on public.collections for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select to anon, authenticated
using (status = 'active' or public.is_admin());
drop policy if exists products_admin_all on public.products;
create policy products_admin_all on public.products for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists product_images_public_read on public.product_images;
create policy product_images_public_read on public.product_images for select to anon, authenticated
using (
  rights_confirmed and exists (
    select 1 from public.products p
    where p.id = product_id and p.status = 'active'
  )
  or public.is_admin()
);
drop policy if exists product_images_admin_all on public.product_images;
create policy product_images_admin_all on public.product_images for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists collection_products_public_read on public.collection_products;
create policy collection_products_public_read on public.collection_products for select to anon, authenticated
using (
  exists(select 1 from public.collections c where c.id = collection_id and c.is_published)
  and exists(select 1 from public.products p where p.id = product_id and p.status = 'active')
  or public.is_admin()
);
drop policy if exists collection_products_admin_all on public.collection_products;
create policy collection_products_admin_all on public.collection_products for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Private customer data.
drop policy if exists addresses_owner_all on public.addresses;
create policy addresses_owner_all on public.addresses for all to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists orders_owner_read on public.orders;
create policy orders_owner_read on public.orders for select to authenticated
using (user_id = auth.uid() or public.is_admin());
drop policy if exists orders_admin_update on public.orders;
create policy orders_admin_update on public.orders for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists order_items_owner_read on public.order_items;
create policy order_items_owner_read on public.order_items for select to authenticated
using (exists(select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));
drop policy if exists order_items_admin_all on public.order_items;
create policy order_items_admin_all on public.order_items for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists cart_items_owner_all on public.cart_items;
create policy cart_items_owner_all on public.cart_items for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists wishlist_items_owner_all on public.wishlist_items;
create policy wishlist_items_owner_all on public.wishlist_items for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Commercial rules are not exposed to anonymous customers. Server-side service role evaluates discounts.
drop policy if exists discount_codes_admin_all on public.discount_codes;
create policy discount_codes_admin_all on public.discount_codes for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists shipping_zones_public_read on public.shipping_zones;
create policy shipping_zones_public_read on public.shipping_zones for select to anon, authenticated
using (is_active or public.is_admin());
drop policy if exists shipping_zones_admin_all on public.shipping_zones;
create policy shipping_zones_admin_all on public.shipping_zones for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists shipping_rates_public_read on public.shipping_rates;
create policy shipping_rates_public_read on public.shipping_rates for select to anon, authenticated
using (
  is_active and exists(select 1 from public.shipping_zones z where z.id = zone_id and z.is_active)
  or public.is_admin()
);
drop policy if exists shipping_rates_admin_all on public.shipping_rates;
create policy shipping_rates_admin_all on public.shipping_rates for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists site_content_public_read on public.site_content;
create policy site_content_public_read on public.site_content for select to anon, authenticated
using (is_published or public.is_admin());
drop policy if exists site_content_admin_all on public.site_content;
create policy site_content_admin_all on public.site_content for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists customer_reviews_public_read on public.customer_reviews;
create policy customer_reviews_public_read on public.customer_reviews for select to anon, authenticated
using ((moderation_status = 'approved' and permission_confirmed) or public.is_admin());
drop policy if exists customer_reviews_owner_submit on public.customer_reviews;
create policy customer_reviews_owner_submit on public.customer_reviews for insert to authenticated
with check (user_id = auth.uid() and moderation_status = 'pending' and permission_confirmed = false);
drop policy if exists customer_reviews_admin_all on public.customer_reviews;
create policy customer_reviews_admin_all on public.customer_reviews for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Operational/audit data is admin-read-only to end users. Trusted server routes use service_role.
drop policy if exists inventory_movements_admin_read on public.inventory_movements;
create policy inventory_movements_admin_read on public.inventory_movements for select to authenticated
using (public.is_admin());
drop policy if exists audit_log_admin_read on public.audit_log;
create policy audit_log_admin_read on public.audit_log for select to authenticated
using (public.is_admin());
drop policy if exists payment_webhook_events_admin_read on public.payment_webhook_events;
create policy payment_webhook_events_admin_read on public.payment_webhook_events for select to authenticated
using (public.is_admin());

-- Keep original media private until rights and publication state are checked by a server-side signed-URL route.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-media','product-media',false,12582912,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do nothing;

drop policy if exists product_media_authorized_public_read on storage.objects;
create policy product_media_authorized_public_read on storage.objects for select to anon, authenticated
using (
  bucket_id = 'product-media' and exists (
    select 1
    from public.product_images pi
    join public.products p on p.id = pi.product_id
    where pi.storage_path = name
      and pi.rights_confirmed = true
      and p.status = 'active'
  )
  or bucket_id = 'product-media' and exists (
    select 1 from public.collections c
    where c.hero_image_path = name
      and c.hero_image_rights_confirmed = true
      and c.is_published = true
  )
);

drop policy if exists product_media_admin_select on storage.objects;
create policy product_media_admin_select on storage.objects for select to authenticated
using (bucket_id = 'product-media' and public.is_admin());
drop policy if exists product_media_admin_insert on storage.objects;
create policy product_media_admin_insert on storage.objects for insert to authenticated
with check (bucket_id = 'product-media' and public.is_admin());
drop policy if exists product_media_admin_update on storage.objects;
create policy product_media_admin_update on storage.objects for update to authenticated
using (bucket_id = 'product-media' and public.is_admin())
with check (bucket_id = 'product-media' and public.is_admin());
drop policy if exists product_media_admin_delete on storage.objects;
create policy product_media_admin_delete on storage.objects for delete to authenticated
using (bucket_id = 'product-media' and public.is_admin());

comment on table public.products is 'Canonical product catalogue. Price values are in minor currency units; draft until verified.';
comment on table public.product_images is 'Private-storage media references. Rights confirmation is mandatory before publication.';
comment on table public.orders is 'Order data. Inserts and payment-state transitions are restricted to trusted server workflows.';
comment on table public.payment_webhook_events is 'Idempotency ledger for provider webhook events; never stores cardholder data.';
