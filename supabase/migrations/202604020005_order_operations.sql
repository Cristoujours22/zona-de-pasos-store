-- T6: audited administrator order operations, configurable carriers, and shipment tracking.
create table public.commerce_carriers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 80 and name !~ '[[:cntrl:]]'),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  tracking_url_template text check (
    tracking_url_template is null or (
      length(tracking_url_template) <= 500 and
      tracking_url_template ~ '^https://[[:alnum:]]([[:alnum:]-]*[[:alnum:]])?([.][[:alnum:]]([[:alnum:]-]*[[:alnum:]])?)+([/?#]|$)' and
      position('{trackingNumber}' in tracking_url_template) > 0 and
      tracking_url_template !~ '[[:cntrl:]]'
    )
  ),
  active boolean not null default true,
  position integer not null default 0 check (position between 0 and 1000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.commerce_carriers(name, slug, tracking_url_template, position) values
  ('Envía', 'envia', 'https://envia.co/rastreo?guia={trackingNumber}', 10),
  ('Inter Rapidísimo', 'inter-rapidisimo', 'https://www.interrapidisimo.com/sigue-tu-envio/?guia={trackingNumber}', 20),
  ('Coordinadora', 'coordinadora', 'https://www.coordinadora.com/rastreo/rastreo-de-guia/?guia={trackingNumber}', 30),
  ('Servientrega', 'servientrega', 'https://www.servientrega.com/wps/portal/rastreo-envio/?guia={trackingNumber}', 40)
on conflict (slug) do nothing;

alter table public.orders
  add column delivery_type_overridden_by uuid references public.admin_profiles(id) on delete set null,
  add column delivery_type_overridden_at timestamptz,
  add column payment_confirmed_by uuid references public.admin_profiles(id) on delete set null,
  add column payment_confirmed_at timestamptz,
  add column payment_confirmed_amount_cop bigint check (payment_confirmed_amount_cop is null or payment_confirmed_amount_cop >= 0),
  add column payment_internal_note text check (payment_internal_note is null or (length(payment_internal_note) <= 500 and payment_internal_note !~ '[[:cntrl:]]')),
  add column carrier_id uuid references public.commerce_carriers(id) on delete set null,
  add column carrier_name_snapshot text check (carrier_name_snapshot is null or length(trim(carrier_name_snapshot)) between 2 and 80),
  add column tracking_number text check (tracking_number is null or tracking_number ~ '^[[:alnum:]][[:alnum:]._/\\-]{1,99}$'),
  add column tracking_url text check (tracking_url is null or (length(tracking_url) <= 1000 and tracking_url ~ '^https://')),
  add column shipped_at timestamptz,
  add column delivered_at timestamptz,
  add column canceled_by uuid references public.admin_profiles(id) on delete set null,
  add column canceled_at timestamptz,
  add column cancellation_reason text check (cancellation_reason is null or (length(trim(cancellation_reason)) between 2 and 500 and cancellation_reason !~ '[[:cntrl:]]'));

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  actor_user_id uuid references public.admin_profiles(id) on delete set null,
  note text check (note is null or (length(note) <= 500 and note !~ '[[:cntrl:]]')),
  created_at timestamptz not null default timezone('utc', now())
);

insert into public.order_status_history(order_id, from_status, to_status, actor_user_id, note, created_at)
select id, null, status, null, 'Estado inicial migrado', created_at from public.orders;

create index commerce_carriers_active_idx on public.commerce_carriers (active, position, name);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at, id);
create index orders_tracking_idx on public.orders (tracking_number) where tracking_number is not null;

alter table public.audit_events add column order_id uuid references public.orders(id) on delete set null;
alter table public.audit_events drop constraint audit_events_event_type_check;
alter table public.audit_events add constraint audit_events_event_type_check check (event_type in (
  'bootstrap_completed', 'invitation_created', 'invitation_accepted', 'role_changed', 'status_changed',
  'order_status_changed', 'order_payment_confirmed', 'order_shipping_updated', 'order_delivery_type_overridden',
  'order_canceled', 'carrier_created', 'carrier_updated'
));
create index audit_events_order_idx on public.audit_events (order_id, created_at desc) where order_id is not null;

