-- Desert Art Gallery order-draft and checkout-preflight foundation.
-- This migration never starts a payment or treats a browser redirect as payment evidence.

alter table public.shipping_rates
  add column if not exists duties_disclosure text;

alter table public.orders
  add column if not exists reservation_id uuid references public.inventory_reservations(id) on delete set null,
  add column if not exists checkout_idempotency_key text,
  add column if not exists checkout_request_hash text,
  add column if not exists expires_at timestamptz,
  add column if not exists shipping_rate_id uuid references public.shipping_rates(id) on delete set null,
  add column if not exists shipping_zone_name text,
  add column if not exists shipping_rate_name text,
  add column if not exists shipping_delivery_min_days integer,
  add column if not exists shipping_delivery_max_days integer,
  add column if not exists duties_disclosure text,
  add column if not exists tax_breakdown jsonb not null default '[]'::jsonb,
  add column if not exists tax_disclosure text not null default '';

alter table public.order_items
  add column if not exists variant_id uuid,
  add column if not exists variant_label text;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in ('draft','pending_payment','paid','processing','shipped','delivered','cancelled','expired','refunded'));

alter table public.orders
  add constraint orders_delivery_days_check
  check (
    (shipping_delivery_min_days is null and shipping_delivery_max_days is null)
    or (
      shipping_delivery_min_days is not null
      and shipping_delivery_max_days is not null
      and shipping_delivery_min_days between 0 and 365
      and shipping_delivery_max_days between shipping_delivery_min_days and 365
    )
  );

alter table public.orders
  add constraint orders_checkout_hash_check
  check (checkout_request_hash is null or checkout_request_hash ~ '^[a-f0-9]{64}$');

create unique index if not exists orders_reservation_unique_idx
  on public.orders(reservation_id) where reservation_id is not null;
create unique index if not exists orders_checkout_idempotency_unique_idx
  on public.orders(user_id, checkout_idempotency_key)
  where user_id is not null and checkout_idempotency_key is not null;

create table if not exists public.checkout_tax_rules (
  id uuid primary key default gen_random_uuid(),
  country_code char(2) not null check (country_code ~ '^[A-Z]{2}$'),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  tax_name text not null check (length(btrim(tax_name)) between 1 and 120),
  rate_basis_points integer not null check (rate_basis_points between 0 and 10000),
  taxable_shipping boolean not null default false,
  disclosure text not null check (length(btrim(disclosure)) between 1 and 2000),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_code, currency, tax_name)
);
create index if not exists checkout_tax_rules_destination_idx
  on public.checkout_tax_rules(country_code, currency, is_active);

drop trigger if exists set_updated_at on public.checkout_tax_rules;
create trigger set_updated_at before update on public.checkout_tax_rules
for each row execute function public.set_updated_at();

drop trigger if exists audit_checkout_tax_rules on public.checkout_tax_rules;
create trigger audit_checkout_tax_rules after insert or update or delete on public.checkout_tax_rules
for each row execute function public.write_audit_log();

alter table public.checkout_tax_rules enable row level security;

drop policy if exists checkout_tax_rules_public_read on public.checkout_tax_rules;
create policy checkout_tax_rules_public_read on public.checkout_tax_rules
for select to anon, authenticated using (is_active);

drop policy if exists checkout_tax_rules_owner_all on public.checkout_tax_rules;
create policy checkout_tax_rules_owner_all on public.checkout_tax_rules
for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- Shipping prices and tax policy are financial configuration: only the business owner may change them.
drop policy if exists shipping_zones_admin_all on public.shipping_zones;
create policy shipping_zones_owner_all on public.shipping_zones
for all to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists shipping_rates_admin_all on public.shipping_rates;
create policy shipping_rates_owner_all on public.shipping_rates
for all to authenticated using (public.is_owner()) with check (public.is_owner());

grant select on public.checkout_tax_rules to anon, authenticated;
grant insert, update, delete on public.checkout_tax_rules to authenticated;

