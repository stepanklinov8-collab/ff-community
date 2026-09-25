begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('competition-evidence','competition-evidence',false,10485760,array['image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create table public.competition_storage_cleanup(storage_path text primary key,created_at timestamptz not null default now());
alter table public.competition_storage_cleanup enable row level security;
revoke all on public.competition_storage_cleanup from public,anon,authenticated;
grant all on public.competition_storage_cleanup to service_role;
create or replace function public.u2_evidence(p_actor uuid,p_session uuid,p_game uuid,p_action text,p_files jsonb default '[]',p_evidence uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare item jsonb;paths jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('evidence:'||p_game,0));
 perform public.u2_editor_role(p_actor,p_session);
 if not exists(select 1 from public.event_games where id=p_game and session_id=p_session and status<>'cancelled') then raise exception 'Игра не найдена';end if;
 if p_action='add' then
 if jsonb_array_length(p_files)<1 or jsonb_array_length(p_files)+(select count(*) from public.competition_evidence where game_id=p_game)>10 then raise exception 'На игру допускается не более 10 скриншотов';end if;
 for item in select value from jsonb_array_elements(p_files) loop
 if item->>'mimeType' not in('image/jpeg','image/png') or item->>'path' not like p_session||'/'||p_game||'/%' then raise exception 'Неверный файл доказательства';end if;
 insert into public.competition_evidence(session_id,game_id,storage_path,original_name,mime_type,uploaded_by)
 values(p_session,p_game,item->>'path',left(item->>'name',200),item->>'mimeType',p_actor);
 end loop;
 elsif p_action in('remove','replay') then
 insert into public.competition_storage_cleanup(storage_path) select storage_path from public.competition_evidence where game_id=p_game and (p_action='replay' or id=p_evidence) on conflict do nothing;
 select coalesce(jsonb_agg(storage_path),'[]') into paths from public.competition_evidence where game_id=p_game and (p_action='replay' or id=p_evidence);
 delete from public.competition_evidence where game_id=p_game and (p_action='replay' or id=p_evidence);
 if p_action='replay' then update public.event_games set replayed=true where id=p_game;end if;
 else raise exception 'Неизвестное действие';end if;
 insert into public.competition_action_log(actor_id,scope_id,action) values(p_actor,p_game,'evidence_'||p_action);
 return jsonb_build_object('success',true,'removedPaths',coalesce(paths,'[]'));
end $$;
revoke all on function public.u2_evidence(uuid,uuid,uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.u2_evidence(uuid,uuid,uuid,text,jsonb,uuid) to service_role;
commit;
