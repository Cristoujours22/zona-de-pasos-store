-- Correct deployed PL/pgSQL lint warnings without changing public behavior or grants.
create or replace function public.claim_bootstrap(
  p_user_id uuid, p_email text, p_display_name text
) returns boolean language plpgsql security definer set search_path = public
as $$
begin
  update public.bootstrap_state set completed_at = timezone('utc', now())
  where singleton = true and completed_at is null;
  if not found then return false; end if;

  insert into public.admin_profiles(id, email, display_name, role)
  values (p_user_id, lower(trim(p_email)), trim(p_display_name), 'developer_superadmin');
  update public.bootstrap_state set completed_by = p_user_id where singleton = true;
  insert into public.audit_events(event_type, actor_user_id, target_user_id, metadata)
  values ('bootstrap_completed', p_user_id, p_user_id, jsonb_build_object('email', lower(trim(p_email))));
  return true;
end;
$$;

create or replace function public.create_guest_order_atomic(
  p_idempotency_key uuid,
  p_buyer_full_name text,
  p_colombian_document_number text,
  p_phone text,
  p_email text,
  p_department text,
  p_city_municipality text,
  p_address text,
  p_neighborhood text,
  p_delivery_instructions text,
  p_items jsonb
) returns table (
  order_id uuid,
  order_number text,
  product_subtotal_cop bigint,
  delivery_type public.delivery_type,
  replayed boolean,
  item_summaries jsonb
) language plpgsql security definer set search_path = public
as $$
declare
  existing_order public.orders%rowtype;
  created_order public.orders%rowtype;
  item jsonb;
  variant_id uuid;
  quantity integer;
  product_price integer;
  current_stock integer;
  product_id uuid;
  product_name text;
  brand_name text;
  variant_size text;
  variant_color text;
  variant_sku text;
  snapshots jsonb := '[]'::jsonb;
  result_item_summaries jsonb := '[]'::jsonb;
  seen_variants text[] := array[]::text[];
  subtotal bigint := 0;
  origin_city text := '';
  delivery_kind public.delivery_type;