-- Orders and immutable order-line snapshots can only be created by trusted database workflows.
drop policy if exists orders_admin_update on public.orders;
drop policy if exists order_items_admin_all on public.order_items;
revoke insert, update, delete on public.orders from anon, authenticated;
revoke insert, update, delete on public.order_items from anon, authenticated;

create or replace function public.create_order_from_reservation(
  p_reservation_id uuid,
  p_shipping_rate_id uuid,
  p_shipping_address jsonb,
  p_customer_note text,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $create_order$
declare
  v_user_id uuid := auth.uid();
  v_reservation public.inventory_reservations%rowtype;
  v_existing public.orders%rowtype;
  v_order public.orders%rowtype;
  v_email text;
  v_address jsonb;
  v_recipient text;
  v_line_1 text;
  v_line_2 text;
  v_city text;
  v_region text;
  v_postal text;
  v_country text;
  v_phone text;
  v_note text;
  v_request_hash text;
  v_item_count integer;
  v_currency text;
  v_min_currency text;
  v_max_currency text;
  v_subtotal numeric;
  v_zone_count integer;
  v_zone_id uuid;
  v_zone_name text;
  v_rate_name text;
  v_shipping_minor bigint;
  v_min_days integer;
  v_max_days integer;
  v_duties_disclosure text;
  v_tax_count integer;
  v_tax_breakdown jsonb;
  v_tax_disclosure text;
  v_tax_minor numeric;
  v_total_minor numeric;
  v_order_number text;
begin
  if v_user_id is null then
    raise exception 'Authentication is required to prepare an order';
  end if;
  if p_reservation_id is null or p_shipping_rate_id is null then
    raise exception 'A valid reservation and shipping option are required';
  end if;
  if p_idempotency_key is null
     or p_idempotency_key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'A UUID checkout idempotency key is required';
  end if;
  if jsonb_typeof(p_shipping_address) is distinct from 'object' then
    raise exception 'A delivery address is required';
  end if;

  v_recipient := btrim(coalesce(p_shipping_address ->> 'recipient_name', ''));
  v_line_1 := btrim(coalesce(p_shipping_address ->> 'address_line_1', ''));
  v_line_2 := nullif(btrim(coalesce(p_shipping_address ->> 'address_line_2', '')), '');
  v_city := btrim(coalesce(p_shipping_address ->> 'city', ''));
  v_region := nullif(btrim(coalesce(p_shipping_address ->> 'region', '')), '');
  v_postal := btrim(coalesce(p_shipping_address ->> 'postal_code', ''));
  v_country := upper(btrim(coalesce(p_shipping_address ->> 'country_code', '')));
  v_phone := nullif(btrim(coalesce(p_shipping_address ->> 'phone', '')), '');

  if length(v_recipient) not between 1 and 160
     or length(v_line_1) not between 1 and 240
     or length(v_line_2) > 240
     or length(v_city) not between 1 and 120
     or length(v_region) > 120
     or length(v_postal) not between 1 and 24
     or v_country !~ '^[A-Z]{2}$'
     or length(v_phone) > 40 then
    raise exception 'The delivery address contains invalid fields';
  end if;
  if p_customer_note is not null and length(btrim(p_customer_note)) > 1000 then
    raise exception 'The customer note is too long';
  end if;
  v_note := nullif(btrim(coalesce(p_customer_note, '')), '');
  v_address := jsonb_build_object(
    'recipient_name', v_recipient,
    'address_line_1', v_line_1,
    'city', v_city,
    'postal_code', v_postal,
    'country_code', v_country
  );
  if v_line_2 is not null then v_address := v_address || jsonb_build_object('address_line_2', v_line_2); end if;
  if v_region is not null then v_address := v_address || jsonb_build_object('region', v_region); end if;
  if v_phone is not null then v_address := v_address || jsonb_build_object('phone', v_phone); end if;

  v_request_hash := encode(digest(jsonb_build_object(
    'reservation_id', p_reservation_id,
    'shipping_rate_id', p_shipping_rate_id,
    'shipping_address', v_address,
    'customer_note', coalesce(v_note, '')
  )::text, 'sha256'), 'hex');

  -- Serialize duplicate submissions before checking both idempotency scopes.
  perform pg_advisory_xact_lock(hashtext(v_user_id::text || ':' || p_idempotency_key));

  select * into v_existing
  from public.orders
  where user_id = v_user_id and checkout_idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_existing.status = 'draft' and v_existing.expires_at <= now() then
      update public.orders set status = 'expired'
      where id = v_existing.id returning * into v_existing;
    end if;
    if v_existing.checkout_request_hash <> v_request_hash then
      raise exception 'The checkout idempotency key was reused with different details';
    end if;
    return jsonb_build_object(
      'order_id', v_existing.id, 'order_number', v_existing.order_number,
      'status', v_existing.status, 'currency', v_existing.currency,
      'subtotal_minor', v_existing.subtotal_minor, 'shipping_minor', v_existing.shipping_minor,
      'tax_minor', v_existing.tax_minor, 'total_minor', v_existing.total_minor,
      'expires_at', v_existing.expires_at, 'replayed', true
    );
  end if;

  select * into v_reservation
  from public.inventory_reservations
  where id = p_reservation_id and user_id = v_user_id
  for update;
  if not found then raise exception 'The inventory reservation was not found'; end if;

  select * into v_existing
  from public.orders
  where reservation_id = p_reservation_id
  for update;
  if found then
    if v_existing.status = 'draft' and (v_reservation.status = 'expired' or v_reservation.expires_at <= now()) then
      update public.orders set status = 'expired'
      where id = v_existing.id returning * into v_existing;
    elsif v_existing.status = 'draft' and v_reservation.status = 'released' then
      update public.orders set status = 'cancelled'
      where id = v_existing.id returning * into v_existing;
    end if;
    if v_existing.checkout_request_hash <> v_request_hash then
      raise exception 'This reservation already belongs to a different checkout draft';
    end if;
    return jsonb_build_object(
      'order_id', v_existing.id, 'order_number', v_existing.order_number,
      'status', v_existing.status, 'currency', v_existing.currency,
      'subtotal_minor', v_existing.subtotal_minor, 'shipping_minor', v_existing.shipping_minor,
      'tax_minor', v_existing.tax_minor, 'total_minor', v_existing.total_minor,
      'expires_at', v_existing.expires_at, 'replayed', true
    );
  end if;

  if v_reservation.status <> 'reserved' or v_reservation.expires_at <= now() then
    raise exception 'The inventory reservation has expired or is no longer active';
  end if;

  select email into v_email from auth.users where id = v_user_id;
  if v_email is null or length(btrim(v_email)) = 0 then
    raise exception 'A customer email address is required';
  end if;

  select count(*), min(currency::text), max(currency::text),
         coalesce(sum(quantity::numeric * unit_price_minor::numeric), 0)
  into v_item_count, v_min_currency, v_max_currency, v_subtotal
  from public.inventory_reservation_items
  where reservation_id = p_reservation_id;
  if v_item_count < 1 or v_item_count > 20 then
    raise exception 'The reservation has no valid order lines';
  end if;
  if v_min_currency <> v_max_currency then
    raise exception 'A checkout draft must use one currency';
  end if;
  v_currency := v_min_currency;
  if v_subtotal > 9000000000000000 then
    raise exception 'The order subtotal exceeds the supported amount';
  end if;

  select count(*) into v_zone_count
  from public.shipping_zones
  where is_active and country_codes @> array[v_country]::text[];
  if v_zone_count <> 1 then
    raise exception 'Shipping is not configured unambiguously for this destination';
  end if;

  select z.id, z.name, r.name, r.amount_minor, r.min_delivery_days,
         r.max_delivery_days, r.duties_disclosure
  into v_zone_id, v_zone_name, v_rate_name, v_shipping_minor,
       v_min_days, v_max_days, v_duties_disclosure
  from public.shipping_zones z
  join public.shipping_rates r on r.zone_id = z.id
  where z.is_active
    and z.country_codes @> array[v_country]::text[]
    and r.id = p_shipping_rate_id
    and r.is_active
    and r.currency::text = v_currency
    and length(btrim(coalesce(r.duties_disclosure, ''))) between 1 and 2000
  for share of z, r;
  if not found then
    raise exception 'The selected shipping option is unavailable for this destination and currency';
  end if;

  select count(*) into v_tax_count
  from public.checkout_tax_rules
  where country_code::text = v_country and currency::text = v_currency and is_active;
  if v_tax_count < 1 then
    raise exception 'Tax and duties policy is not configured for this destination and currency';
  end if;
  perform 1 from public.checkout_tax_rules
  where country_code::text = v_country and currency::text = v_currency and is_active
  for share;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'name', tax_name,
      'rate_basis_points', rate_basis_points,
      'amount_minor', tax_minor
    ) order by tax_name), '[]'::jsonb),
    coalesce(string_agg(disclosure, E'\n' order by tax_name), ''),
    coalesce(sum(tax_minor), 0)
  into v_tax_breakdown, v_tax_disclosure, v_tax_minor
  from (
    select tax_name, rate_basis_points, disclosure,
      round((v_subtotal + case when taxable_shipping then v_shipping_minor else 0 end)
        * rate_basis_points / 10000)::bigint as tax_minor
    from public.checkout_tax_rules
    where country_code::text = v_country and currency::text = v_currency and is_active
  ) configured_tax;

  v_total_minor := v_subtotal + v_shipping_minor + v_tax_minor;
  if v_total_minor > 9000000000000000 then
    raise exception 'The order total exceeds the supported amount';
  end if;

  v_order_number := 'DAG-' || to_char(now(), 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.orders (
    order_number, user_id, email, currency, status,
    subtotal_minor, shipping_minor, tax_minor, discount_minor, total_minor,
    shipping_address, customer_note, reservation_id, checkout_idempotency_key,
    checkout_request_hash, expires_at, shipping_rate_id, shipping_zone_name,
    shipping_rate_name, shipping_delivery_min_days, shipping_delivery_max_days,
    duties_disclosure, tax_breakdown, tax_disclosure
  ) values (
    v_order_number, v_user_id, v_email, v_currency, 'draft',
    v_subtotal, v_shipping_minor, v_tax_minor, 0, v_total_minor,
    v_address, v_note, p_reservation_id, p_idempotency_key,
    v_request_hash, v_reservation.expires_at, p_shipping_rate_id, v_zone_name,
    v_rate_name, v_min_days, v_max_days, v_duties_disclosure,
    v_tax_breakdown, v_tax_disclosure
  ) returning * into v_order;

  insert into public.order_items (
    order_id, product_id, product_title, product_sku, quantity,
    unit_price_minor, line_total_minor, selected_options, variant_id, variant_label
  )
  select
    v_order.id, product_id, product_title, product_sku, quantity,
    unit_price_minor, quantity::bigint * unit_price_minor,
    selected_options, variant_id, variant_label
  from public.inventory_reservation_items
  where reservation_id = p_reservation_id
  order by created_at, id;

  return jsonb_build_object(
    'order_id', v_order.id, 'order_number', v_order.order_number,
    'status', v_order.status, 'currency', v_order.currency,
    'subtotal_minor', v_order.subtotal_minor, 'shipping_minor', v_order.shipping_minor,
    'tax_minor', v_order.tax_minor, 'total_minor', v_order.total_minor,
    'tax_breakdown', v_order.tax_breakdown, 'tax_disclosure', v_order.tax_disclosure,
    'duties_disclosure', v_order.duties_disclosure,
    'shipping_rate_name', v_order.shipping_rate_name,
    'expires_at', v_order.expires_at, 'replayed', false
  );
end;
$create_order$;

create or replace function public.transition_order_fulfilment(
  p_order_id uuid,
  p_next_status text,
  p_tracking_carrier text default null,
  p_tracking_number text default null,
  p_tracking_url text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $transition_fulfilment$
declare
  v_order public.orders%rowtype;
  v_carrier text := nullif(btrim(coalesce(p_tracking_carrier, '')), '');
  v_number text := nullif(btrim(coalesce(p_tracking_number, '')), '');
  v_url text := nullif(btrim(coalesce(p_tracking_url, '')), '');
begin
  if not public.is_admin() then raise exception 'Administrator permissions are required'; end if;
  if p_order_id is null then raise exception 'An order is required'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order was not found'; end if;

  if v_order.status = 'paid' and p_next_status = 'processing' then
    update public.orders set status = 'processing' where id = p_order_id returning * into v_order;
  elsif v_order.status = 'processing' and p_next_status = 'shipped' then
    if length(coalesce(v_carrier, '')) not between 1 and 100
       or length(coalesce(v_number, '')) not between 1 and 160 then
      raise exception 'Carrier and tracking number are required before shipment';
    end if;
    if v_url is not null and (length(v_url) > 1000 or v_url !~ '^https://[^[:space:]]+$') then
      raise exception 'Tracking URL must be an HTTPS URL';
    end if;
    update public.orders set
      status = 'shipped', tracking_carrier = v_carrier,
      tracking_number = v_number, tracking_url = v_url, shipped_at = coalesce(shipped_at, now())
    where id = p_order_id returning * into v_order;
  elsif v_order.status = 'shipped' and p_next_status = 'delivered' then
    update public.orders set status = 'delivered', delivered_at = coalesce(delivered_at, now())
    where id = p_order_id returning * into v_order;
  else
    raise exception 'The requested fulfilment transition is not allowed';
  end if;

  return jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'status', v_order.status);
end;
$transition_fulfilment$;

-- Expiry releases the reservation and closes its unpaid draft. Payment state is never changed here.
create or replace function public.release_inventory_reservation(p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $release_inventory$
declare
  v_reservation public.inventory_reservations%rowtype;
  v_order_status text;
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

  if v_reservation.status = 'expired' then
    update public.orders set status = 'expired'
    where reservation_id = p_reservation_id and status = 'draft';
    v_order_status := 'expired';
  elsif v_reservation.status = 'released' then
    update public.orders set status = 'cancelled'
    where reservation_id = p_reservation_id and status = 'draft';
    v_order_status := 'cancelled';
  end if;

  return jsonb_build_object(
    'reservation_id', v_reservation.id,
    'status', v_reservation.status,
    'order_status', v_order_status
  );
end;
$release_inventory$;

revoke all on function public.release_inventory_reservation(uuid) from public, anon;
grant execute on function public.release_inventory_reservation(uuid) to authenticated;

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

  update public.orders
  set status = 'expired'
  where status = 'draft' and expires_at <= now();
  return v_count;
end;
$expire_inventory$;

revoke all on function public.create_order_from_reservation(uuid, uuid, jsonb, text, text) from public, anon;
grant execute on function public.create_order_from_reservation(uuid, uuid, jsonb, text, text) to authenticated;

revoke all on function public.transition_order_fulfilment(uuid, text, text, text, text) from public, anon;
grant execute on function public.transition_order_fulfilment(uuid, text, text, text, text) to authenticated;

revoke all on function public.expire_inventory_reservations() from public, anon, authenticated;
grant execute on function public.expire_inventory_reservations() to service_role;

comment on table public.checkout_tax_rules is
  'Owner-managed destination and currency tax configuration. An explicit active zero-rate rule is required when no tax applies.';
comment on function public.create_order_from_reservation(uuid, uuid, jsonb, text, text) is
  'Creates an unpaid, expiring order draft from an authenticated active reservation using database price snapshots and explicit shipping/tax configuration. Does not initiate payment.';
comment on function public.transition_order_fulfilment(uuid, text, text, text, text) is
  'Admin-only linear fulfilment state machine. Does not set paid/refunded states or issue refunds.';
