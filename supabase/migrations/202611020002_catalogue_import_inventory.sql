-- Catalogue CSV ingestion and atomic inventory ledger operations.
-- Imports create drafts only. Product media and publication rights remain a separate owner-controlled workflow.

create table if not exists public.catalogue_import_batches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  row_count integer not null check (row_count between 1 and 500),
  products_created integer not null check (products_created between 1 and 500),
  stock_units_added bigint not null default 0 check (stock_units_added >= 0),
  created_at timestamptz not null default now()
);

create index if not exists catalogue_import_batches_created_idx
on public.catalogue_import_batches(created_at desc);

alter table public.catalogue_import_batches enable row level security;

drop policy if exists catalogue_import_batches_admin_read on public.catalogue_import_batches;
create policy catalogue_import_batches_admin_read
on public.catalogue_import_batches for select to authenticated
using (public.is_admin());

grant select on public.catalogue_import_batches to authenticated;

drop trigger if exists audit_catalogue_import_batches on public.catalogue_import_batches;
create trigger audit_catalogue_import_batches
after insert or update or delete on public.catalogue_import_batches
for each row execute function public.write_audit_log();

-- Stock cannot be edited through ordinary product CRUD. All balance changes must
-- pass through a transaction that also writes an inventory movement.
create or replace function public.guard_product_inventory_balance()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $guard_inventory$
begin
  if coalesce(current_setting('app.inventory_adjustment', true), '') <> 'on' then
    if tg_op = 'INSERT' and new.quantity_on_hand <> 0 then
      raise exception 'Initial stock must be recorded through an inventory import or adjustment';
    end if;
    if tg_op = 'UPDATE' and new.quantity_on_hand is distinct from old.quantity_on_hand then
      raise exception 'Stock must be changed through the inventory adjustment workflow';
    end if;
  end if;
  return new;
end;
$guard_inventory$;

drop trigger if exists guard_product_inventory_balance on public.products;
create trigger guard_product_inventory_balance
before insert or update of quantity_on_hand on public.products
for each row execute function public.guard_product_inventory_balance();

