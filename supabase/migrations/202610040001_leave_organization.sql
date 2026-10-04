-- Allow a regular team or guild member to leave without exposing a direct
-- delete permission on team_members. Historical results keep their snapshots.
begin;

create or replace function public.leave_organization(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  member_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select role_in_team
    into member_role
  from public.team_members
  where team_id = p_team_id
    and user_id = auth.uid()
  for update;

  if member_role is null then
    raise exception 'Вы не состоите в этой организации';
  end if;

  if member_role = 'leader' then
    raise exception 'Передайте лидерство перед выходом из организации';
  end if;

  delete from public.team_members
  where team_id = p_team_id
    and user_id = auth.uid();
end;
$$;

revoke all on function public.leave_organization(uuid) from public, anon;
grant execute on function public.leave_organization(uuid) to authenticated;

commit;
