-- T2: individual administrator accounts, durable bootstrap, and private invitations.
create type public.admin_role as enum ('developer_superadmin', 'admin');
create type public.account_status as enum ('active', 'suspended');
create schema if not exists private;

create table public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null check (email = lower(trim(email))),
  display_name text not null check (length(trim(display_name)) >= 2),
  role public.admin_role not null,
  status public.account_status not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.bootstrap_state (
  singleton boolean primary key default true check (singleton),
  completed_at timestamptz,
  completed_by uuid references public.admin_profiles(id) on delete set null
);
insert into public.bootstrap_state (singleton) values (true) on conflict (singleton) do nothing;

create table public.admin_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(trim(email))),
  role public.admin_role not null default 'admin',
  token_hash text not null unique check (length(token_hash) = 64),
  invited_by uuid not null references public.admin_profiles(id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.admin_profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in (
    'bootstrap_completed', 'invitation_created', 'invitation_accepted',
    'role_changed', 'status_changed'
  )),
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  invitation_id uuid references public.admin_invitations(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index admin_invitations_email_idx on public.admin_invitations (email);
create index admin_invitations_pending_idx on public.admin_invitations (expires_at) where accepted_at is null;
create index audit_events_created_at_idx on public.audit_events (created_at desc);
create index audit_events_actor_idx on public.audit_events (actor_user_id, created_at desc);

create or replace function private.is_active_admin(subject uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admin_profiles where id = subject and status = 'active'); $$;

create or replace function private.is_superadmin(subject uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admin_profiles where id = subject and role = 'developer_superadmin' and status = 'active'); $$;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
alter default privileges in schema private revoke execute on functions from public;
revoke all on function private.is_active_admin(uuid) from public, anon, authenticated;
revoke all on function private.is_superadmin(uuid) from public, anon, authenticated;
grant execute on function private.is_active_admin(uuid) to authenticated;
grant execute on function private.is_superadmin(uuid) to authenticated;

create or replace function public.touch_admin_profile()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;
create trigger admin_profiles_touch before update on public.admin_profiles
for each row execute function public.touch_admin_profile();

create or replace function public.audit_admin_profile_change()
returns trigger language plpgsql security definer set search_path = public
as $$
declare actor uuid := nullif(current_setting('app.actor_user_id', true), '')::uuid;
begin
  if old.role is distinct from new.role then
    insert into public.audit_events(event_type, actor_user_id, target_user_id, metadata)
    values ('role_changed', coalesce(actor, auth.uid()), new.id, jsonb_build_object('from', old.role, 'to', new.role));
  end if;
  if old.status is distinct from new.status then
    insert into public.audit_events(event_type, actor_user_id, target_user_id, metadata)
    values ('status_changed', coalesce(actor, auth.uid()), new.id, jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;
create trigger admin_profiles_audit_changes after update on public.admin_profiles
for each row execute function public.audit_admin_profile_change();

-- The caller creates the auth.users row with the server-only admin API, then this
-- function atomically claims the durable marker and creates the profile.
create or replace function public.claim_bootstrap(
  p_user_id uuid, p_email text, p_display_name text
) returns boolean language plpgsql security definer set search_path = public
as $$
declare claimed boolean;
begin
  update public.bootstrap_state set completed_at = timezone('utc', now())
  where singleton = true and completed_at is null
  returning true into claimed;
  if not found then return false; end if;

  insert into public.admin_profiles(id, email, display_name, role)
  values (p_user_id, lower(trim(p_email)), trim(p_display_name), 'developer_superadmin');
  update public.bootstrap_state set completed_by = p_user_id where singleton = true;
  insert into public.audit_events(event_type, actor_user_id, target_user_id, metadata)
  values ('bootstrap_completed', p_user_id, p_user_id, jsonb_build_object('email', lower(trim(p_email))));
  return true;
end;
$$;

create or replace function public.create_admin_invitation(
  p_email text, p_role public.admin_role, p_token_hash text, p_expires_at timestamptz, p_invited_by uuid
) returns uuid language plpgsql security definer set search_path = public
as $$
declare invitation_id uuid;
begin
  if not private.is_superadmin(p_invited_by) then
    raise exception 'forbidden';
  end if;
  insert into public.admin_invitations(email, role, token_hash, expires_at, invited_by)
  values (lower(trim(p_email)), p_role, p_token_hash, p_expires_at, p_invited_by)
  returning id into invitation_id;
  insert into public.audit_events(event_type, actor_user_id, invitation_id, metadata)
  values ('invitation_created', p_invited_by, invitation_id, jsonb_build_object('email', lower(trim(p_email)), 'role', p_role, 'expires_at', p_expires_at));
  return invitation_id;
end;
$$;

-- The update predicate is the single-use and expiry gate. The caller deletes the
-- just-created auth user if this atomic claim loses a race.
create or replace function public.consume_admin_invitation(
  p_id uuid, p_token_hash text, p_user_id uuid, p_display_name text
) returns public.admin_role language plpgsql security definer set search_path = public
as $$
declare invited_role public.admin_role; invited_email text;
begin
  update public.admin_invitations
  set accepted_at = timezone('utc', now()), accepted_by = p_user_id
  where id = p_id and token_hash = p_token_hash and accepted_at is null and expires_at > timezone('utc', now())
  returning role, email into invited_role, invited_email;
  if not found then return null; end if;

  insert into public.admin_profiles(id, email, display_name, role)
  values (p_user_id, invited_email, trim(p_display_name), invited_role);
  insert into public.audit_events(event_type, actor_user_id, target_user_id, invitation_id, metadata)
  values ('invitation_accepted', p_user_id, p_user_id, p_id, jsonb_build_object('email', invited_email, 'role', invited_role));
  return invited_role;
end;
$$;

alter table public.admin_profiles enable row level security;
alter table public.bootstrap_state enable row level security;
alter table public.admin_invitations enable row level security;
alter table public.audit_events enable row level security;

create policy admin_profiles_self_or_superadmin on public.admin_profiles for select to authenticated
using (id = (select auth.uid()) or private.is_superadmin((select auth.uid())));
create policy admin_profiles_superadmin_update on public.admin_profiles for update to authenticated
using (private.is_superadmin((select auth.uid()))) with check (private.is_superadmin((select auth.uid())));
create policy invitations_superadmin_read on public.admin_invitations for select to authenticated
using (private.is_superadmin((select auth.uid())));
create policy audit_superadmin_read on public.audit_events for select to authenticated
using (private.is_superadmin((select auth.uid())));

revoke all on public.bootstrap_state, public.admin_invitations, public.audit_events from anon, authenticated;
grant select on public.admin_profiles to authenticated;
grant update (display_name, role, status) on public.admin_profiles to authenticated;
grant select on public.admin_invitations, public.audit_events to authenticated;
revoke all on function public.claim_bootstrap(uuid, text, text) from public, anon, authenticated;
revoke all on function public.create_admin_invitation(text, public.admin_role, text, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.consume_admin_invitation(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_bootstrap(uuid, text, text) to service_role;
grant execute on function public.create_admin_invitation(text, public.admin_role, text, timestamptz, uuid) to service_role;
grant execute on function public.consume_admin_invitation(uuid, text, uuid, text) to service_role;
