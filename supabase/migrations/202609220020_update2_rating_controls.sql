begin;
create or replace function public.u2_rating_settings(p_actor uuid,p_event uuid,p_category text,p_coefficient numeric default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare coefficient numeric;previous public.rating_event_settings%rowtype;player_id uuid;team_id_value uuid;player_count integer:=0;
begin
 perform pg_advisory_xact_lock(hashtextextended('competition-publication',0));
 if not public.is_full_admin(p_actor) then raise exception 'Требуются права администратора';end if;
 if not exists(select 1 from public.events where id=p_event and type in('tournament','training','solo')) then raise exception 'Мероприятие не найдено или использует отдельный рейтинг';end if;
 if p_category not in('training','amateur','regional','official','season_final') then raise exception 'Проверьте категорию';end if;
 if p_coefficient is not null and (not public.is_owner(p_actor) or p_coefficient not between .01 and 5) then raise exception 'Числовой коэффициент задаёт только владелец';end if;
 select * into previous from public.rating_event_settings where event_id=p_event for update;
 coefficient:=coalesce(p_coefficient,case when previous.category=p_category then previous.hidden_coefficient end,
 case p_category when 'training' then .2 when 'amateur' then .7 when 'regional' then .85 when 'season_final' then 1.2 else 1 end);
 insert into public.rating_event_settings(event_id,category,hidden_coefficient,changed_by,updated_at) values(p_event,p_category,coefficient,p_actor,now())
 on conflict(event_id) do update set category=excluded.category,hidden_coefficient=excluded.hidden_coefficient,changed_by=excluded.changed_by,updated_at=excluded.updated_at;
 for player_id in select distinct f.user_id from public.competition_player_facts f join public.event_sessions s on s.id=f.session_id where s.event_id=p_event
 union select distinct c.user_id from public.competition_solo_contributions c join public.event_sessions s on s.id=c.session_id where s.event_id=p_event
 union select distinct user_id from public.player_stats where event_id=p_event and status='approved' loop
 perform public.recalculate_player_rating(player_id);perform public.u2_recalculate_solo(player_id);player_count:=player_count+1;
 for team_id_value in select team_id from public.team_members where user_id=player_id loop perform public.recalculate_organization_rating(team_id_value);end loop;
 end loop;
 for team_id_value in select distinct organization_id from public.organization_participation_history where event_id=p_event loop perform public.recalculate_organization_results(team_id_value);end loop;
 insert into public.competition_action_log(actor_id,scope_id,action,metadata) values(p_actor,p_event,'rating_category',jsonb_build_object('category',p_category,'players',player_count));
 return jsonb_build_object('success',true,'players',player_count);
end $$;
create or replace function public.u2_membership_rating() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op<>'DELETE' and exists(select 1 from public.teams where id=new.team_id) then perform public.recalculate_organization_rating(new.team_id);end if;
 if tg_op='DELETE' or tg_op='UPDATE' and old.team_id is distinct from new.team_id then
 if exists(select 1 from public.teams where id=old.team_id) then perform public.recalculate_organization_rating(old.team_id);end if;end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
create trigger u2_membership_rating after insert or update or delete on public.team_members for each row execute function public.u2_membership_rating();
revoke all on function public.u2_rating_settings(uuid,uuid,text,numeric),public.u2_membership_rating() from public,anon,authenticated;
grant execute on function public.u2_rating_settings(uuid,uuid,text,numeric) to service_role;
commit;