create or replace function public.touch_commerce_carrier_timestamp()
returns trigger language plpgsql security definer set search_path = public
as $$ begin new.updated_at = timezone('utc', now()); return new; end; $$;
create trigger commerce_carriers_touch before update on public.commerce_carriers
for each row execute function public.touch_commerce_carrier_timestamp();

create or replace function private.require_order_actor()
returns uuid language plpgsql stable security definer set search_path = public
as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not private.is_active_admin(actor) then raise exception 'forbidden'; end if;
  return actor;
end;
$$;
revoke all on function private.require_order_actor() from public, anon, authenticated;
grant execute on function private.require_order_actor() to authenticated;

create or replace function public.admin_upsert_carrier(
  p_carrier_id uuid, p_name text, p_slug text, p_tracking_url_template text, p_active boolean, p_position integer
) returns public.commerce_carriers language plpgsql security definer set search_path = public
as $$
declare actor uuid := private.require_order_actor(); saved public.commerce_carriers%rowtype; event_name text;
begin
  if p_name is null or length(trim(p_name)) not between 2 and 80 or p_name ~ '[[:cntrl:]]'
    or p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or p_active is null or p_position is null or p_position not between 0 and 1000
    or (p_tracking_url_template is not null and (
      length(p_tracking_url_template) > 500 or p_tracking_url_template !~ '^https://[[:alnum:]]([[:alnum:]-]*[[:alnum:]])?([.][[:alnum:]]([[:alnum:]-]*[[:alnum:]])?)+([/?#]|$)' or
      position('{trackingNumber}' in p_tracking_url_template) = 0 or p_tracking_url_template ~ '[[:cntrl:]]'
    )) then raise exception 'invalid_carrier_input'; end if;

  if p_carrier_id is null then
    insert into public.commerce_carriers(name, slug, tracking_url_template, active, position)
    values (trim(p_name), p_slug, nullif(trim(p_tracking_url_template), ''), p_active, p_position)
    returning * into saved;
    event_name := 'carrier_created';
  else
    update public.commerce_carriers set name = trim(p_name), slug = p_slug,
      tracking_url_template = nullif(trim(p_tracking_url_template), ''), active = p_active, position = p_position
    where id = p_carrier_id returning * into saved;
    if not found then raise exception 'carrier_not_found'; end if;
    event_name := 'carrier_updated';
  end if;
  insert into public.audit_events(event_type, actor_user_id, metadata)
  values (event_name, actor, jsonb_build_object('carrier_id', saved.id, 'slug', saved.slug, 'active', saved.active));
  return saved;
end;
$$;

create or replace function public.admin_transition_order(
  p_order_id uuid, p_expected_updated_at timestamptz, p_to_status public.order_status, p_note text
) returns public.orders language plpgsql security definer set search_path = public
as $$
declare actor uuid := private.require_order_actor(); current_order public.orders%rowtype; saved public.orders%rowtype;
begin
  select * into current_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if current_order.updated_at is distinct from p_expected_updated_at then raise exception 'order_version_conflict'; end if;
  if current_order.status in ('delivered', 'canceled') then raise exception 'invalid_order_transition'; end if;
  if p_note is not null and (length(p_note) > 500 or p_note ~ '[[:cntrl:]]') then raise exception 'invalid_order_input'; end if;
  if not (
    (current_order.status = 'pending_confirmation' and p_to_status = 'awaiting_payment') or
    (current_order.status = 'payment_confirmed' and p_to_status = 'preparing') or
    (current_order.status = 'preparing' and p_to_status = 'shipped') or
    (current_order.status = 'shipped' and p_to_status = 'delivered')
  ) then raise exception 'invalid_order_transition'; end if;
  if current_order.status = 'preparing' and p_to_status = 'shipped' and (
    current_order.carrier_id is null or current_order.carrier_name_snapshot is null or
    current_order.tracking_number is null or current_order.shipping_cost_cop is null
  ) then raise exception 'shipping_details_required'; end if;

  update public.orders set status = p_to_status,
    shipped_at = case when p_to_status = 'shipped' then timezone('utc', now()) else shipped_at end,
    delivered_at = case when p_to_status = 'delivered' then timezone('utc', now()) else delivered_at end
  where id = p_order_id returning * into saved;
  insert into public.order_status_history(order_id, from_status, to_status, actor_user_id, note)
  values (p_order_id, current_order.status, p_to_status, actor, nullif(trim(p_note), ''));
  insert into public.audit_events(event_type, actor_user_id, order_id, metadata)
  values ('order_status_changed', actor, p_order_id, jsonb_build_object('from', current_order.status, 'to', p_to_status));
  return saved;
