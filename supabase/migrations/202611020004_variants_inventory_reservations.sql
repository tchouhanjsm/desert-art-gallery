-- Product variants and short-lived inventory reservations.
-- This migration does not create orders, capture payment or promise delivery.
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text unique,
  label text not null check (length(btrim(label)) between 1 and 120),
  attributes jsonb not null check (jsonb_typeof(attributes) = 'object' and attributes <> '{}'::jsonb),
  price_override_minor bigint check (price_override_minor is null or price_override_minor >= 0),
  quantity_on_hand integer not null default 0 check (quantity_on_hand >= 0),
  status text not null default 'draft' check (status in ('draft','active','archived')),
  sort_order integer not null default 0 check (sort_order between 0 and 9999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, label),
  unique (product_id, attributes)
);

create index if not exists product_variants_product_status_order_idx
on public.product_variants(product_id, status, sort_order, created_at);

create or replace function public.guard_product_variant_status()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $variant_status$
declare
  v_product_status text;
  v_base_price bigint;
  v_active_reservations bigint;
begin
  if tg_op = 'UPDATE' and new.product_id is distinct from old.product_id then
    raise exception 'A product variant cannot be moved to another product';
  end if;

  -- Serialize all variant edits with reservation and stock-adjustment locks.
  select status, price_minor into v_product_status, v_base_price
  from public.products where id = new.product_id for update;
  if not found then raise exception 'Parent product was not found'; end if;

  if new.status = 'active' then
    if v_product_status is distinct from 'active' or v_base_price is null then
      raise exception 'A variant can be activated only for an active product with a verified base price';
    end if;
    if tg_op = 'INSERT' or new.status is distinct from old.status then
      select coalesce(sum(ri.quantity), 0) into v_active_reservations
      from public.inventory_reservation_items ri
      join public.inventory_reservations r on r.id = ri.reservation_id
      where ri.product_id = new.product_id
        and ri.variant_id is null
        and r.status = 'reserved'
        and r.expires_at > now();
      if v_active_reservations > 0 then
        raise exception 'Product-level reservations prevent activating variants';
      end if;
    end if;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    select coalesce(sum(ri.quantity), 0) into v_active_reservations
    from public.inventory_reservation_items ri
    join public.inventory_reservations r on r.id = ri.reservation_id
    where ri.product_id = new.product_id
      and r.status = 'reserved'
      and r.expires_at > now();
    if v_active_reservations > 0 then
      raise exception 'Active reservations prevent changing variant publication state';
    end if;
  end if;
  return new;
end;
$variant_status$;

drop trigger if exists guard_product_variant_status on public.product_variants;
create trigger guard_product_variant_status
before insert or update on public.product_variants
for each row execute function public.guard_product_variant_status();

create or replace function public.guard_product_variant_inventory_balance()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $variant_inventory$
begin
  if coalesce(current_setting('app.inventory_adjustment', true), '') <> 'on' then
    if tg_op = 'INSERT' and new.quantity_on_hand <> 0 then
      raise exception 'Initial variant stock must be recorded through the inventory adjustment workflow';
    end if;
    if tg_op = 'UPDATE' and new.quantity_on_hand is distinct from old.quantity_on_hand then
      raise exception 'Variant stock must be changed through the inventory adjustment workflow';
    end if;
  end if;
  return new;
end;
$variant_inventory$;

drop trigger if exists guard_product_variant_inventory_balance on public.product_variants;
create trigger guard_product_variant_inventory_balance
before insert or update of quantity_on_hand on public.product_variants
for each row execute function public.guard_product_variant_inventory_balance();

alter table public.inventory_movements
  add column if not exists variant_id uuid references public.product_variants(id) on delete set null;
create index if not exists inventory_movements_variant_date_idx
on public.inventory_movements(variant_id, created_at desc)
where variant_id is not null;