create or replace function public.adjust_product_inventory(
  p_product_id uuid,
  p_quantity_delta integer,
  p_reason text,
  p_reference text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $adjust_inventory$
declare
  v_current integer;
  v_new_quantity bigint;
  v_reason text := lower(btrim(coalesce(p_reason, '')));
  v_reference text := nullif(btrim(coalesce(p_reference, '')), '');
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator permissions are required';
  end if;
  if p_product_id is null or p_quantity_delta is null or p_quantity_delta = 0 then
    raise exception 'A product and non-zero quantity adjustment are required';
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

  select p.quantity_on_hand into v_current
  from public.products p
  where p.id = p_product_id
  for update;

  if not found then raise exception 'Product was not found'; end if;

  v_new_quantity := v_current::bigint + p_quantity_delta::bigint;
  if v_new_quantity < 0 then raise exception 'Inventory cannot become negative'; end if;
  if v_new_quantity > 2147483647 then raise exception 'Inventory exceeds the supported quantity range'; end if;

  perform set_config('app.inventory_adjustment', 'on', true);
  update public.products set quantity_on_hand = v_new_quantity::integer where id = p_product_id;

  insert into public.inventory_movements (
    product_id, quantity_delta, reason, reference, actor_id
  ) values (
    p_product_id, p_quantity_delta, v_reason, v_reference, auth.uid()
  );

  return jsonb_build_object('product_id', p_product_id, 'quantity_on_hand', v_new_quantity);
end;
$adjust_inventory$;

create or replace function public.import_catalogue_drafts(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $import_catalogue$
declare
  v_batch_id uuid := gen_random_uuid();
  v_row jsonb;
  v_slug text;
  v_title text;
  v_sku text;
  v_currency text;
  v_category_id uuid;
  v_price bigint;
  v_compare_at bigint;
  v_quantity integer;
  v_materials text[];
  v_sizes text[];
  v_measurements jsonb;
  v_product_id uuid;
  v_rows integer;
  v_created integer := 0;
  v_stock_units bigint := 0;
  v_seen_slugs text[] := '{}'::text[];
  v_seen_skus text[] := '{}'::text[];
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator permissions are required';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'Catalogue import must be a JSON array';
  end if;

  v_rows := jsonb_array_length(p_rows);
  if v_rows < 1 or v_rows > 500 then
    raise exception 'Catalogue import must contain between 1 and 500 rows';
  end if;

  -- Serialize imports so duplicate checks and the insert transaction cannot race each other.
  perform pg_advisory_xact_lock(19789, 24110);
  perform set_config('app.inventory_adjustment', 'on', true);

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    if jsonb_typeof(v_row) is distinct from 'object' then
      raise exception 'Every catalogue row must be an object';
    end if;

    v_slug := lower(btrim(coalesce(v_row ->> 'slug', '')));
    v_title := btrim(coalesce(v_row ->> 'title', ''));
    v_sku := nullif(upper(btrim(coalesce(v_row ->> 'sku', ''))), '');
    v_currency := upper(btrim(coalesce(v_row ->> 'currency', '')));
    v_category_id := nullif(v_row ->> 'category_id', '')::uuid;
    v_price := nullif(v_row ->> 'price_minor', '')::bigint;
    v_compare_at := nullif(v_row ->> 'compare_at_price_minor', '')::bigint;
    v_quantity := coalesce(nullif(v_row ->> 'quantity_on_hand', '')::integer, 0);
    v_measurements := coalesce(v_row -> 'measurements', '{}'::jsonb);

    if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_slug) > 100 then
      raise exception 'A catalogue row contains an invalid slug';
    end if;
    if length(v_title) not between 3 and 180 then
      raise exception 'A catalogue row contains an invalid title';
    end if;
    if v_currency !~ '^[A-Z]{3}$' then
      raise exception 'A catalogue row contains an invalid currency';
    end if;
    if v_price is not null and v_price < 0 then
      raise exception 'A catalogue row contains a negative price';
    end if;
    if v_compare_at is not null and (v_price is null or v_compare_at < v_price) then
      raise exception 'A compare-at price requires a selling price and cannot be lower';
    end if;
    if v_quantity < 0 then
      raise exception 'A catalogue row contains a negative stock quantity';
    end if;
    if jsonb_typeof(v_measurements) is distinct from 'object' then
      raise exception 'Measurements must be a JSON object';
    end if;
    if jsonb_typeof(coalesce(v_row -> 'materials', '[]'::jsonb)) is distinct from 'array'
       or jsonb_typeof(coalesce(v_row -> 'sizes', '[]'::jsonb)) is distinct from 'array' then
      raise exception 'Materials and sizes must be JSON arrays';
    end if;
    if v_category_id is not null and not exists (
      select 1 from public.categories c where c.id = v_category_id
    ) then
      raise exception 'A catalogue row references an unknown category';
    end if;
    if v_slug = any(v_seen_slugs) then
      raise exception 'The import contains duplicate product slugs';
    end if;
    if v_sku is not null and v_sku = any(v_seen_skus) then
      raise exception 'The import contains duplicate product SKUs';
    end if;
    if exists (select 1 from public.products p where p.slug = v_slug) then
      raise exception 'A product slug already exists; preview the CSV again';
    end if;
    if v_sku is not null and exists (
      select 1 from public.products p where upper(p.sku) = v_sku
    ) then
      raise exception 'A product SKU already exists; preview the CSV again';
    end if;

    v_seen_slugs := array_append(v_seen_slugs, v_slug);
    if v_sku is not null then v_seen_skus := array_append(v_seen_skus, v_sku); end if;

    insert into public.products (
      category_id, title, slug, short_description, description, sku, currency,
      price_minor, compare_at_price_minor, quantity_on_hand, status, published_at,
      materials, sizes, measurements, condition_notes, provenance, craft_story
    ) values (
      v_category_id,
      v_title,
      v_slug,
      coalesce(v_row ->> 'short_description', ''),
      coalesce(v_row ->> 'description', ''),
      v_sku,
      v_currency,
      v_price,
      v_compare_at,
      v_quantity,
      'draft',
      null,
      array(select jsonb_array_elements_text(coalesce(v_row -> 'materials', '[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(v_row -> 'sizes', '[]'::jsonb))),
      v_measurements,
      coalesce(v_row ->> 'condition_notes', ''),
      coalesce(v_row ->> 'provenance', ''),
      coalesce(v_row ->> 'craft_story', '')
    ) returning id into v_product_id;

    if v_quantity > 0 then
      insert into public.inventory_movements (
        product_id, quantity_delta, reason, reference, actor_id
      ) values (
        v_product_id, v_quantity, 'initial_import', 'catalogue-import:' || v_batch_id::text, auth.uid()
      );
    end if;

    v_created := v_created + 1;
    v_stock_units := v_stock_units + v_quantity::bigint;
  end loop;

  insert into public.catalogue_import_batches (
    id, created_by, row_count, products_created, stock_units_added
  ) values (
    v_batch_id, auth.uid(), v_rows, v_created, v_stock_units
  );

  return jsonb_build_object(
    'batch_id', v_batch_id,
    'products_created', v_created,
    'stock_units_added', v_stock_units
  );
end;
$import_catalogue$;

revoke all on function public.adjust_product_inventory(uuid, integer, text, text) from public;
revoke all on function public.adjust_product_inventory(uuid, integer, text, text) from anon;
grant execute on function public.adjust_product_inventory(uuid, integer, text, text) to authenticated;

revoke all on function public.import_catalogue_drafts(jsonb) from public;
revoke all on function public.import_catalogue_drafts(jsonb) from anon;
grant execute on function public.import_catalogue_drafts(jsonb) to authenticated;

comment on table public.catalogue_import_batches is
  'Admin-only record of catalogue CSV imports. Imported products are drafts; source files and product values are not retained.';
comment on function public.import_catalogue_drafts(jsonb) is
  'Atomically imports verified catalogue fields as drafts and records initial stock movements. Admin only.';
comment on function public.adjust_product_inventory(uuid, integer, text, text) is
  'Atomically changes product stock and appends an inventory movement. Admin only.';
