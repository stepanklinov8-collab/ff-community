begin;

-- Training events now use 1. Tournament entries matching legacy defaults
-- move to 1.2; explicitly customized tournament weights remain intact.
update public.rating_event_settings rs
set hidden_coefficient=1,updated_at=now()
from public.events e
where e.id=rs.event_id and e.type='training';

update public.rating_event_settings rs
set hidden_coefficient=1.2,updated_at=now()
from public.events e
where e.id=rs.event_id and e.type='tournament'
  and rs.hidden_coefficient in(.2,.7,.85,1,1.2);

insert into public.rating_event_settings(event_id,category,hidden_coefficient,changed_by,updated_at)
select e.id,case when e.type='training' then 'training' else 'amateur' end,
  case when e.type='training' then 1 else 1.2 end,null,now()
from public.events e
where e.type in('training','tournament')
on conflict(event_id) do nothing;

create or replace function public.u4_sync_event_rating_weight()
returns trigger language plpgsql security definer set search_path=public as $$
declare category_value text;coefficient_value numeric;
begin
 if new.type not in('training','tournament') then return new;end if;
 category_value:=case when new.type='training' then 'training' else 'amateur' end;
 coefficient_value:=case when new.type='training' then 1 else 1.2 end;
 if tg_op='INSERT' then
  insert into public.rating_event_settings(event_id,category,hidden_coefficient,changed_by,updated_at)
  values(new.id,category_value,coefficient_value,null,now()) on conflict(event_id) do nothing;
 elsif old.type is distinct from new.type then
  insert into public.rating_event_settings(event_id,category,hidden_coefficient,changed_by,updated_at)
  values(new.id,category_value,coefficient_value,null,now())
  on conflict(event_id) do update set category=excluded.category,
    hidden_coefficient=excluded.hidden_coefficient,changed_by=null,updated_at=now();
 end if;
 return new;
end $$;

drop trigger if exists u4_sync_event_rating_weight_insert on public.events;
create trigger u4_sync_event_rating_weight_insert after insert on public.events
for each row execute function public.u4_sync_event_rating_weight();
drop trigger if exists u4_sync_event_rating_weight_type on public.events;
create trigger u4_sync_event_rating_weight_type after update of type on public.events
for each row execute function public.u4_sync_event_rating_weight();

create or replace function public.u2_rating_settings(p_actor uuid,p_event uuid,p_category text,p_coefficient numeric default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare coefficient numeric;previous public.rating_event_settings%rowtype;event_type text;
 player_id uuid;team_id_value uuid;player_count integer:=0;
begin
 perform pg_advisory_xact_lock(hashtextextended('competition-publication',0));
 if not public.is_full_admin(p_actor) then raise exception 'Требуются права администратора';end if;
 select type into event_type from public.events where id=p_event and type in('tournament','training','solo');
 if event_type is null then raise exception 'Мероприятие не найдено или использует отдельный рейтинг';end if;
 if p_category not in('training','amateur','regional','official','season_final') then raise exception 'Проверьте категорию';end if;
 if p_coefficient is not null and (not public.is_owner(p_actor) or p_coefficient not between .01 and 5) then raise exception 'Числовой коэффициент задаёт только владелец';end if;
 select * into previous from public.rating_event_settings where event_id=p_event for update;
 coefficient:=coalesce(p_coefficient,case when previous.category=p_category then previous.hidden_coefficient end,
  case event_type when 'training' then 1 when 'tournament' then 1.2
   else case p_category when 'training' then .2 when 'amateur' then .7 when 'regional' then .85 when 'season_final' then 1.2 else 1 end end);
 insert into public.rating_event_settings(event_id,category,hidden_coefficient,changed_by,updated_at)
 values(p_event,p_category,coefficient,p_actor,now())
 on conflict(event_id) do update set category=excluded.category,hidden_coefficient=excluded.hidden_coefficient,
  changed_by=excluded.changed_by,updated_at=excluded.updated_at;
 for player_id in
  select distinct f.user_id from public.competition_player_facts f
   join public.event_sessions s on s.id=f.session_id where s.event_id=p_event
  union select distinct c.user_id from public.competition_solo_contributions c
   join public.event_sessions s on s.id=c.session_id where s.event_id=p_event
  union select distinct user_id from public.player_stats where event_id=p_event and status='approved'
 loop
  perform public.recalculate_player_rating(player_id);
  perform public.u2_recalculate_solo(player_id);
  player_count:=player_count+1;
  for team_id_value in select team_id from public.team_members where user_id=player_id loop
   perform public.recalculate_organization_rating(team_id_value);
  end loop;
 end loop;
 for team_id_value in select distinct organization_id from public.organization_participation_history where event_id=p_event loop
  perform public.recalculate_organization_results(team_id_value);
 end loop;
 for team_id_value in
  select distinct tf.team_id from public.competition_team_facts tf
  join public.event_sessions s on s.id=tf.session_id
  where s.event_id=p_event and tf.played and tf.mode in('training','tournament')
 loop
  perform public.recalculate_organization_rating(team_id_value);
 end loop;
 insert into public.competition_action_log(actor_id,scope_id,action,metadata)
 values(p_actor,p_event,'rating_category',jsonb_build_object('category',p_category,'players',player_count,'coefficient',coefficient));
 return jsonb_build_object('success',true,'players',player_count,'coefficient',coefficient);
end $$;

do $$ declare player_id uuid;team_id_value uuid;begin
 for player_id in select id from public.profiles loop
  perform public.recalculate_player_rating(player_id);
 end loop;
 for team_id_value in select id from public.teams loop
  perform public.recalculate_organization_rating(team_id_value);
 end loop;
end $$;

revoke all on function public.u4_sync_event_rating_weight() from public,anon,authenticated;
revoke all on function public.u2_rating_settings(uuid,uuid,text,numeric) from public,anon,authenticated;
grant execute on function public.u2_rating_settings(uuid,uuid,text,numeric) to service_role;

commit;