create table if not exists public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null check (length(btrim(idempotency_key)) between 8 and 100),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'reserved' check (status in ('reserved','released','expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index if not exists inventory_reservations_active_expiry_idx
on public.inventory_reservations(status, expires_at);
create index if not exists inventory_reservations_user_date_idx
on public.inventory_reservations(user_id, created_at desc);

create table if not exists public.inventory_reservation_items (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.inventory_reservations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict,
  product_title text not null,
  product_sku text,
  variant_label text,
  selected_options jsonb not null default '{}'::jsonb check (jsonb_typeof(selected_options) = 'object'),
  quantity integer not null check (quantity between 1 and 99),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  unique (reservation_id, product_id, variant_id)
);
create index if not exists inventory_reservation_items_stock_lookup_idx
on public.inventory_reservation_items(product_id, variant_id, reservation_id);

create or replace function public.guard_reserved_product_stock()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $reserved_product_stock$
declare
  v_reserved bigint;
begin
  if new.quantity_on_hand is distinct from old.quantity_on_hand then
    select coalesce(sum(ri.quantity), 0) into v_reserved
    from public.inventory_reservation_items ri
    join public.inventory_reservations r on r.id = ri.reservation_id
    where ri.product_id = new.id
      and ri.variant_id is null
      and r.status = 'reserved'
      and r.expires_at > now();
    if new.quantity_on_hand < v_reserved then
      raise exception 'Product stock cannot be reduced below active reservations';
    end if;
  end if;
  return new;
end;
$reserved_product_stock$;

drop trigger if exists guard_reserved_product_stock on public.products;
create trigger guard_reserved_product_stock
before update of quantity_on_hand on public.products
for each row execute function public.guard_reserved_product_stock();

create or replace function public.guard_reserved_variant_stock()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $reserved_variant_stock$
declare
  v_reserved bigint;
begin
  if new.quantity_on_hand is distinct from old.quantity_on_hand then
    select coalesce(sum(ri.quantity), 0) into v_reserved
    from public.inventory_reservation_items ri
    join public.inventory_reservations r on r.id = ri.reservation_id
    where ri.variant_id = new.id
      and r.status = 'reserved'
      and r.expires_at > now();
    if new.quantity_on_hand < v_reserved then
      raise exception 'Variant stock cannot be reduced below active reservations';
    end if;
  end if;
  return new;
end;
$reserved_variant_stock$;

drop trigger if exists guard_reserved_variant_stock on public.product_variants;
create trigger guard_reserved_variant_stock
before update of quantity_on_hand on public.product_variants
for each row execute function public.guard_reserved_variant_stock();

create or replace function public.adjust_product_variant_inventory(
  p_variant_id uuid,
  p_quantity_delta integer,
  p_reason text,
  p_reference text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $adjust_variant_inventory$
declare
  v_product_id uuid;
  v_current integer;
  v_new_quantity bigint;
  v_reserved bigint;
  v_reason text := lower(btrim(coalesce(p_reason, '')));
  v_reference text := nullif(btrim(coalesce(p_reference, '')), '');
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator permissions are required';
  end if;
  if p_variant_id is null or p_quantity_delta is null or p_quantity_delta = 0 then
    raise exception 'A variant and non-zero quantity adjustment are required';
  end if;
  if v_reason not in ('restock','correction','damage','return','other') then
    raise exception 'Unsupported inventory adjustment reason';
  end if;
  if v_reason in ('restock','return') and p_quantity_delta < 0 then
    raise exception 'Restock and return adjustments must increase stock';
  end if;
  if v_reason = 'damage' and p_quantity_delta > 0 then
    raise exception 'Damage adjustments must decrease stock';
  end if;
  if v_reference is not null and length(v_reference) > 120 then
    raise exception 'Inventory reference must be 120 characters or fewer';
  end if;

  select product_id into v_product_id
  from public.product_variants where id = p_variant_id;
  if not found then raise exception 'Variant was not found'; end if;

  -- Lock the parent first, matching reserve_inventory and avoiding lock-order inversions.
  perform 1 from public.products where id = v_product_id for update;
  if not found then raise exception 'Product was not found'; end if;

  select quantity_on_hand into v_current
  from public.product_variants
  where id = p_variant_id and product_id = v_product_id
  for update;
  if not found then raise exception 'Variant was not found'; end if;

  v_new_quantity := v_current::bigint + p_quantity_delta::bigint;
  if v_new_quantity < 0 then raise exception 'Variant inventory cannot become negative'; end if;
  if v_new_quantity > 2147483647 then raise exception 'Variant inventory exceeds the supported quantity range'; end if;

  select coalesce(sum(ri.quantity), 0) into v_reserved
  from public.inventory_reservation_items ri
  join public.inventory_reservations r on r.id = ri.reservation_id
  where ri.variant_id = p_variant_id
    and r.status = 'reserved'
    and r.expires_at > now();
  if v_new_quantity < v_reserved then
    raise exception 'Variant stock cannot be reduced below active reservations';
  end if;

  perform set_config('app.inventory_adjustment', 'on', true);
  update public.product_variants
  set quantity_on_hand = v_new_quantity::integer
  where id = p_variant_id;

  insert into public.inventory_movements (
    product_id, variant_id, quantity_delta, reason, reference, actor_id
  ) values (
    v_product_id, p_variant_id, p_quantity_delta, v_reason, v_reference, auth.uid()
  );

  return jsonb_build_object('variant_id', p_variant_id, 'quantity_on_hand', v_new_quantity);
end;
$adjust_variant_inventory$;

create or replace function public.reserve_inventory(
  p_items jsonb,
  p_idempotency_key text,
  p_ttl_seconds integer default 900
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $reserve_inventory$
declare
  v_user_id uuid := auth.uid();
  v_hash text;
  v_existing public.inventory_reservations%rowtype;
  v_reservation_id uuid := gen_random_uuid();
  v_expires_at timestamptz;
  v_item record;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_has_active_variants boolean;
  v_variant_id uuid;
  v_stock integer;
  v_reserved bigint;
  v_available bigint;
  v_unit_price bigint;
  v_variant_label text;
  v_sku text;
  v_options jsonb;
  v_item_count integer;
  v_active_reservations integer;
begin
  if v_user_id is null then
    raise exception 'Sign in before reserving inventory';
  end if;
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 8 and 100 then
    raise exception 'A valid reservation idempotency key is required';
  end if;
  if p_ttl_seconds is null or p_ttl_seconds not between 300 and 1800 then
    raise exception 'Reservation duration must be between five and thirty minutes';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array'
     or coalesce(jsonb_array_length(p_items), 0) not between 1 and 20 then
    raise exception 'A reservation must contain between one and twenty cart lines';
  end if;

  select count(*) into v_item_count
  from jsonb_to_recordset(p_items) as requested(product_id uuid, variant_id uuid, quantity integer)
  where product_id is null or quantity is null or quantity not between 1 and 99;
  if v_item_count > 0 then
    raise exception 'Reservation lines contain invalid product, variant or quantity values';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as requested(product_id uuid, variant_id uuid, quantity integer)
    group by product_id, variant_id
    having count(*) > 1
  ) then
    raise exception 'Reservation lines must be unique by product and variant';
  end if;

  -- Serialize idempotency and active-reservation limits for this customer.
  perform pg_advisory_xact_lock(hashtext(v_user_id::text));
  v_hash := encode(digest(p_items::text, 'sha256'), 'hex');

  select * into v_existing
  from public.inventory_reservations
  where user_id = v_user_id and idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_existing.request_hash <> v_hash then
      raise exception 'The idempotency key was already used for a different reservation request';
    end if;
    if v_existing.status = 'reserved' and v_existing.expires_at <= now() then
      update public.inventory_reservations set status = 'expired' where id = v_existing.id;
      v_existing.status := 'expired';
    end if;
    return jsonb_build_object(
      'reservation_id', v_existing.id,
      'status', v_existing.status,
      'expires_at', v_existing.expires_at,
      'replayed', true
    );
  end if;

  update public.inventory_reservations
  set status = 'expired'
  where user_id = v_user_id and status = 'reserved' and expires_at <= now();

  select count(*) into v_active_reservations
  from public.inventory_reservations
  where user_id = v_user_id and status = 'reserved' and expires_at > now();
  if v_active_reservations >= 3 then
    raise exception 'Release or complete an existing reservation before starting another';
  end if;

  v_expires_at := now() + make_interval(secs => p_ttl_seconds);
  insert into public.inventory_reservations (
    id, user_id, idempotency_key, request_hash, status, expires_at
  ) values (
    v_reservation_id, v_user_id, p_idempotency_key, v_hash, 'reserved', v_expires_at
  );

  -- All reservation paths lock product first, then variant, in deterministic order.
  for v_item in
    select *
    from jsonb_to_recordset(p_items) as requested(product_id uuid, variant_id uuid, quantity integer)
    order by product_id, variant_id nulls first
  loop
    select * into v_product
    from public.products
    where id = v_item.product_id
    for update;
    if not found or v_product.status <> 'active' or v_product.price_minor is null then
      raise exception 'A selected product is no longer available for reservation';
    end if;

    select exists (
      select 1 from public.product_variants
      where product_id = v_product.id and status = 'active'
    ) into v_has_active_variants;

    if v_item.variant_id is not null then
      select * into v_variant
      from public.product_variants
      where id = v_item.variant_id
        and product_id = v_product.id
        and status = 'active'
      for update;
      if not found then raise exception 'A selected product option is no longer available'; end if;
      v_variant_id := v_variant.id;
      v_stock := v_variant.quantity_on_hand;
      v_unit_price := coalesce(v_variant.price_override_minor, v_product.price_minor);
      v_variant_label := v_variant.label;
      v_sku := coalesce(v_variant.sku, v_product.sku);
      v_options := v_variant.attributes;
    else
      if v_has_active_variants then
        raise exception 'Choose an active product option before reserving inventory';
      end if;
      v_variant_id := null;
      v_stock := v_product.quantity_on_hand;
      v_unit_price := v_product.price_minor;
      v_variant_label := null;
      v_sku := v_product.sku;
      v_options := '{}'::jsonb;
    end if;

    select coalesce(sum(ri.quantity), 0) into v_reserved
    from public.inventory_reservation_items ri
    join public.inventory_reservations r on r.id = ri.reservation_id
    where ri.product_id = v_product.id
      and ri.variant_id is not distinct from v_variant_id
      and r.status = 'reserved'
      and r.expires_at > now();

    v_available := v_stock::bigint - v_reserved;
    if v_available < v_item.quantity then
      raise exception 'Requested quantity exceeds currently reservable stock';
    end if;

    insert into public.inventory_reservation_items (
      reservation_id, product_id, variant_id, product_title, product_sku,
      variant_label, selected_options, quantity, unit_price_minor, currency
    ) values (
      v_reservation_id, v_product.id, v_variant_id, v_product.title, v_sku,
      v_variant_label, v_options, v_item.quantity, v_unit_price, v_product.currency
    );
  end loop;

  return jsonb_build_object(
    'reservation_id', v_reservation_id,
    'status', 'reserved',
    'expires_at', v_expires_at,
    'item_count', v_item_count,
    'replayed', false
  );
end;
$reserve_inventory$;

create or replace function public.release_inventory_reservation(p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $release_inventory$
declare
  v_reservation public.inventory_reservations%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in to release this reservation'; end if;
  select * into v_reservation
  from public.inventory_reservations
  where id = p_reservation_id
    and (user_id = auth.uid() or public.is_admin())
  for update;
  if not found then raise exception 'Reservation was not found'; end if;

  if v_reservation.status = 'reserved' and v_reservation.expires_at <= now() then
    update public.inventory_reservations set status = 'expired' where id = p_reservation_id;
    v_reservation.status := 'expired';
  elsif v_reservation.status = 'reserved' then
    update public.inventory_reservations set status = 'released' where id = p_reservation_id;
    v_reservation.status := 'released';
  end if;

  return jsonb_build_object('reservation_id', v_reservation.id, 'status', v_reservation.status);
end;
$release_inventory$;

create or replace function public.expire_inventory_reservations()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $expire_inventory$
declare
  v_count integer;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Trusted service-role access is required';
  end if;
  update public.inventory_reservations
  set status = 'expired'
  where status = 'reserved' and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$expire_inventory$;

drop trigger if exists set_updated_at on public.product_variants;
create trigger set_updated_at before update on public.product_variants
for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.inventory_reservations;
create trigger set_updated_at before update on public.inventory_reservations
for each row execute function public.set_updated_at();

drop trigger if exists audit_product_variants on public.product_variants;
create trigger audit_product_variants after insert or update or delete on public.product_variants
for each row execute function public.write_audit_log();
drop trigger if exists audit_inventory_reservations on public.inventory_reservations;
create trigger audit_inventory_reservations after insert or update or delete on public.inventory_reservations
for each row execute function public.write_audit_log();
drop trigger if exists audit_inventory_reservation_items on public.inventory_reservation_items;
create trigger audit_inventory_reservation_items after insert or update or delete on public.inventory_reservation_items
for each row execute function public.write_audit_log();

alter table public.product_variants enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.inventory_reservation_items enable row level security;

drop policy if exists product_variants_public_read on public.product_variants;
create policy product_variants_public_read on public.product_variants
for select to anon, authenticated
using (
  status = 'active' and exists (
    select 1 from public.products p
    where p.id = product_id and p.status = 'active'
  )
  or public.is_admin()
);
drop policy if exists product_variants_admin_all on public.product_variants;
create policy product_variants_admin_all on public.product_variants
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists inventory_reservations_owner_read on public.inventory_reservations;
create policy inventory_reservations_owner_read on public.inventory_reservations
for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists inventory_reservation_items_owner_read on public.inventory_reservation_items;
create policy inventory_reservation_items_owner_read on public.inventory_reservation_items
for select to authenticated using (
  exists (
    select 1 from public.inventory_reservations r
    where r.id = reservation_id and (r.user_id = auth.uid() or public.is_admin())
  )
);

grant select on public.product_variants to anon, authenticated;
grant insert, update, delete on public.product_variants to authenticated;
grant select on public.inventory_reservations, public.inventory_reservation_items to authenticated;

revoke all on function public.adjust_product_variant_inventory(uuid, integer, text, text) from public;
revoke all on function public.adjust_product_variant_inventory(uuid, integer, text, text) from anon;
grant execute on function public.adjust_product_variant_inventory(uuid, integer, text, text) to authenticated;

revoke all on function public.reserve_inventory(jsonb, text, integer) from public;
revoke all on function public.reserve_inventory(jsonb, text, integer) from anon;
grant execute on function public.reserve_inventory(jsonb, text, integer) to authenticated;

revoke all on function public.release_inventory_reservation(uuid) from public;
revoke all on function public.release_inventory_reservation(uuid) from anon;
grant execute on function public.release_inventory_reservation(uuid) to authenticated;

revoke all on function public.expire_inventory_reservations() from public;
revoke all on function public.expire_inventory_reservations() from anon;
revoke all on function public.expire_inventory_reservations() from authenticated;
grant execute on function public.expire_inventory_reservations() to service_role;

comment on table public.product_variants is
  'Merchant-managed product options. Variant stock and optional price overrides are independent of product-level stock.';
comment on table public.inventory_reservations is
  'Short-lived authenticated customer inventory holds. No payment is captured and no order is marked paid.';
comment on function public.reserve_inventory(jsonb, text, integer) is
  'Atomically reserves active product or variant stock using server-side prices, row locks and an idempotency key.';
