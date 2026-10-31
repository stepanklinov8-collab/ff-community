-- Roster/leader changes cannot race a reviewed sale snapshot. Acquire the
-- existing wallet lock before row locks, including the older owner RPCs.
begin;
create function public.market_write_barrier() returns trigger language plpgsql set search_path=public as $$
begin perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));return null;end $$;
create trigger market_roster_write_barrier before insert or delete or update of team_id,user_id,role_in_team on public.team_members
 for each statement execute function public.market_write_barrier();
create trigger market_organization_write_barrier before update of owner_user_id,owner_team_id,leader_id,dissolved_at,type on public.teams
 for each statement execute function public.market_write_barrier();
create trigger market_delegate_write_barrier before insert or update or delete on public.organization_contract_access
 for each statement execute function public.market_write_barrier();
do $$declare signature text;definition text;begin
 foreach signature in array array['public.organization_owner_set_leader(uuid,uuid,boolean)','public.organization_owner_set_contract_access(uuid,uuid,boolean)','public.leave_organization(uuid)','public.transfer_team_leadership(uuid,uuid)'] loop
  if to_regprocedure(signature) is null then continue;end if;
  definition:=pg_get_functiondef(signature::regprocedure);
  if position('main-coin-wallets' in definition)=0 then
    if position(E'begin\n' in replace(definition,E'\r\n',E'\n'))=0 then raise exception 'MARKET_LOCK_ORDER_PATCH';end if;
    definition:=replace(definition,E'\r\n',E'\n');
    -- Only the outer BEGIN, not exception/subtransaction blocks.
    definition:=overlay(definition placing E'begin\n  perform pg_advisory_xact_lock(hashtextextended(''main-coin-wallets'',0));\n' from position(E'begin\n' in definition) for length(E'begin\n'));
    execute definition;
  end if;
 end loop;
end $$;
create function public.market_lock_tree(p_organization uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 perform 1 from public.teams where id in(with recursive tree as(select id from public.teams where id=p_organization union all select t.id from public.teams t join tree p on t.owner_team_id=p.id) select id from tree) order by id for update;
end $$;
do $$declare definition text;needle text;begin
 definition:=pg_get_functiondef('public.market_mutate(uuid,jsonb)'::regprocedure);
 needle:='perform public.market_assert_current(d,v);bundle:=public.market_bundle(asset.id);';
 if position(needle in definition)=0 then raise exception 'MARKET_TREE_LOCK_PATCH';end if;
 definition:=replace(definition,needle,'perform public.market_lock_tree(asset.id); '||needle);
 needle:='select * into strict execution from public.market_executions where deal_id=d.id and revision=v.revision;';
 if position(needle in definition)=0 then raise exception 'MARKET_REVERSE_LOCK_PATCH';end if;
 execute replace(definition,needle,needle||' perform public.market_lock_tree(asset.id);');
end $$;
revoke all on function public.market_write_barrier(),public.market_lock_tree(uuid) from public,anon,authenticated,service_role;
commit;
