-- Fix invitation acceptance so accepted_by never references a profile before it exists.
create or replace function public.consume_admin_invitation(
  p_id uuid, p_token_hash text, p_user_id uuid, p_display_name text
) returns public.admin_role language plpgsql security definer set search_path = public
as $$
declare
  invited_role public.admin_role;
  invited_email text;
begin
  select role, email
  into invited_role, invited_email
  from public.admin_invitations
  where id = p_id
    and token_hash = p_token_hash
    and accepted_at is null
    and expires_at > timezone('utc', now())
  for update;
  if not found then return null; end if;

  insert into public.admin_profiles(id, email, display_name, role)
  values (p_user_id, invited_email, trim(p_display_name), invited_role);

  update public.admin_invitations
  set accepted_at = timezone('utc', now()), accepted_by = p_user_id
  where id = p_id and accepted_at is null;
  if not found then raise exception 'invitation_claim_lost'; end if;

  insert into public.audit_events(event_type, actor_user_id, target_user_id, invitation_id, metadata)
  values ('invitation_accepted', p_user_id, p_user_id, p_id, jsonb_build_object('email', invited_email, 'role', invited_role));
  return invited_role;
end;
$$;

revoke all on function public.consume_admin_invitation(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.consume_admin_invitation(uuid, text, uuid, text) to service_role;