end;
$$;

create or replace function public.admin_confirm_order_payment(
  p_order_id uuid, p_expected_updated_at timestamptz, p_confirmed_amount_cop bigint, p_internal_note text
) returns public.orders language plpgsql security definer set search_path = public
as $$
declare actor uuid := private.require_order_actor(); current_order public.orders%rowtype; saved public.orders%rowtype;
begin
  select * into current_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if current_order.updated_at is distinct from p_expected_updated_at then raise exception 'order_version_conflict'; end if;
  if current_order.status <> 'awaiting_payment' then raise exception 'invalid_order_transition'; end if;
  if p_confirmed_amount_cop is null or p_confirmed_amount_cop <> current_order.product_subtotal_cop then raise exception 'payment_amount_mismatch'; end if;
  if p_internal_note is not null and (length(p_internal_note) > 500 or p_internal_note ~ '[[:cntrl:]]') then raise exception 'invalid_order_input'; end if;

  update public.orders set status = 'payment_confirmed', payment_confirmed_by = actor,
    payment_confirmed_at = timezone('utc', now()), payment_confirmed_amount_cop = p_confirmed_amount_cop,
    payment_internal_note = nullif(trim(p_internal_note), '')
  where id = p_order_id returning * into saved;
  insert into public.order_status_history(order_id, from_status, to_status, actor_user_id, note)
  values (p_order_id, current_order.status, 'payment_confirmed', actor, 'Pago verificado manualmente');
  insert into public.audit_events(event_type, actor_user_id, order_id, metadata)
  values ('order_payment_confirmed', actor, p_order_id, jsonb_build_object('amount_cop', p_confirmed_amount_cop));
  return saved;
end;
$$;

create or replace function public.admin_update_order_shipping(
  p_order_id uuid, p_expected_updated_at timestamptz, p_shipping_cost_cop bigint,
  p_delivery_type public.delivery_type, p_carrier_id uuid, p_tracking_number text
) returns public.orders language plpgsql security definer set search_path = public
as $$
declare actor uuid := private.require_order_actor(); current_order public.orders%rowtype; carrier public.commerce_carriers%rowtype; saved public.orders%rowtype; generated_url text;
begin
  select * into current_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if current_order.updated_at is distinct from p_expected_updated_at then raise exception 'order_version_conflict'; end if;
  if current_order.status in ('shipped', 'delivered', 'canceled') then raise exception 'invalid_order_transition'; end if;
  if p_shipping_cost_cop is null or p_shipping_cost_cop < 0 or p_tracking_number is null or p_tracking_number !~ '^[[:alnum:]][[:alnum:]._/\\-]{1,99}$' then raise exception 'invalid_shipping_input'; end if;
  select * into carrier from public.commerce_carriers where id = p_carrier_id and active;
  if not found then raise exception 'carrier_not_found'; end if;
  generated_url := case when carrier.tracking_url_template is null then null else replace(carrier.tracking_url_template, '{trackingNumber}', p_tracking_number) end;

  update public.orders set shipping_cost_cop = p_shipping_cost_cop, delivery_type = p_delivery_type,
    delivery_type_overridden_by = case when delivery_type is distinct from p_delivery_type then actor else delivery_type_overridden_by end,
    delivery_type_overridden_at = case when delivery_type is distinct from p_delivery_type then timezone('utc', now()) else delivery_type_overridden_at end,
    carrier_id = carrier.id, carrier_name_snapshot = carrier.name, tracking_number = p_tracking_number, tracking_url = generated_url
  where id = p_order_id returning * into saved;
  insert into public.audit_events(event_type, actor_user_id, order_id, metadata)
  values ('order_shipping_updated', actor, p_order_id, jsonb_build_object('shipping_cost_cop', p_shipping_cost_cop, 'delivery_type', p_delivery_type, 'carrier_id', carrier.id));
  if current_order.delivery_type is distinct from p_delivery_type then
    insert into public.audit_events(event_type, actor_user_id, order_id, metadata)
    values ('order_delivery_type_overridden', actor, p_order_id, jsonb_build_object('from', current_order.delivery_type, 'to', p_delivery_type));
  end if;
  return saved;
