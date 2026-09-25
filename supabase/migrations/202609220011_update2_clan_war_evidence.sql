begin;
alter table public.clan_war_games add column replayed boolean not null default false;
create table public.clan_war_evidence(
 id uuid primary key default gen_random_uuid(),clan_war_id uuid not null references public.clan_wars(id),game_id uuid not null references public.clan_war_games(id),
 storage_path text not null unique,original_name text not null,mime_type text not null,uploaded_by uuid not null references auth.users(id),created_at timestamptz not null default now());
alter table public.clan_war_evidence enable row level security;
revoke all on public.clan_war_evidence from public,anon,authenticated;
grant all on public.clan_war_evidence to service_role;
create or replace function public.u2_war_evidence(p_actor uuid,p_session uuid,p_game uuid,p_action text,p_files jsonb default '[]',p_evidence uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare item jsonb;paths jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('evidence:'||p_game,0));
 perform public.u2_war_role(p_actor,p_session);
 if not exists(select 1 from public.clan_war_games where id=p_game and clan_war_id=p_session) then raise exception 'Игра не найдена';end if;
 if p_action='add' then
 if jsonb_array_length(p_files)<1 or jsonb_array_length(p_files)+(select count(*) from public.clan_war_evidence where game_id=p_game)>10 then raise exception 'На игру допускается не более 10 скриншотов';end if;
 for item in select value from jsonb_array_elements(p_files) loop
 if item->>'mimeType' not in('image/jpeg','image/png') or item->>'path' not like p_session||'/'||p_game||'/%' then raise exception 'Неверный файл доказательства';end if;
 insert into public.clan_war_evidence(clan_war_id,game_id,storage_path,original_name,mime_type,uploaded_by)
 values(p_session,p_game,item->>'path',left(item->>'name',200),item->>'mimeType',p_actor);
 end loop;
 elsif p_action in('remove','replay') then
 insert into public.competition_storage_cleanup(storage_path) select storage_path from public.clan_war_evidence where game_id=p_game and (p_action='replay' or id=p_evidence) on conflict do nothing;
 select coalesce(jsonb_agg(storage_path),'[]') into paths from public.clan_war_evidence where game_id=p_game and (p_action='replay' or id=p_evidence);
 delete from public.clan_war_evidence where game_id=p_game and (p_action='replay' or id=p_evidence);
 if p_action='replay' then update public.clan_war_games set replayed=true where id=p_game;end if;
 else raise exception 'Неизвестное действие';end if;
 insert into public.competition_action_log(actor_id,scope_id,action) values(p_actor,p_game,'evidence_'||p_action);
 return jsonb_build_object('success',true,'removedPaths',coalesce(paths,'[]'));
end $$;
revoke all on function public.u2_war_evidence(uuid,uuid,uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.u2_war_evidence(uuid,uuid,uuid,text,jsonb,uuid) to service_role;
commit;
