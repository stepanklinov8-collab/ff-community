begin;
-- Display order is not game identity. Only an actual cancellation/removal refunds
-- its markets; corrected results settle against the existing accepted odds.
create or replace function public.void_game_markets_on_material_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare market_id uuid;
begin
 if tg_op='DELETE' or (new.status='cancelled' and old.status is distinct from 'cancelled') then
  for market_id in select id from public.betting_markets where game_id=old.id order by id loop
   perform public.settle_betting_market(market_id,'void',auth.uid());
  end loop;
 end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
revoke all on function public.void_game_markets_on_material_change() from public,anon,authenticated;

create or replace function public.u2_qualification_configuration() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' or new.source_session_id is distinct from old.source_session_id or new.qualification is distinct from old.qualification then
  update public.competition_qualifications set needs_review=true where session_id=new.id;
  if new.source_session_id is not null then perform public.u2_refresh_qualifications(new.source_session_id);
  else delete from public.competition_qualifications where session_id=new.id;end if;
 end if;
 return new;
end $$;
create trigger u2_qualification_configuration after insert or update of source_session_id,qualification on public.event_sessions
for each row execute function public.u2_qualification_configuration();
revoke all on function public.u2_qualification_configuration() from public,anon,authenticated;
commit;