begin
  if p_idempotency_key is null or p_idempotency_key::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'invalid_order_input'; end if;
  if p_buyer_full_name is null or length(trim(p_buyer_full_name)) not between 2 and 120 or p_buyer_full_name ~ '[[:cntrl:]]' or p_buyer_full_name !~ '^[[:alpha:]][[:alpha:][:space:].''-]{1,119}$'
    or p_colombian_document_number is null or p_colombian_document_number !~ '^[0-9]{6,10}$'
    or p_phone is null or p_phone !~ '^573[0-9]{9}$'
    or p_department is null or length(trim(p_department)) not between 2 and 80 or p_department ~ '[[:cntrl:]]' or p_department !~ '^[[:alpha:]][[:alpha:][:space:].''-]{1,79}$'
    or p_city_municipality is null or length(trim(p_city_municipality)) not between 2 and 80 or p_city_municipality ~ '[[:cntrl:]]' or p_city_municipality !~ '^[[:alpha:]][[:alpha:][:space:].''-]{1,79}$'
    or p_address is null or length(trim(p_address)) not between 5 and 160 or p_address ~ '[[:cntrl:]]' or p_address !~ '^[[:alnum:]][[:alnum:][:space:]#.,''°/-]{4,159}$'
    or p_neighborhood is null or length(trim(p_neighborhood)) not between 2 and 80 or p_neighborhood ~ '[[:cntrl:]]' or p_neighborhood !~ '^[[:alnum:]][[:alnum:][:space:].''-]{1,79}$' or p_neighborhood !~ '[[:alpha:]]'
    or (p_email is not null and (length(trim(p_email)) not between 3 and 254 or p_email ~ '[[:cntrl:]]' or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'))
    or (p_delivery_instructions is not null and (length(trim(p_delivery_instructions)) > 300 or p_delivery_instructions ~ '[[:cntrl:]]' or p_delivery_instructions !~ '^[[:alnum:]][[:alnum:][:space:]#.,''°/()-]{0,299}$'))
  then raise exception 'invalid_order_input'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid_order_input';
  end if;

  select * into existing_order from public.orders where idempotency_key = p_idempotency_key;
  if found then
    select coalesce(jsonb_agg(jsonb_build_object(
      'product_brand_name', oi.product_brand_name, 'product_name', oi.product_name,
      'variant_size', oi.variant_size, 'variant_color', oi.variant_color, 'variant_sku', oi.variant_sku,
      'requested_quantity', oi.requested_quantity, 'unit_price_cop', oi.unit_price_cop, 'line_total_cop', oi.line_total_cop
      ) order by oi.created_at, oi.id), '[]'::jsonb) into result_item_summaries
      from public.order_items oi where oi.order_id = existing_order.id;
    return query select existing_order.id, existing_order.order_number, existing_order.product_subtotal_cop, existing_order.delivery_type, true, result_item_summaries;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('guest-order-phone:' || p_phone, 0));
  perform pg_advisory_xact_lock(hashtextextended('guest-order-document:' || p_colombian_document_number, 0));

  if (select count(*) from public.orders where created_at >= now() - interval '15 minutes' and (phone = p_phone or colombian_document_number = p_colombian_document_number)) >= 3 then
    raise exception 'order_rate_limited';
  end if;

  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item) <> 'object' then raise exception 'invalid_order_input'; end if;
    if not (item ? 'variant_id') or not (item ? 'quantity') or (select count(*) from jsonb_object_keys(item)) <> 2
      or jsonb_typeof(item->'variant_id') <> 'string' or jsonb_typeof(item->'quantity') <> 'number'
      or item->>'variant_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or item->>'quantity' !~ '^[1-9][0-9]?$' then raise exception 'invalid_order_input'; end if;
    variant_id := (item->>'variant_id')::uuid;
    quantity := (item->>'quantity')::integer;
    if variant_id::text = any(seen_variants) then raise exception 'duplicate_variant'; end if;
    seen_variants := array_append(seen_variants, variant_id::text);

    select v.product_id, p.name, b.name, v.size, v.color, v.sku, p.price_cop, v.stock_quantity
      into product_id, product_name, brand_name, variant_size, variant_color, variant_sku, product_price, current_stock
      from public.product_variants v
      join public.products p on p.id = v.product_id
      join public.brands b on b.id = p.brand_id
      where v.id = variant_id and v.active and p.lifecycle = 'published'
      for share;
    if not found then raise exception 'variant_unavailable'; end if;
    if current_stock < quantity then raise exception 'insufficient_stock'; end if;

    subtotal := subtotal + product_price::bigint * quantity;
    snapshots := snapshots || jsonb_build_array(jsonb_build_object(
      'product_id', product_id, 'variant_id', variant_id,
      'product_brand_name', brand_name, 'product_name', product_name,
      'variant_size', variant_size, 'variant_color', variant_color, 'variant_sku', variant_sku,
      'unit_price_cop', product_price, 'requested_quantity', quantity,
      'line_total_cop', product_price::bigint * quantity
    ));
  end loop;

  select dispatch_origin_city into origin_city from public.commerce_settings where singleton = true;
  delivery_kind := case
    when origin_city <> '' and private.normalize_order_city(p_city_municipality) = private.normalize_order_city(origin_city)
      then 'local'::public.delivery_type
    else 'national'::public.delivery_type
  end;

  insert into public.orders(
    idempotency_key, buyer_full_name, colombian_document_number, phone, email,
    department, city_municipality, address, neighborhood, delivery_instructions,
    delivery_type, product_subtotal_cop
  ) values (
    p_idempotency_key, trim(p_buyer_full_name), p_colombian_document_number, p_phone, nullif(trim(p_email), ''),
    trim(p_department), trim(p_city_municipality), trim(p_address), trim(p_neighborhood), nullif(trim(p_delivery_instructions), ''),
    delivery_kind, subtotal
  ) on conflict (idempotency_key) do nothing returning * into created_order;

  if not found then
    select * into existing_order from public.orders where idempotency_key = p_idempotency_key;
    if not found then raise exception 'order_creation_ambiguous'; end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'product_brand_name', oi.product_brand_name, 'product_name', oi.product_name,
      'variant_size', oi.variant_size, 'variant_color', oi.variant_color, 'variant_sku', oi.variant_sku,
      'requested_quantity', oi.requested_quantity, 'unit_price_cop', oi.unit_price_cop, 'line_total_cop', oi.line_total_cop
      ) order by oi.created_at, oi.id), '[]'::jsonb) into result_item_summaries
      from public.order_items oi where oi.order_id = existing_order.id;
    return query select existing_order.id, existing_order.order_number, existing_order.product_subtotal_cop, existing_order.delivery_type, true, result_item_summaries;
    return;
  end if;

  insert into public.order_items(
    order_id, product_id, variant_id, product_brand_name, product_name,
    variant_size, variant_color, variant_sku, unit_price_cop, requested_quantity, line_total_cop
  )
  select created_order.id, (snapshot->>'product_id')::uuid, (snapshot->>'variant_id')::uuid,
    snapshot->>'product_brand_name', snapshot->>'product_name', snapshot->>'variant_size', snapshot->>'variant_color', snapshot->>'variant_sku',
    (snapshot->>'unit_price_cop')::bigint, (snapshot->>'requested_quantity')::integer, (snapshot->>'line_total_cop')::bigint
  from jsonb_array_elements(snapshots) as snapshot;

  select coalesce(jsonb_agg(jsonb_build_object(
    'product_brand_name', oi.product_brand_name, 'product_name', oi.product_name,
    'variant_size', oi.variant_size, 'variant_color', oi.variant_color, 'variant_sku', oi.variant_sku,
    'requested_quantity', oi.requested_quantity, 'unit_price_cop', oi.unit_price_cop, 'line_total_cop', oi.line_total_cop
    ) order by oi.created_at, oi.id), '[]'::jsonb) into result_item_summaries
    from public.order_items oi where oi.order_id = created_order.id;
  return query select created_order.id, created_order.order_number, created_order.product_subtotal_cop, created_order.delivery_type, false, result_item_summaries;
end;
$$;

revoke all on function public.claim_bootstrap(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_bootstrap(uuid, text, text) to service_role;
revoke all on function public.create_guest_order_atomic(uuid, text, text, text, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_guest_order_atomic(uuid, text, text, text, text, text, text, text, text, text, jsonb) to service_role;