end;
$$;

create or replace function public.admin_cancel_order(
  p_order_id uuid, p_expected_updated_at timestamptz, p_reason text
) returns public.orders language plpgsql security definer set search_path = public
as $$
declare actor uuid := private.require_order_actor(); current_order public.orders%rowtype; saved public.orders%rowtype;
begin
  select * into current_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if current_order.updated_at is distinct from p_expected_updated_at then raise exception 'order_version_conflict'; end if;
  if current_order.status in ('shipped', 'delivered', 'canceled') then raise exception 'invalid_order_transition'; end if;
  if p_reason is null or length(trim(p_reason)) not between 2 and 500 or p_reason ~ '[[:cntrl:]]' then raise exception 'invalid_order_input'; end if;

  update public.orders set status = 'canceled', canceled_by = actor, canceled_at = timezone('utc', now()), cancellation_reason = trim(p_reason)
  where id = p_order_id returning * into saved;
  insert into public.order_status_history(order_id, from_status, to_status, actor_user_id, note)
  values (p_order_id, current_order.status, 'canceled', actor, trim(p_reason));
  insert into public.audit_events(event_type, actor_user_id, order_id, metadata)
  values ('order_canceled', actor, p_order_id, jsonb_build_object('from', current_order.status, 'reason', trim(p_reason)));
  return saved;
end;
$$;

alter table public.commerce_carriers enable row level security;
alter table public.order_status_history enable row level security;
create policy commerce_carriers_admin_read on public.commerce_carriers for select to authenticated
using (private.is_active_admin((select auth.uid())));
create policy order_status_history_admin_read on public.order_status_history for select to authenticated
using (private.is_active_admin((select auth.uid())));

grant select on public.commerce_carriers, public.order_status_history to authenticated;
revoke all on function public.admin_upsert_carrier(uuid, text, text, text, boolean, integer) from public, anon, authenticated;
revoke all on function public.admin_transition_order(uuid, timestamptz, public.order_status, text) from public, anon, authenticated;
revoke all on function public.admin_confirm_order_payment(uuid, timestamptz, bigint, text) from public, anon, authenticated;
revoke all on function public.admin_update_order_shipping(uuid, timestamptz, bigint, public.delivery_type, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_cancel_order(uuid, timestamptz, text) from public, anon, authenticated;
grant execute on function public.admin_upsert_carrier(uuid, text, text, text, boolean, integer) to authenticated;
grant execute on function public.admin_transition_order(uuid, timestamptz, public.order_status, text) to authenticated;
grant execute on function public.admin_confirm_order_payment(uuid, timestamptz, bigint, text) to authenticated;
grant execute on function public.admin_update_order_shipping(uuid, timestamptz, bigint, public.delivery_type, uuid, text) to authenticated;
grant execute on function public.admin_cancel_order(uuid, timestamptz, text) to authenticated;
