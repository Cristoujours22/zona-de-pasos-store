-- T3 bounded server workflows: atomic product creation and defensive RPC grants.
create or replace function public.create_product_atomic(
  p_brand_id uuid,
  p_name text,
  p_slug text,
  p_description text,
  p_audience public.product_audience,
  p_price_cop integer,
  p_lifecycle public.product_lifecycle,
  p_featured boolean,
  p_image jsonb,
  p_variants jsonb
) returns uuid language plpgsql security definer set search_path = public
as $$
declare
  product_id uuid;
  variant jsonb;
  image_public_id text := p_image->>'cloudinary_public_id';
  image_url text := p_image->>'secure_url';
begin
  if not private.is_active_admin(auth.uid()) then raise exception 'forbidden'; end if;
  if p_price_cop is null or p_price_cop < 0 then raise exception 'invalid_price'; end if;
  if p_image is null or jsonb_typeof(p_image) <> 'object' then raise exception 'invalid_image'; end if;
  if image_public_id is null or image_public_id not like 'zona-de-pasos/products/%' then raise exception 'invalid_image'; end if;
  if image_url is null or image_url not like 'https://%' then raise exception 'invalid_image'; end if;
  if p_variants is null or jsonb_typeof(p_variants) <> 'array' or jsonb_array_length(p_variants) < 1 then raise exception 'invalid_variants'; end if;

  insert into public.products(brand_id, name, slug, description, audience, price_cop, lifecycle, featured)
  values (p_brand_id, trim(p_name), lower(trim(p_slug)), coalesce(p_description, ''), p_audience, p_price_cop, p_lifecycle, coalesce(p_featured, false))
  returning id into product_id;

  insert into public.product_images(product_id, cloudinary_public_id, secure_url, alt_text, position, width, height)
  values (
    product_id, image_public_id, image_url, trim(p_image->>'alt_text'), 0,
    (p_image->>'width')::integer, (p_image->>'height')::integer
  );

  for variant in select value from jsonb_array_elements(p_variants) loop
    insert into public.product_variants(product_id, size, color, sku, active, stock_quantity)
    values (
      product_id, trim(variant->>'size'), trim(variant->>'color'), trim(variant->>'sku'),
      coalesce((variant->>'active')::boolean, true), (variant->>'stock_quantity')::integer
    );
  end loop;

  return product_id;
end;
$$;

revoke all on function public.create_product_atomic(uuid, text, text, text, public.product_audience, integer, public.product_lifecycle, boolean, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_product_atomic(uuid, text, text, text, public.product_audience, integer, public.product_lifecycle, boolean, jsonb, jsonb) to authenticated;
