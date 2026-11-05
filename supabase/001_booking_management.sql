create extension if not exists "pgcrypto";

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  email text not null, first_name text not null, last_name text not null, mobile text not null,
  event_type text not null, event_address text not null, pickup_date date not null, dropoff_date date not null,
  pickup_time time, dropoff_time time,
  additional_details text not null default '',
  terms_accepted boolean not null default false, photo_id_paths text[] not null default '{}',
  status text not null default 'submitted' check (status in ('submitted','confirmed','completed','cancelled')),
  calendar_event_link text, calendar_error text, internal_email_sent boolean not null default false,
  customer_email_sent boolean not null default false, confirmation_email_sent boolean not null default false,
  payment_received_at timestamptz, bank_transfer_refunded_at timestamptz,
  payment_method text, hire_amount_cents integer, security_deposit_cents integer,
  hire_line_items jsonb not null default '[]'::jsonb,
  gst_inclusive boolean not null default true,
  hire_payment_status text not null default 'unpaid', deposit_payment_status text not null default 'not_required',
  bank_transfer_option text not null default 'both' check (bank_transfer_option in ('payid','bank_account','both')),
  stripe_customer_id text, stripe_hire_payment_intent_id text, stripe_deposit_payment_intent_id text,
  payment_token text, payment_token_expires_at timestamptz, deposit_captured_cents integer, deposit_released_at timestamptz, deposit_captured_at timestamptz,
  bank_transfer_reference text,
  internal_notes text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.inventory_products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text,
  quantity_on_hand integer not null default 0 check (quantity_on_hand >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.inventory_products add column if not exists category text;
update public.inventory_products
set category = case
  when name in ('Bose S1 Pro PA Speaker','Yamaha DXR15 PA Speaker') then 'Speakers'
  when name in ('Behringer Eurolive B1200D Pro Active Subwoofer','PreSonus AIR15s Active Subwoofer') then 'Subwoofers'
  when name in ('Behringer Ultravoice XM8500 Dynamic Microphone','Shure SM58','Shure SM57','Shure SM7B','K60 Wireless Microphone') then 'Microphones'
  when name = 'BeamZ S1500 Smoke Machine' then 'Effects'
  when name in ('CR Lite MagikBar Hub Party Bar','Party Light PAR Can') then 'Lighting'
  when name in ('Pro DI Box','Generic DI Box','4-Channel DI Box') then 'DI boxes'
  when name in ('Spirit E12 / 12-Channel Soundcraft Mixer','Behringer X32 Digital Mixer','Behringer Xenyx 2-channel Mixer') then 'Mixers'
  else 'Accessories'
end
where category is null;
alter table public.inventory_products alter column category set default 'Accessories';
alter table public.inventory_products alter column category set not null;
create table if not exists public.inventory_product_mappings (
  product_id uuid not null references public.inventory_products(id) on delete cascade,
  catalog_key text not null,
  units_per_line_item integer not null check (units_per_line_item > 0),
  primary key (product_id, catalog_key)
);
create table if not exists public.inventory_purchases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.inventory_products(id) on delete restrict,
  product_name text not null,
  purchase_date date not null,
  quantity integer not null check (quantity > 0),
  total_cost_cents integer not null check (total_cost_cents >= 0),
  gst_paid_cents integer not null check (gst_paid_cents >= 0 and gst_paid_cents <= total_cost_cents),
  supplier text not null default '',
  reference text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists inventory_purchases_purchase_date_idx on public.inventory_purchases(purchase_date);
create index if not exists inventory_purchases_product_id_idx on public.inventory_purchases(product_id);
create table if not exists public.inventory_stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.inventory_products(id) on delete cascade,
  movement_type text not null check (movement_type in ('opening','purchase','adjustment')),
  quantity_change integer not null check (quantity_change <> 0),
  reason text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.inventory_reservations (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  hire_line_items jsonb not null,
  pickup_date date not null,
  dropoff_date date not null,
  active boolean not null default true,
  reserved_at timestamptz not null default now()
);
insert into public.inventory_reservations (booking_id, hire_line_items, pickup_date, dropoff_date, active)
select id, hire_line_items, pickup_date, dropoff_date, true
from public.bookings
where status in ('submitted', 'confirmed')
  and payment_method is not null
on conflict (booking_id) do nothing;

alter table public.inventory_products enable row level security;
revoke all on public.inventory_products from anon, authenticated;
drop policy if exists "service role manages inventory products" on public.inventory_products;
create policy "service role manages inventory products" on public.inventory_products for all to service_role using (true) with check (true);
alter table public.inventory_product_mappings enable row level security;
revoke all on public.inventory_product_mappings from anon, authenticated;
drop policy if exists "service role manages inventory mappings" on public.inventory_product_mappings;
create policy "service role manages inventory mappings" on public.inventory_product_mappings for all to service_role using (true) with check (true);
alter table public.inventory_purchases enable row level security;
revoke all on public.inventory_purchases from anon, authenticated;
drop policy if exists "service role manages inventory purchases" on public.inventory_purchases;
create policy "service role manages inventory purchases" on public.inventory_purchases for all to service_role using (true) with check (true);
alter table public.inventory_stock_movements enable row level security;
revoke all on public.inventory_stock_movements from anon, authenticated;
drop policy if exists "service role manages inventory movements" on public.inventory_stock_movements;
create policy "service role manages inventory movements" on public.inventory_stock_movements for all to service_role using (true) with check (true);
alter table public.inventory_reservations enable row level security;
revoke all on public.inventory_reservations from anon, authenticated;
drop policy if exists "service role manages inventory reservations" on public.inventory_reservations;
create policy "service role manages inventory reservations" on public.inventory_reservations for all to service_role using (true) with check (true);

drop function if exists public.create_inventory_product(text, integer, jsonb);
create or replace function public.create_inventory_product(
  p_name text,
  p_category text,
  p_opening_quantity integer,
  p_mappings jsonb
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_product_id uuid;
begin
  if trim(coalesce(p_category, '')) = '' or p_opening_quantity < 0 or jsonb_typeof(p_mappings) <> 'array' then
    raise exception 'Invalid opening inventory or product mappings.';
  end if;
  perform pg_advisory_xact_lock(7164, 1);
  insert into public.inventory_products (name, category, quantity_on_hand)
  values (trim(p_name), trim(p_category), p_opening_quantity)
  returning id into v_product_id;
  if p_opening_quantity > 0 then
    insert into public.inventory_stock_movements (product_id, movement_type, quantity_change, reason)
    values (v_product_id, 'opening', p_opening_quantity, 'Opening stock');
  end if;
  insert into public.inventory_product_mappings (product_id, catalog_key, units_per_line_item)
  select v_product_id, mapping.catalog_key, mapping.units_per_line_item
  from jsonb_to_recordset(p_mappings) as mapping(catalog_key text, units_per_line_item integer);
  return v_product_id;
end;
$$;

create or replace function public.replace_inventory_product_mappings(p_product_id uuid, p_mappings jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if jsonb_typeof(p_mappings) <> 'array' then
    raise exception 'Product mappings must be an array.';
  end if;
  perform pg_advisory_xact_lock(7164, 1);
  if not exists (select 1 from public.inventory_products where id = p_product_id) then
    raise exception 'Inventory product could not be found.';
  end if;
  if exists (
    select 1
    from public.inventory_product_mappings current_mapping
    join (
      select reservation.hire_line_items
      from public.inventory_reservations reservation
      join public.bookings booking on booking.id = reservation.booking_id
      where reservation.active and booking.status not in ('cancelled', 'completed')
      union all
      select booking.hire_line_items
      from public.bookings booking
      where booking.status = 'confirmed'
        and not exists (
          select 1 from public.inventory_reservations reservation
          where reservation.booking_id = booking.id and reservation.active
        )
    ) active_bookings on true
    cross join lateral jsonb_array_elements(active_bookings.hire_line_items) item(value)
    where current_mapping.product_id = p_product_id
      and item.value->>'catalogKey' = current_mapping.catalog_key
      and not exists (
        select 1
        from jsonb_to_recordset(p_mappings) as proposed(catalog_key text, units_per_line_item integer)
        where proposed.catalog_key = current_mapping.catalog_key
          and proposed.units_per_line_item = current_mapping.units_per_line_item
      )
  ) then
    raise exception 'A product mapping used by a pending or confirmed booking cannot be changed until the booking is cancelled or completed.';
  end if;
  delete from public.inventory_product_mappings where product_id = p_product_id;
  insert into public.inventory_product_mappings (product_id, catalog_key, units_per_line_item)
  select p_product_id, mapping.catalog_key, mapping.units_per_line_item
  from jsonb_to_recordset(p_mappings) as mapping(catalog_key text, units_per_line_item integer);
end;
$$;

drop function if exists public.set_inventory_listing_tracked(text, boolean);
drop table if exists public.inventory_tracked_listings;

create or replace function public.record_inventory_purchase(
  p_product_id uuid,
  p_purchase_date date,
  p_quantity integer,
  p_total_cost_cents integer,
  p_gst_paid_cents integer,
  p_supplier text,
  p_reference text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_product_name text;
begin
  perform pg_advisory_xact_lock(7164, 1);
  select name into v_product_name from public.inventory_products where id = p_product_id for update;
  if not found then raise exception 'Inventory product could not be found.'; end if;
  if p_quantity < 1 or p_total_cost_cents < 0 or p_gst_paid_cents < 0 or p_gst_paid_cents > p_total_cost_cents then
    raise exception 'Purchase quantities and amounts are invalid.';
  end if;
  update public.inventory_products
  set quantity_on_hand = quantity_on_hand + p_quantity, updated_at = now()
  where id = p_product_id;
  insert into public.inventory_purchases (
    product_id, product_name, purchase_date, quantity, total_cost_cents, gst_paid_cents, supplier, reference
  ) values (
    p_product_id, v_product_name, p_purchase_date, p_quantity, p_total_cost_cents, p_gst_paid_cents,
    coalesce(p_supplier, ''), coalesce(p_reference, '')
  );
  insert into public.inventory_stock_movements (product_id, movement_type, quantity_change, reason)
  values (p_product_id, 'purchase', p_quantity, 'Purchase recorded');
end;
$$;

create or replace function public.adjust_inventory_stock(
  p_product_id uuid,
  p_quantity_change integer,
  p_reason text
)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_quantity integer;
begin
  if p_quantity_change = 0 or trim(coalesce(p_reason, '')) = '' then
    raise exception 'A nonzero adjustment and reason are required.';
  end if;
  perform pg_advisory_xact_lock(7164, 1);
  update public.inventory_products
  set quantity_on_hand = quantity_on_hand + p_quantity_change, updated_at = now()
  where id = p_product_id and quantity_on_hand + p_quantity_change >= 0
  returning quantity_on_hand into v_quantity;
  if not found then raise exception 'Adjustment would make stock negative or the product could not be found.'; end if;
  insert into public.inventory_stock_movements (product_id, movement_type, quantity_change, reason)
  values (p_product_id, 'adjustment', p_quantity_change, trim(p_reason));
  return v_quantity;
end;
$$;

create or replace function public.reserve_booking_inventory(p_booking_id uuid, p_hire_line_items jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_booking record;
  v_items jsonb;
  v_reserved_items jsonb;
  v_line jsonb;
  v_catalog_key text;
  v_unmapped text[] := '{}';
  v_product record;
  v_required integer;
  v_reserved integer;
  v_available integer;
  v_conflicts text;
  v_error text := '';
begin
  perform pg_advisory_xact_lock(7164, 1);
  select id, status, pickup_date, dropoff_date, hire_line_items
  into v_booking
  from public.bookings
  where id = p_booking_id
  for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'Booking could not be found.'); end if;
  if v_booking.status in ('cancelled', 'completed') then
    return jsonb_build_object('ok', false, 'error', 'Cancelled or completed bookings cannot reserve inventory.');
  end if;
  if p_hire_line_items is null then
    select hire_line_items into v_reserved_items
    from public.inventory_reservations
    where booking_id = p_booking_id and active;
    if found and v_reserved_items is distinct from v_booking.hire_line_items then
      return jsonb_build_object('ok', false, 'error', 'This payment request has changed and needs to be refreshed by Peppermint Audio.');
    end if;
  end if;
  v_items := coalesce(p_hire_line_items, v_booking.hire_line_items);
  if jsonb_typeof(v_items) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'Booking equipment details are invalid.');
  end if;

  for v_line in select value from jsonb_array_elements(v_items)
  loop
    if coalesce(v_line->>'kind', '') = 'custom' then continue; end if;
    v_catalog_key := v_line->>'catalogKey';
    if v_catalog_key is null or not exists (
      select 1
      from public.inventory_product_mappings mapping
      where mapping.catalog_key = v_catalog_key
    ) then
      v_unmapped := array_append(v_unmapped, coalesce(v_line->>'name', v_catalog_key, 'Unidentified equipment'));
    end if;
  end loop;
  if cardinality(v_unmapped) > 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'Inventory mapping is missing for: ' || array_to_string(array(select distinct item from unnest(v_unmapped) item), ', ') || '. Add the inventory product and map this listing before requesting payment or confirming the booking.'
    );
  end if;

  for v_product in
    select distinct product.id, product.name, product.quantity_on_hand
    from public.inventory_products product
    join public.inventory_product_mappings mapping on mapping.product_id = product.id
    join lateral jsonb_array_elements(v_items) item(value) on item.value->>'catalogKey' = mapping.catalog_key
  loop
    select coalesce(sum((item.value->>'quantity')::integer * mapping.units_per_line_item), 0)
    into v_required
    from jsonb_array_elements(v_items) item(value)
    join public.inventory_product_mappings mapping on mapping.catalog_key = item.value->>'catalogKey'
    where mapping.product_id = v_product.id;
    if v_required = 0 then continue; end if;

    select coalesce(sum((item.value->>'quantity')::integer * mapping.units_per_line_item), 0)
    into v_reserved
    from (
      select reservation.hire_line_items
      from public.inventory_reservations reservation
      join public.bookings held on held.id = reservation.booking_id
      where reservation.active
        and held.id <> p_booking_id
        and held.status not in ('cancelled', 'completed')
        and reservation.pickup_date <= v_booking.dropoff_date
        and reservation.dropoff_date >= v_booking.pickup_date
      union all
      select held.hire_line_items
      from public.bookings held
      where held.status = 'confirmed'
        and held.id <> p_booking_id
        and held.pickup_date <= v_booking.dropoff_date
        and held.dropoff_date >= v_booking.pickup_date
        and not exists (
          select 1 from public.inventory_reservations reservation
          where reservation.booking_id = held.id and reservation.active
        )
    ) active_bookings
    cross join lateral jsonb_array_elements(active_bookings.hire_line_items) item(value)
    join public.inventory_product_mappings mapping on mapping.catalog_key = item.value->>'catalogKey'
    where mapping.product_id = v_product.id;
    v_available := greatest(v_product.quantity_on_hand - v_reserved, 0);
    if v_required > v_available then
      select string_agg(distinct format('%s %s (%s to %s)', held.first_name, held.last_name, held.pickup_date, held.dropoff_date), ', ')
      into v_conflicts
      from (
        select booking.first_name, booking.last_name, reservation.pickup_date, reservation.dropoff_date, reservation.hire_line_items
        from public.inventory_reservations reservation
        join public.bookings booking on booking.id = reservation.booking_id
        where reservation.active
          and booking.id <> p_booking_id
          and booking.status not in ('cancelled', 'completed')
          and reservation.pickup_date <= v_booking.dropoff_date
          and reservation.dropoff_date >= v_booking.pickup_date
        union all
        select booking.first_name, booking.last_name, booking.pickup_date, booking.dropoff_date, booking.hire_line_items
        from public.bookings booking
        where booking.status = 'confirmed'
          and booking.id <> p_booking_id
          and booking.pickup_date <= v_booking.dropoff_date
          and booking.dropoff_date >= v_booking.pickup_date
          and not exists (
            select 1 from public.inventory_reservations reservation
            where reservation.booking_id = booking.id and reservation.active
          )
      ) held
      cross join lateral jsonb_array_elements(held.hire_line_items) item(value)
      join public.inventory_product_mappings mapping on mapping.catalog_key = item.value->>'catalogKey'
      where mapping.product_id = v_product.id;
      v_error := concat_ws('; ', nullif(v_error, ''), format(
        '%s: this booking needs %s unit(s), but only %s are available (%s on hand, %s already reserved) from %s to %s%s',
        v_product.name, v_required, v_available, v_product.quantity_on_hand, v_reserved,
        v_booking.pickup_date, v_booking.dropoff_date,
        case when v_conflicts is null then '' else '; overlapping bookings: ' || v_conflicts end
      ));
    end if;
  end loop;

  if v_error <> '' then
    return jsonb_build_object('ok', false, 'error', 'Insufficient inventory. ' || v_error || '.');
  end if;

  insert into public.inventory_reservations (booking_id, hire_line_items, pickup_date, dropoff_date, active, reserved_at)
  values (p_booking_id, v_items, v_booking.pickup_date, v_booking.dropoff_date, true, now())
  on conflict (booking_id) do update set
    hire_line_items = excluded.hire_line_items,
    pickup_date = excluded.pickup_date,
    dropoff_date = excluded.dropoff_date,
    active = true,
    reserved_at = now();
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.release_booking_inventory(p_booking_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.inventory_reservations set active = false where booking_id = p_booking_id;
$$;

revoke all on function public.create_inventory_product(text, text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.create_inventory_product(text, text, integer, jsonb) to service_role;
revoke all on function public.replace_inventory_product_mappings(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_inventory_product_mappings(uuid, jsonb) to service_role;
revoke all on function public.record_inventory_purchase(uuid, date, integer, integer, integer, text, text) from public, anon, authenticated;
grant execute on function public.record_inventory_purchase(uuid, date, integer, integer, integer, text, text) to service_role;
revoke all on function public.adjust_inventory_stock(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.adjust_inventory_stock(uuid, integer, text) to service_role;
revoke all on function public.reserve_booking_inventory(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.reserve_booking_inventory(uuid, jsonb) to service_role;
revoke all on function public.release_booking_inventory(uuid) from public, anon, authenticated;
grant execute on function public.release_booking_inventory(uuid) to service_role;

do $$
begin
  if not exists (select 1 from public.inventory_products) then
    insert into public.inventory_products (name, category, quantity_on_hand) values
      ('Bose S1 Pro PA Speaker', 'Speakers', 2),
      ('Yamaha DXR15 PA Speaker', 'Speakers', 3),
      ('Behringer Eurolive B1200D Pro Active Subwoofer', 'Subwoofers', 1),
      ('PreSonus AIR15s Active Subwoofer', 'Subwoofers', 1),
      ('Behringer Ultravoice XM8500 Dynamic Microphone', 'Microphones', 3),
      ('Shure SM58', 'Microphones', 2),
      ('Shure SM57', 'Microphones', 2),
      ('Shure SM7B', 'Microphones', 1),
      ('K60 Wireless Microphone', 'Microphones', 2),
      ('BeamZ S1500 Smoke Machine', 'Effects', 1),
      ('CR Lite MagikBar Hub Party Bar', 'Lighting', 1),
      ('Pro DI Box', 'DI boxes', 1),
      ('Generic DI Box', 'DI boxes', 2),
      ('4-Channel DI Box', 'DI boxes', 1),
      ('Spirit E12 / 12-Channel Soundcraft Mixer', 'Mixers', 1),
      ('Behringer X32 Digital Mixer', 'Mixers', 1),
      ('Party Light PAR Can', 'Lighting', 2),
      ('10m Extension Reel', 'Accessories', 1),
      ('Speaker Stand', 'Accessories', 4),
      ('Behringer Xenyx 2-channel Mixer', 'Mixers', 2);

    insert into public.inventory_stock_movements (product_id, movement_type, quantity_change, reason)
    select id, 'opening', quantity_on_hand, 'Opening stock supplied during initial inventory setup'
    from public.inventory_products
    where quantity_on_hand > 0;

    insert into public.inventory_product_mappings (product_id, catalog_key, units_per_line_item)
    select product.id, mapping.catalog_key, mapping.units_per_line_item
    from (values
      ('Bose S1 Pro PA Speaker', 'equipment:bose-s1-pro:Pair (2 speakers)', 2),
      ('Bose S1 Pro PA Speaker', 'equipment:bose-s1-pro:Single speaker', 1),
      ('Bose S1 Pro PA Speaker', 'package:speech-presentation-wireless', 1),
      ('Bose S1 Pro PA Speaker', 'package:speech-presentation', 2),
      ('Bose S1 Pro PA Speaker', 'package:budget-with-a-boom', 2),
      ('Yamaha DXR15 PA Speaker', 'equipment:yamaha-dxr15:Pair (2 speakers)', 2),
      ('Yamaha DXR15 PA Speaker', 'equipment:yamaha-dxr15:Single speaker', 1),
      ('Yamaha DXR15 PA Speaker', 'package:standard-party-events', 2),
      ('Yamaha DXR15 PA Speaker', 'package:big-celebration', 2),
      ('Behringer Eurolive B1200D Pro Active Subwoofer', 'equipment:behringer-b1200d-pro:Single subwoofer', 1),
      ('Behringer Eurolive B1200D Pro Active Subwoofer', 'package:budget-with-a-boom', 1),
      ('PreSonus AIR15s Active Subwoofer', 'equipment:presonus-air15s:Single subwoofer', 1),
      ('PreSonus AIR15s Active Subwoofer', 'package:big-celebration', 1),
      ('Behringer Ultravoice XM8500 Dynamic Microphone', 'equipment:behringer-xm8500:Single microphone', 1),
      ('Behringer Ultravoice XM8500 Dynamic Microphone', 'package:speech-presentation', 1),
      ('Behringer Ultravoice XM8500 Dynamic Microphone', 'package:standard-party-events', 1),
      ('Behringer Ultravoice XM8500 Dynamic Microphone', 'package:budget-with-a-boom', 1),
      ('Shure SM58', 'equipment:shure-sm58:Single microphone', 1),
      ('Shure SM57', 'equipment:shure-sm57:Single microphone', 1),
      ('Shure SM7B', 'equipment:shure-sm7b:Single microphone', 1),
      ('K60 Wireless Microphone', 'equipment:k60-wireless:Single microphone', 1),
      ('K60 Wireless Microphone', 'addon:wireless-microphones', 1),
      ('K60 Wireless Microphone', 'package:speech-presentation-wireless', 1),
      ('K60 Wireless Microphone', 'package:big-celebration', 2),
      ('BeamZ S1500 Smoke Machine', 'equipment:beamz-s1500:Single smoke machine', 1),
      ('CR Lite MagikBar Hub Party Bar', 'equipment:hire-party-lights-bar:Single item', 1),
      ('CR Lite MagikBar Hub Party Bar', 'addon:party-lights-bar', 1),
      ('Pro DI Box', 'equipment:hire-di-box:Single item', 1),
      ('Pro DI Box', 'addon:di-box', 1),
      ('Generic DI Box', 'equipment:hire-generic-di-box:Single item', 1),
      ('Generic DI Box', 'addon:generic-di-box', 1),
      ('4-Channel DI Box', 'equipment:hire-four-channel-di-box:Single item', 1),
      ('4-Channel DI Box', 'addon:four-channel-di-box', 1),
      ('Spirit E12 / 12-Channel Soundcraft Mixer', 'equipment:hire-spirit-e12-mixer:Single item', 1),
      ('Spirit E12 / 12-Channel Soundcraft Mixer', 'addon:spirit-e12-mixer', 1),
      ('Behringer X32 Digital Mixer', 'equipment:hire-behringer-x32:Single item', 1),
      ('Behringer X32 Digital Mixer', 'addon:behringer-x32', 1),
      ('Party Light PAR Can', 'equipment:hire-party-light-par-can:Single item', 1),
      ('Party Light PAR Can', 'addon:party-light-par-can', 1),
      ('10m Extension Reel', 'equipment:hire-extension-reel-10m:Single item', 1),
      ('10m Extension Reel', 'addon:extension-reel-10m', 1),
      ('Speaker Stand', 'equipment:bose-s1-pro:Single speaker', 1),
      ('Speaker Stand', 'equipment:bose-s1-pro:Pair (2 speakers)', 2),
      ('Speaker Stand', 'equipment:yamaha-dxr15:Single speaker', 1),
      ('Speaker Stand', 'equipment:yamaha-dxr15:Pair (2 speakers)', 2),
      ('Speaker Stand', 'package:speech-presentation', 2),
      ('Speaker Stand', 'package:standard-party-events', 2),
      ('Speaker Stand', 'package:budget-with-a-boom', 2),
      ('Speaker Stand', 'package:big-celebration', 2),
      ('Behringer Xenyx 2-channel Mixer', 'package:speech-presentation', 1),
      ('Behringer Xenyx 2-channel Mixer', 'package:standard-party-events', 1),
      ('Behringer Xenyx 2-channel Mixer', 'package:budget-with-a-boom', 1),
      ('Behringer Xenyx 2-channel Mixer', 'package:big-celebration', 1)
    ) as mapping(product_name, catalog_key, units_per_line_item)
    join public.inventory_products product on product.name = mapping.product_name
    on conflict (product_id, catalog_key) do nothing;

  end if;
end;
$$;

create table if not exists public.booking_email_log (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade,
  recipient_email text not null,
  email_type text not null check (email_type in ('booking_request','confirmation','pickup_reminder','custom','invoice','payment_receipt','deposit_authorisation','deposit_release','deposit_capture','enquiry')),
  provider_message_id text,
  attachments jsonb not null default '[]'::jsonb,
  attachments_archived boolean,
  sent_at timestamptz not null default now()
);
alter table public.booking_email_log add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.booking_email_log add column if not exists attachments_archived boolean;
create index if not exists booking_email_log_booking_id_idx on public.booking_email_log(booking_id);
create index if not exists booking_email_log_sent_at_idx on public.booking_email_log(sent_at);
alter table public.booking_email_log drop constraint if exists booking_email_log_email_type_check;
alter table public.booking_email_log add constraint booking_email_log_email_type_check check (email_type in ('booking_request','confirmation','pickup_reminder','custom','invoice','payment_receipt','deposit_authorisation','deposit_release','deposit_capture','enquiry'));
alter table public.bookings add column if not exists reminder_sent_at timestamptz;
alter table public.bookings add column if not exists confirmation_email_sent boolean not null default false;
alter table public.bookings add column if not exists pickup_time time;
alter table public.bookings add column if not exists dropoff_time time;
alter table public.bookings add column if not exists payment_method text;
alter table public.bookings add column if not exists hire_amount_cents integer;
alter table public.bookings add column if not exists hire_line_items jsonb not null default '[]'::jsonb;
alter table public.bookings add column if not exists security_deposit_cents integer;
alter table public.bookings add column if not exists gst_inclusive boolean not null default true;
alter table public.bookings add column if not exists hire_payment_status text not null default 'unpaid';
alter table public.bookings add column if not exists deposit_payment_status text not null default 'not_required';
alter table public.bookings add column if not exists stripe_customer_id text;
alter table public.bookings add column if not exists stripe_hire_payment_intent_id text;
alter table public.bookings add column if not exists stripe_deposit_payment_intent_id text;
alter table public.bookings add column if not exists payment_token text;
alter table public.bookings add column if not exists payment_token_expires_at timestamptz;
alter table public.bookings add column if not exists deposit_captured_cents integer;
alter table public.bookings add column if not exists deposit_released_at timestamptz;
alter table public.bookings add column if not exists deposit_captured_at timestamptz;
alter table public.bookings add column if not exists bank_transfer_reference text;
alter table public.bookings add column if not exists payment_received_at timestamptz;
alter table public.bookings add column if not exists bank_transfer_refunded_at timestamptz;
alter table public.bookings add column if not exists bank_transfer_option text not null default 'both';
alter table public.bookings add column if not exists deposit_hold_date date;
alter table public.bookings add column if not exists deposit_consent_at timestamptz;
alter table public.bookings add column if not exists deposit_capture_before timestamptz;
alter table public.bookings add column if not exists deposit_error text;
alter table public.bookings add column if not exists deposit_attention_sent_at timestamptz;
create index if not exists bookings_deposit_hold_date_idx on public.bookings(deposit_hold_date) where deposit_hold_date is not null;
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check check (status in ('submitted','confirmed','completed','cancelled'));
alter table public.bookings drop constraint if exists bookings_bank_transfer_option_check;
alter table public.bookings add constraint bookings_bank_transfer_option_check check (bank_transfer_option in ('payid','bank_account','both'));
create unique index if not exists bookings_payment_token_idx on public.bookings(payment_token) where payment_token is not null;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  invoice_number text not null unique,
  payment_method text not null,
  hire_amount_cents integer not null,
  security_deposit_cents integer not null default 0,
  gst_inclusive boolean not null default true,
  total_amount_cents integer not null,
  currency text not null default 'aud',
  payment_url text,
  bank_transfer_option text not null default 'both' check (bank_transfer_option in ('payid','bank_account','both')),
  status text not null default 'issued',
  issued_at timestamptz not null default now(),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists invoices_booking_id_idx on public.invoices(booking_id);
alter table public.invoices add column if not exists bank_transfer_option text not null default 'both';
alter table public.invoices add column if not exists gst_inclusive boolean not null default true;
alter table public.invoices drop constraint if exists invoices_bank_transfer_option_check;
alter table public.invoices add constraint invoices_bank_transfer_option_check check (bank_transfer_option in ('payid','bank_account','both'));
create table if not exists public.billing_documents (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  document_type text not null check (document_type in ('invoice','payment_receipt','deposit_authorisation','deposit_release','deposit_capture')),
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invoice_id, document_type)
);
create index if not exists billing_documents_booking_id_idx on public.billing_documents(booking_id);
alter table public.invoices enable row level security;
revoke all on public.invoices from anon, authenticated;
drop policy if exists "service role manages invoices" on public.invoices;
create policy "service role manages invoices" on public.invoices for all to service_role using (true) with check (true);
alter table public.billing_documents enable row level security;
revoke all on public.billing_documents from anon, authenticated;
drop policy if exists "service role manages billing documents" on public.billing_documents;
create policy "service role manages billing documents" on public.billing_documents for all to service_role using (true) with check (true);
create or replace function public.set_bookings_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists invoices_updated_at on public.invoices;
create trigger invoices_updated_at before update on public.invoices
for each row execute function public.set_bookings_updated_at();
alter table public.bookings drop column if exists package_interest;
alter table public.bookings drop column if exists add_ons;
alter table public.bookings drop column if exists guest_count;
alter table public.bookings drop constraint if exists bookings_supersedes_booking_id_fkey;
alter table public.bookings drop column if exists supersedes_booking_id;
alter table public.bookings enable row level security;
revoke all on public.bookings from anon, authenticated;
drop policy if exists "service role manages bookings" on public.bookings;
create policy "service role manages bookings" on public.bookings for all to service_role using (true) with check (true);
alter table public.booking_email_log enable row level security;
revoke all on public.booking_email_log from anon, authenticated;
drop policy if exists "service role manages booking email log" on public.booking_email_log;
create policy "service role manages booking email log" on public.booking_email_log for all to service_role using (true) with check (true);
drop trigger if exists bookings_updated_at on public.bookings;
create trigger bookings_updated_at before update on public.bookings
for each row execute function public.set_bookings_updated_at();

create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'purge-booking-email-log';

insert into storage.buckets (id, name, public) values ('booking-photo-ids', 'booking-photo-ids', false) on conflict (id) do nothing;
drop policy if exists "service role manages booking photos" on storage.objects;
create policy "service role manages booking photos" on storage.objects for all to service_role using (bucket_id = 'booking-photo-ids') with check (bucket_id = 'booking-photo-ids');
insert into storage.buckets (id, name, public) values ('booking-email-attachments', 'booking-email-attachments', false) on conflict (id) do nothing;
drop policy if exists "service role manages email attachments" on storage.objects;
create policy "service role manages email attachments" on storage.objects for all to service_role using (bucket_id = 'booking-email-attachments') with check (bucket_id = 'booking-email-attachments');

-- Create an Auth user in Supabase Dashboard (Authentication > Users) for each administrator.
-- Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY
-- in the deployment environment. Never expose the service role key to a browser.
