begin;

alter table public.event_sessions add column betting_enabled boolean not null default false;

-- Preserve the availability of existing sessions. New sessions require explicit enabling.
update public.event_sessions s set betting_enabled=b.enabled
from public.betting_sources b where b.event_id=s.event_id;

-- Legacy session policies also allow moderators to edit sessions; betting remains admin-only.
create or replace function public.u2_guard_session_betting() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if ((tg_op='INSERT' and new.betting_enabled) or (tg_op='UPDATE' and new.betting_enabled is distinct from old.betting_enabled))
    and auth.uid() is not null and not public.is_full_admin(auth.uid()) then
    raise exception 'Недостаточно прав для управления ставками';
  end if;
  return new;
end;
$$;
create trigger u2_guard_session_betting before insert or update of betting_enabled on public.event_sessions
for each row execute function public.u2_guard_session_betting();

create or replace function public.u2_set_session_betting(p_actor uuid,p_event uuid,p_session uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path=public as $$
declare s public.event_sessions%rowtype; e public.events%rowtype;
begin
  if p_actor is null or not exists(select 1 from public.user_roles where user_id=p_actor and role in('admin','superadmin')) then
    raise exception 'Недостаточно прав';
  end if;
  if p_enabled is null then raise exception 'Укажите состояние ставок'; end if;
  -- Serialize toggles with bet confirmation and result publication.
  perform pg_advisory_xact_lock(hashtextextended('competition-publication',0));
  select * into s from public.event_sessions where id=p_session and event_id=p_event for update;
  if s.id is null then raise exception 'Сессия не найдена в этом мероприятии'; end if;
  select * into e from public.events where id=p_event for update;
  if p_enabled then
    if e.type not in('tournament','training','solo','bo','kv') then raise exception 'Этот тип мероприятия не поддерживает ставки'; end if;
    if not (coalesce(e.is_published,false) or coalesce(e.publish_at<=now(),false))
      or e.moderation_status<>'approved' or e.frozen_at is not null or e.cancelled_at is not null then
      raise exception 'Мероприятие недоступно для ставок';
    end if;
    if s.start_time is null or s.start_time<=now() or s.status in('cancelled','completed')
      or exists(select 1 from public.competition_publications where session_id=s.id and first_published_at is not null) then
      raise exception 'Включить ставки можно только до начала выбранной сессии';
    end if;
    insert into public.betting_sources(event_id,enabled,enabled_by) values(e.id,true,p_actor)
      on conflict(event_id) where event_id is not null do update set enabled=true,enabled_by=p_actor,updated_at=now();
  end if;
  update public.event_sessions set betting_enabled=p_enabled where id=s.id;
  -- Only change unfinished markets of this session; accepted bets and payouts stay intact.
  update public.betting_markets m set status=case when p_enabled then 'open' else 'locked' end,
    locks_at=case when p_enabled then s.start_time else m.locks_at end,updated_at=now()
  where m.event_id=e.id and m.status=case when p_enabled then 'locked' else 'open' end
    and m.outcome is null and exists(select 1 from public.event_games g where g.id=m.game_id and g.session_id=s.id
      and (not p_enabled or g.status='scheduled'));
end;
$$;
revoke all on function public.u2_guard_session_betting(),public.u2_set_session_betting(uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.u2_set_session_betting(uuid,uuid,uuid,boolean) to service_role;

-- Enforce the session switch during atomic confirmation, including quotes created before disabling.
do $$
declare definition text; needle text := 'and session.status<>''cancelled''';
begin
  definition:=pg_get_functiondef('public.place_dynamic_site_bet_for(uuid,uuid,bigint)'::regprocedure);
  if position(needle in definition)=0 then raise exception 'Unexpected bet confirmation definition'; end if;
  definition:=replace(definition,needle,needle||' and session.betting_enabled and session.status<>''completed''');
  execute definition;
end;
$$;

commit;
