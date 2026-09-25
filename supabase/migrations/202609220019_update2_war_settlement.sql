begin;
create or replace function public.u2_round_market_outcome(p_results jsonb,p_team uuid,p_game uuid,p_market text,p_selection text,p_line numeric)
returns text language plpgsql immutable set search_path=public as $$
declare result_row jsonb;other_row jsonb;game_key uuid:=p_game;
begin
 -- Previously accepted single-game KV quotes did not store a game id. Preserve
 -- their round-score meaning; a 7:2 quote must never become a 1:0 series quote.
 if game_key is null and (select count(distinct x->>'gameId') from jsonb_array_elements(p_results->'rows') x)=1 then
 select (x->>'gameId')::uuid into game_key from jsonb_array_elements(p_results->'rows') x limit 1;end if;
 if game_key is not null then
 select x into result_row from jsonb_array_elements(p_results->'rows') x where (x->>'teamId')::uuid=p_team and (x->>'gameId')::uuid=game_key;
 select x into other_row from jsonb_array_elements(p_results->'rows') x where (x->>'teamId')::uuid<>p_team and (x->>'gameId')::uuid=game_key limit 1;
 if result_row is null or result_row->>'played'='false' and result_row->>'reason'='technical' then return 'void';end if;
 if p_market='exact_score' then
 if result_row->>'rounds' is null or other_row->>'rounds' is null then return 'void';end if;
 return case when p_selection=(result_row->>'rounds')||':'||(other_row->>'rounds') then 'won' else 'lost' end;end if;
 else
 if p_market='exact_score' then return 'void';end if;
 select x into result_row from jsonb_array_elements(p_results->'standings') x where (x->>'teamId')::uuid=p_team;
 if result_row is null then return 'void';end if;
 end if;
 return case when p_market='win' and result_row->>'place'='1' then 'won'
 when p_market='loss' and (result_row->>'place'='2' or result_row->>'played'='false' and result_row->>'reason'='no_show') then 'won'
 when p_market='kills_over' and (result_row->>'kills')::numeric>p_line then 'won'
 when p_market='kills_under' and (result_row->>'kills')::numeric<p_line then 'won' else 'lost' end;
end $$;
create or replace function public.u2_settle_war_results(p_actor uuid,p_war uuid,p_results jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare market record;
begin
 for market in select * from public.betting_markets where clan_war_id=p_war and status<>'draft' order by id loop
 perform public.settle_betting_market(market.id,public.u2_round_market_outcome(p_results,market.subject_team_id,market.clan_war_game_id,market.market_type,market.selection_value,market.line),p_actor);end loop;
end $$;
create or replace function public.u2_cancel_war(p_actor uuid,p_war uuid,p_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare w public.clan_wars%rowtype;market record;
begin
 perform pg_advisory_xact_lock(hashtextextended('competition-publication',0));
 select * into w from public.clan_wars where id=p_war for update;
 if w.id is null then raise exception 'КВ не найдено';end if;
 if not public.is_full_admin(p_actor) and not public.can_manage_team(w.creator_team_id,p_actor) and not public.can_manage_team(w.opponent_team_id,p_actor) then raise exception 'Недостаточно прав';end if;
 if w.status='cancelled' then return;end if;
 if w.result_first_published_at is not null or w.status not in('open','pending','agreed') then raise exception 'Сначала исправьте подтверждённые результаты КВ';end if;
 update public.clan_wars set status='cancelled',cancelled_at=now(),cancelled_by=p_actor,cancellation_reason=p_reason,configuration_revision=configuration_revision+1 where id=w.id;
 for market in select id from public.betting_markets where clan_war_id=w.id order by id loop perform public.settle_betting_market(market.id,'void',p_actor);end loop;
 perform public.u2_notify_target('team',w.creator_team_id,'war-cancel:'||w.id||':a','КВ отменено',w.title,'/clan-wars/'||w.id);
 if w.opponent_team_id is not null then perform public.u2_notify_target('team',w.opponent_team_id,'war-cancel:'||w.id||':b','КВ отменено',w.title,'/clan-wars/'||w.id);end if;
 insert into public.competition_action_log(actor_id,scope_id,action,metadata) values(p_actor,w.id,'war_cancel',jsonb_build_object('reason',p_reason));
end $$;
revoke all on function public.u2_round_market_outcome(jsonb,uuid,uuid,text,text,numeric),public.u2_settle_war_results(uuid,uuid,jsonb),public.u2_cancel_war(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.u2_cancel_war(uuid,uuid,text) to service_role;
commit;
