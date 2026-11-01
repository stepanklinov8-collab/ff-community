-- An organization may own another organization. Only the ultimate human owner
-- inherits ownership powers; leadership of a parent does not confer them.
begin;
alter table public.teams
  add column owner_team_id uuid references public.teams(id) on delete restrict,
  add column ultimate_owner_user_id uuid references auth.users(id) on delete restrict,
  add column ownership_revision bigint not null default 1,
  add constraint teams_single_owner check (num_nonnulls(owner_user_id,owner_team_id)<=1),
  add constraint teams_not_own_parent check (owner_team_id is distinct from id);
update public.teams set ultimate_owner_user_id=owner_user_id;
create index teams_ultimate_owner_active_idx on public.teams(ultimate_owner_user_id,id) where dissolved_at is null;
create index teams_parent_owner_idx on public.teams(owner_team_id) where owner_team_id is not null;

alter table public.organization_control_audit drop constraint organization_control_audit_action_check;
alter table public.organization_control_audit add constraint organization_control_audit_action_check check(action in(
 'leader_changed','leader_removed_from_roster','contract_access_granted','contract_access_revoked',
 'contract_access_revoked_member_removed','ownership_changed'));

create or replace function public.set_initial_organization_owner() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 new.owner_user_id:=new.leader_id;
 new.owner_team_id:=null;
 new.ultimate_owner_user_id:=new.leader_id;
 new.ownership_revision:=1;
 return new;
end $$;

drop trigger if exists prevent_direct_organization_owner_change_trigger on public.teams;
create or replace function public.prevent_direct_organization_owner_change() returns trigger
language plpgsql security definer set search_path=public as $$
declare root_owner uuid; graph_changed boolean; cycle_found boolean;
begin
 if tg_op='INSERT' then
   new.ultimate_owner_user_id:=new.owner_user_id;
   new.ownership_revision:=1;
   return new;
 end if;
 graph_changed:=new.owner_user_id is distinct from old.owner_user_id or new.owner_team_id is distinct from old.owner_team_id;
 if graph_changed then
   if current_setting('omcite.allow_organization_owner_transfer',true) is distinct from 'on' then
     raise exception 'Изменить владельца можно только завершённой сделкой';
   end if;
   perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 end if;
 if num_nonnulls(new.owner_user_id,new.owner_team_id)>1 then raise exception 'У организации может быть только один непосредственный владелец';end if;
 if new.owner_team_id is not null then
   if new.owner_team_id=new.id then raise exception 'Организация не может владеть собой';end if;
   with recursive ancestors as (
     select t.id,t.owner_team_id,array[t.id] path,false cycle from public.teams t where t.id=new.owner_team_id
     union all
     select t.id,t.owner_team_id,a.path||t.id,t.id=any(a.path) from public.teams t join ancestors a on t.id=a.owner_team_id where not a.cycle
   ) select coalesce(bool_or(id=new.id or cycle),false) into cycle_found from ancestors;
   if cycle_found then raise exception 'Покупка создаёт замкнутую цепочку владения';end if;
   select ultimate_owner_user_id into root_owner from public.teams where id=new.owner_team_id and dissolved_at is null;
   if root_owner is null then raise exception 'У организации-покупателя нет действующего владельца';end if;
 else root_owner:=new.owner_user_id;end if;
 if old.dissolved_at is null and new.dissolved_at is not null and exists(select 1 from public.teams where owner_team_id=new.id and dissolved_at is null) then
   raise exception 'Сначала урегулируйте владение дочерними организациями';
 end if;
 new.ultimate_owner_user_id:=root_owner;
 new.ownership_revision:=old.ownership_revision+case when graph_changed or root_owner is distinct from old.ultimate_owner_user_id then 1 else 0 end;
 return new;
end $$;
create trigger zz_organization_ownership_guard before insert or update on public.teams
for each row execute function public.prevent_direct_organization_owner_change();

create function public.organization_owner_changed() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.ownership_revision=old.ownership_revision then return new;end if;
 delete from public.organization_contract_access where team_id=new.id;
 insert into public.organization_control_audit(team_id,actor_user_id,action,details)
 values(new.id,auth.uid(),'ownership_changed',jsonb_build_object(
   'previousUserOwner',old.owner_user_id,'previousOrganizationOwner',old.owner_team_id,
   'userOwner',new.owner_user_id,'organizationOwner',new.owner_team_id,'ultimateOwner',new.ultimate_owner_user_id,
   'revision',new.ownership_revision));
 -- Every descendant is updated through the same guard. Its own leaders and
 -- membership remain intact; permissions from a former root owner are revoked.
 update public.teams set ultimate_owner_user_id=new.ultimate_owner_user_id where owner_team_id=new.id;
 return new;
end $$;
create trigger organization_owner_changed_trigger after update on public.teams
for each row when(new.ownership_revision is distinct from old.ownership_revision)
execute function public.organization_owner_changed();

create or replace function public.is_organization_owner(p_team_id uuid,p_actor uuid default auth.uid()) returns boolean
language sql stable security definer set search_path=public as $$
 select p_actor is not null and exists(select 1 from public.teams t where t.id=p_team_id and t.dissolved_at is null and t.ultimate_owner_user_id=p_actor);
$$;
create function public.organization_can_spend(p_team_id uuid,p_actor uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select p_actor is not null and exists(select 1 from public.teams t where t.id=p_team_id and t.dissolved_at is null
   and (t.ultimate_owner_user_id=p_actor or t.leader_id=p_actor));
$$;
revoke all on function public.organization_can_spend(uuid,uuid) from public,anon;
grant execute on function public.organization_can_spend(uuid,uuid) to authenticated,service_role;

create or replace function public.can_manage_organization_contracts(p_team_id uuid,p_actor uuid default auth.uid()) returns boolean
language sql stable security definer set search_path=public as $$
 select p_actor is not null and exists(select 1 from public.teams t where t.id=p_team_id and t.dissolved_at is null and (
   t.ultimate_owner_user_id=p_actor or t.leader_id=p_actor or exists(
     select 1 from public.organization_contract_access a join public.team_members m on m.team_id=a.team_id and m.user_id=a.user_id
     where a.team_id=p_team_id and a.user_id=p_actor)));
$$;

-- Extend the already checked owner RPCs and financial operation to the root
-- owner without duplicating their transactions or changing wallet rules.
do $$
declare signature text; definition text; updated text;
begin
 foreach signature in array array['public.organization_owner_set_leader(uuid,uuid,boolean)','public.organization_owner_set_contract_access(uuid,uuid,boolean)'] loop
   definition:=pg_get_functiondef(signature::regprocedure);
   updated:=replace(definition,'organization.owner_user_id is distinct from auth.uid()','not public.is_organization_owner(p_team_id,auth.uid())');
   updated:=replace(updated,'p_user_id = organization.owner_user_id','p_user_id = organization.ultimate_owner_user_id');
   if updated=definition then raise exception 'Не найдена ожидаемая проверка владельца: %',signature;end if;
   execute updated;
 end loop;
 definition:=pg_get_functiondef('public.u6_coin_action(uuid,uuid,text,jsonb)'::regprocedure);
 updated:=replace(definition,'organization.owner_user_id=p_actor','organization.ultimate_owner_user_id=p_actor');
 if updated=definition then raise exception 'Не найдена ожидаемая проверка владельца кошелька';end if;
 execute updated;
end $$;
commit;
