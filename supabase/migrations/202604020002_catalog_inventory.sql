-- T3 S2-S3, S9-S10: catalog, safe storefront settings, and manual inventory.
create type public.product_audience as enum ('men', 'women', 'unisex');
create type public.product_lifecycle as enum ('draft', 'published', 'archived');
create type public.stock_display_mode as enum ('detailed', 'availability_only', 'hidden');

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug = lower(trim(slug)) and length(trim(slug)) > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug = lower(trim(slug)) and length(trim(slug)) > 0),
  description text not null default '',
  audience public.product_audience not null,
  price_cop integer not null check (price_cop >= 0),
  lifecycle public.product_lifecycle not null default 'draft',
  featured boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  size text not null check (length(trim(size)) > 0),
  color text not null check (length(trim(color)) > 0),
  sku text not null unique check (length(trim(sku)) > 0),
  active boolean not null default true,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (product_id, size, color)
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  cloudinary_public_id text not null check (length(trim(cloudinary_public_id)) > 0),
  secure_url text not null check (secure_url like 'https://%'),
  alt_text text not null check (length(trim(alt_text)) > 0),
  position integer not null default 0 check (position >= 0),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  created_at timestamptz not null default timezone('utc', now()),
  unique (product_id, position)
);

create table public.commerce_settings (
  singleton boolean primary key default true check (singleton),
  whatsapp_phone text not null default '',
  nequi_details text not null default '',
  dispatch_origin_city text not null default '',
  dispatch_origin_address text not null default '',
  inventory_low_threshold integer not null default 3 check (inventory_low_threshold >= 0),
  stock_display_mode public.stock_display_mode not null default 'detailed',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
insert into public.commerce_settings (singleton) values (true) on conflict (singleton) do nothing;

create table public.inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  actor_user_id uuid not null references public.admin_profiles(id) on delete restrict,
  delta integer not null check (delta <> 0),
  reason text not null check (length(trim(reason)) > 0),
  order_reference text,
  stock_before integer not null check (stock_before >= 0),
  stock_after integer not null check (stock_after >= 0),
  created_at timestamptz not null default timezone('utc', now())
);

create index products_brand_idx on public.products (brand_id);
create index products_catalog_idx on public.products (lifecycle, featured);
create index variants_product_active_idx on public.product_variants (product_id, active);
create index images_product_position_idx on public.product_images (product_id, position);
create index inventory_adjustments_variant_idx on public.inventory_adjustments (variant_id, created_at desc);
create index inventory_adjustments_actor_idx on public.inventory_adjustments (actor_user_id, created_at desc);

create or replace function public.touch_catalog_timestamp()
returns trigger language plpgsql security definer set search_path = public
as $$ begin new.updated_at = timezone('utc', now()); return new; end; $$;
create trigger brands_touch before update on public.brands for each row execute function public.touch_catalog_timestamp();
create trigger products_touch before update on public.products for each row execute function public.touch_catalog_timestamp();
create trigger variants_touch before update on public.product_variants for each row execute function public.touch_catalog_timestamp();
create trigger settings_touch before update on public.commerce_settings for each row execute function public.touch_catalog_timestamp();

-- A public view is deliberately narrower than the admin-only settings table.
create or replace view public.storefront_settings as
select whatsapp_phone, dispatch_origin_city, inventory_low_threshold, stock_display_mode, updated_at
from public.commerce_settings where singleton = true;

create or replace view public.storefront_product_variants as
select v.id, v.product_id, v.size, v.color, v.sku,
  v.stock_quantity > 0 as available,
  case s.stock_display_mode
    when 'detailed' then case when v.stock_quantity = 0 then 'Sin stock' when v.stock_quantity <= s.inventory_low_threshold then 'Pocas unidades' else 'Disponible' end
    when 'availability_only' then case when v.stock_quantity > 0 then 'Disponible' else 'No disponible' end
    else null
  end as stock_label
from public.product_variants v
join public.products p on p.id = v.product_id
cross join public.commerce_settings s
where p.lifecycle = 'published' and v.active and s.singleton = true;

