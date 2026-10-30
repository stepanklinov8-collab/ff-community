-- Whole-event completion evidence. It never moves money and never counts a
-- qualifying group as a separate completed tournament.
begin;
create function public.contract_tournament_completion(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare e public.events%rowtype;final_id uuid;active_count integer;final_count integer;session_ids jsonb;ending timestamptz;
begin
 select * into e from public.events where id=p_event;
 if not found then raise exception 'CONTRACT_EVENT';end if;
 if e.type<>'tournament' then return jsonb_build_object('ready',false,'reason','not_tournament');end if;
 if e.cancelled_at is not null then return jsonb_build_object('ready',true,'cancelled',true,'eventId',e.id);end if;
 select count(*),count(*) filter(where s.stage='final') into active_count,final_count from public.event_sessions s where s.event_id=e.id and s.status<>'cancelled';
 if active_count=0 then return jsonb_build_object('ready',false,'reason','no_active_sessions');end if;
 final_id:=e.final_session_id;
 if final_id is not null and not exists(select 1 from public.event_sessions s where s.id=final_id and s.event_id=e.id and s.status<>'cancelled') then
   return jsonb_build_object('ready',false,'reason','invalid_final_session');end if;
 if final_id is null then
   if final_count=1 then select id into final_id from public.event_sessions s where s.event_id=e.id and s.status<>'cancelled' and s.stage='final';
   elsif active_count=1 then select id into final_id from public.event_sessions s where s.event_id=e.id and s.status<>'cancelled' and s.stage='ordinary';end if;
   if final_id is null then return jsonb_build_object('ready',false,'reason','missing_final_session');end if;
 end if;
 if exists(select 1 from public.event_sessions s where s.event_id=e.id and s.status<>'cancelled' and(s.end_time is null or s.end_time<s.start_time)) then return jsonb_build_object('ready',false,'reason','invalid_session_end');end if;
 if exists(select 1 from public.event_sessions s where s.event_id=e.id and s.status<>'cancelled' and s.end_time>clock_timestamp()) then return jsonb_build_object('ready',false,'reason','sessions_not_finished');end if;
 if exists(select 1 from public.event_sessions s left join public.competition_publications cp on cp.session_id=s.id
   where s.event_id=e.id and s.status<>'cancelled' and(cp.first_published_at is null or cp.published is null)) then return jsonb_build_object('ready',false,'reason','unpublished_sessions');end if;
 select jsonb_agg(s.id order by s.id),max(s.end_time) into session_ids,ending from public.event_sessions s where s.event_id=e.id and s.status<>'cancelled';
 return jsonb_build_object('ready',true,'cancelled',false,'eventId',e.id,'finalSessionId',final_id,'sessionIds',session_ids,'endsAt',ending);
end $$;
revoke all on function public.contract_tournament_completion(uuid) from public,anon,authenticated,service_role;
commit;
