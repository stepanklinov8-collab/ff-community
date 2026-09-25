begin;
alter table public.clan_wars add column room_code text,add column room_password text,add column room_note text not null default '',add column comments_closed boolean not null default false;
-- Private columns are added after the explicit public SELECT grants in migration 010.
alter table public.clan_war_games add column is_active boolean not null default true;
alter table public.clan_war_games drop constraint clan_war_games_clan_war_id_game_number_key;
create unique index clan_war_active_game_order on public.clan_war_games(clan_war_id,game_number) where is_active;
create or replace function public.u2_war_configuration(p_actor uuid,p_war uuid,p_revision integer,p_config jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare w public.clan_wars%rowtype;is_admin boolean:=public.is_full_admin(p_actor);creator uuid:=(p_config->>'creatorTeamId')::uuid;opponent uuid:=(p_config->>'opponentTeamId')::uuid;
 game_count_value integer:=(p_config->>'gameCount')::integer;wins integer:=(p_config->>'winsRequired')::integer;maps_value text[];material boolean;teams_changed boolean;market record;n integer;notice_id uuid:=gen_random_uuid();
begin
 perform pg_advisory_xact_lock(hashtextextended('competition-publication',0));
 select * into w from public.clan_wars where id=p_war for update;
 if w.id is null then raise exception 'КВ не найдено';end if;
 if not is_admin and not exists(select 1 from public.team_members where team_id=w.creator_team_id and user_id=p_actor and role_in_team in('leader','senior_deputy','deputy')) then raise exception 'Нет прав редактировать КВ';end if;
 if w.configuration_revision<>p_revision then raise exception 'Конфликт версии КВ';end if;
 if w.status='cancelled' then raise exception 'КВ отменено';end if;
 select array_agg(value order by ordinality) into maps_value from jsonb_array_elements_text(p_config->'maps') with ordinality;
 if game_count_value<1 or game_count_value>10000 or wins<1 or game_count_value<2*wins-1 or cardinality(maps_value)<>game_count_value
 or not maps_value<@array['bermuda','nexterra','solara','purgatory','kalahari']::text[] or (p_config->>'format')::integer not in(4,6)
 or length(trim(p_config->>'title')) not between 2 and 160 then raise exception 'Проверьте параметры КВ';end if;
 teams_changed:=row(w.creator_team_id,w.opponent_team_id,w.challenge_kind) is distinct from row(creator,opponent,p_config->>'challengeKind');
 if teams_changed then
 if w.status not in('open','pending') or exists(select 1 from public.clan_war_rosters where clan_war_id=w.id)
 or exists(select 1 from public.clan_war_responses where clan_war_id=w.id and status in('pending','accepted')) then raise exception 'Нельзя менять стороны после согласования, отклика или подачи состава';end if;
 if not is_admin and not exists(select 1 from public.team_members where team_id=creator and user_id=p_actor and role_in_team in('leader','senior_deputy','deputy')) then raise exception 'Нет прав на новую организацию';end if;
 if creator=opponent or p_config->>'challengeKind' not in('open','direct') or (p_config->>'challengeKind'='direct')<>(opponent is not null) then raise exception 'Проверьте стороны вызова';end if;
 if opponent is not null and not exists(select 1 from public.teams a join public.teams b on b.type=a.type where a.id=creator and b.id=opponent) then raise exception 'Организации должны быть одного типа';end if;
 end if;
 material:=teams_changed or row(w.format,w.game_count,w.wins_required,w.maps,w.scheduled_at,w.rules) is distinct from row((p_config->>'format')::integer,game_count_value,wins,maps_value,(p_config->>'scheduledAt')::timestamptz,p_config->>'rules');
 if material and w.result_first_published_at is not null then raise exception 'Нельзя менять формат, стороны, даты и правила подтверждённой серии; исправьте её результат в редакторе';end if;
 if material and not is_admin and w.scheduled_at<=now() then raise exception 'Начавшееся КВ изменяет администратор';end if;
 if w.format is distinct from (p_config->>'format')::integer then
 perform set_config('omcite.war_configuration',w.id::text,true);
 update public.clan_war_rosters set player_ids='{}' where clan_war_id=w.id;
 perform set_config('omcite.war_configuration','',true);
 end if;
 if material then
 update public.betting_quotes set expires_at=least(expires_at,now()) where clan_war_id=w.id and confirmed_at is null;
 -- Preserve all accepted odds and never reopen the markets invalidated by a changed agreement.
 for market in select id from public.betting_markets where clan_war_id=w.id order by id loop perform public.settle_betting_market(market.id,'void',p_actor);end loop;
 update public.clan_war_games set is_active=false where clan_war_id=w.id and is_active and game_number>game_count_value;
 for n in 1..game_count_value loop
 update public.clan_war_games set map_name=maps_value[n] where clan_war_id=w.id and is_active and game_number=n;
 if not found then insert into public.clan_war_games(clan_war_id,game_number,map_name) values(w.id,n,maps_value[n]);end if;
 end loop;
 end if;
 update public.clan_wars set title=p_config->>'title',description=p_config->>'description',rules=p_config->>'rules',format=(p_config->>'format')::integer,
 creator_team_id=creator,opponent_team_id=opponent,challenge_kind=p_config->>'challengeKind',scheduled_at=(p_config->>'scheduledAt')::timestamptz,
 game_count=game_count_value,wins_required=wins,maps=maps_value,configuration_revision=w.configuration_revision+1,
 room_code=nullif(p_config->>'roomCode',''),room_password=nullif(p_config->>'roomPassword',''),room_note=coalesce(p_config->>'roomNote',''),comments_closed=coalesce((p_config->>'commentsClosed')::boolean,false),
 status=case when teams_changed then case when p_config->>'challengeKind'='open' then 'open' else 'pending' end else status end,
 result_draft=case when material then null else result_draft end,result_candidate=case when material then null else result_candidate end,
 result_approval_a=case when material then null else result_approval_a end,result_approval_b=case when material then null else result_approval_b end,
 result_revision=result_revision+case when material then 1 else 0 end,updated_at=now() where id=w.id;
 if material or row(w.room_code,w.room_password,w.room_note) is distinct from row(nullif(p_config->>'roomCode',''),nullif(p_config->>'roomPassword',''),p_config->>'roomNote') then
 perform public.u2_notify_target('team',creator,'war-config:'||notice_id||':a','Изменены условия или комната КВ',p_config->>'title','/clan-wars/'||w.id);
 if opponent is not null then perform public.u2_notify_target('team',opponent,'war-config:'||notice_id||':b','Изменены условия или комната КВ',p_config->>'title','/clan-wars/'||w.id);end if;end if;
 insert into public.competition_action_log(actor_id,scope_id,action,revision) values(p_actor,w.id,'war_configuration',w.configuration_revision+1);
 return jsonb_build_object('success',true,'clanWarId',w.id,'revision',w.configuration_revision+1,'draftReset',material);
end $$;
create or replace function public.u2_war_comment_deadline(p_war uuid) returns timestamptz language sql stable security definer set search_path=public as $$
 select case when comments_closed or status='cancelled' then '-infinity'::timestamptz when result_first_published_at is not null then coalesce(result_corrected_at,result_first_published_at)+interval '24 hours' else coalesce(completed_at,scheduled_at,'infinity'::timestamptz)+interval '48 hours' end from public.clan_wars where id=p_war
$$;
create or replace function public.u2_war_comment_window() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='UPDATE' and new.is_deleted then return new;end if;
 if coalesce(public.u2_war_comment_deadline(new.clan_war_id),'-infinity')<=now() then raise exception 'Обсуждение КВ закрыто';end if;return new;
end $$;
create trigger u2_war_comment_window before insert or update on public.clan_war_comments for each row execute function public.u2_war_comment_window();
revoke all on function public.u2_war_configuration(uuid,uuid,integer,jsonb),public.u2_war_comment_deadline(uuid),public.u2_war_comment_window() from public,anon,authenticated;
grant execute on function public.u2_war_configuration(uuid,uuid,integer,jsonb),public.u2_war_comment_deadline(uuid) to service_role;
commit;