create or replace function public.adjust_inventory(
  p_variant_id uuid, p_delta integer, p_reason text, p_order_reference text default null
) returns integer language plpgsql security definer set search_path = public
as $$
declare actor uuid := auth.uid(); current_stock integer; next_stock integer;
begin
  if not private.is_active_admin(actor) then raise exception 'forbidden'; end if;
  if p_delta is null or p_delta = 0 then raise exception 'invalid_delta'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'invalid_reason'; end if;
  select stock_quantity into current_stock from public.product_variants where id = p_variant_id for update;
  if not found then raise exception 'variant_not_found'; end if;
  if current_stock + p_delta < 0 then raise exception 'negative_stock'; end if;
  next_stock := current_stock + p_delta;
  update public.product_variants set stock_quantity = next_stock where id = p_variant_id;
  insert into public.inventory_adjustments(variant_id, actor_user_id, delta, reason, order_reference, stock_before, stock_after)
  values (p_variant_id, actor, p_delta, trim(p_reason), p_order_reference, current_stock, next_stock);
  return next_stock;
end;
$$;

alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.commerce_settings enable row level security;
alter table public.inventory_adjustments enable row level security;

create policy brands_public_read on public.brands for select to anon, authenticated using (true);
create policy brands_admin_write on public.brands for insert to authenticated with check (private.is_active_admin((select auth.uid())));
create policy brands_admin_update on public.brands for update to authenticated using (private.is_active_admin((select auth.uid()))) with check (private.is_active_admin((select auth.uid())));

create policy products_public_read on public.products for select to anon, authenticated using (lifecycle = 'published');
create policy products_admin_read on public.products for select to authenticated using (private.is_active_admin((select auth.uid())));
create policy products_admin_write on public.products for insert to authenticated with check (private.is_active_admin((select auth.uid())));
create policy products_admin_update on public.products for update to authenticated using (private.is_active_admin((select auth.uid()))) with check (private.is_active_admin((select auth.uid())));

create policy variants_public_read on public.product_variants for select to anon using (active and exists (select 1 from public.products p where p.id = product_id and p.lifecycle = 'published'));
create policy variants_admin_read on public.product_variants for select to authenticated using (private.is_active_admin((select auth.uid())));
create policy variants_admin_insert on public.product_variants for insert to authenticated with check (private.is_active_admin((select auth.uid())));
create policy variants_admin_update on public.product_variants for update to authenticated using (private.is_active_admin((select auth.uid()))) with check (private.is_active_admin((select auth.uid())));

create policy images_public_read on public.product_images for select to anon, authenticated using (exists (select 1 from public.products p where p.id = product_id and p.lifecycle = 'published'));
create policy images_admin_write on public.product_images for insert to authenticated with check (private.is_active_admin((select auth.uid())));
create policy images_admin_update on public.product_images for update to authenticated using (private.is_active_admin((select auth.uid()))) with check (private.is_active_admin((select auth.uid())));

create policy settings_admin_read on public.commerce_settings for select to authenticated using (private.is_active_admin((select auth.uid())));
create policy settings_admin_update on public.commerce_settings for update to authenticated using (private.is_active_admin((select auth.uid()))) with check (private.is_active_admin((select auth.uid())));

create policy adjustments_admin_read on public.inventory_adjustments for select to authenticated using (private.is_active_admin((select auth.uid())));

revoke all on public.brands, public.products, public.product_variants, public.product_images from anon, authenticated;
revoke all on public.commerce_settings from anon, authenticated;
revoke all on public.inventory_adjustments from anon, authenticated;
grant select on public.brands, public.products, public.product_images to anon, authenticated;
grant select (id, product_id, size, color, sku, active) on public.product_variants to anon;
grant select on public.product_variants, public.commerce_settings, public.inventory_adjustments to authenticated;
grant insert, update on public.brands, public.products, public.product_images to authenticated;
grant insert (product_id, size, color, sku, active, stock_quantity) on public.product_variants to authenticated;
grant update (size, color, sku, active) on public.product_variants to authenticated;
grant update on public.commerce_settings to authenticated;
grant select on public.storefront_settings to anon, authenticated;
grant select on public.storefront_product_variants to anon, authenticated;
revoke all on function public.adjust_inventory(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.adjust_inventory(uuid, integer, text, text) to authenticated;
