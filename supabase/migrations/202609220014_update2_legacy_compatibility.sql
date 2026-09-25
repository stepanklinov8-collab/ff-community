begin;
-- Canonical corrections retain the current result and a compact action record.
-- Legacy moderation keeps its pre-existing audit policy.
create or replace function public.audit_organization_history() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from public.competition_publications where session_id=new.session_id and first_published_at is not null)
 or exists(select 1 from public.clan_wars where id=new.clan_war_id and result_first_published_at is not null) then return new;end if;
 if row(old.*) is distinct from row(new.*) then
 if nullif(trim(coalesce(new.correction_note,'')),'') is null then raise exception 'Correction note is required';end if;
 insert into public.organization_history_change_logs(history_id,changed_by,before_values,after_values,note)
 values(old.id,coalesce(auth.uid(),new.recorded_by,old.recorded_by),to_jsonb(old),to_jsonb(new),new.correction_note);end if;
 return new;
end $$;

create or replace function public.apply_reputation_review(p_review_id uuid,p_actor uuid,p_approve boolean) returns void
language plpgsql security definer set search_path=public as $$
declare review_row public.reputation_reviews%rowtype;delta_value numeric;
begin
 if not public.is_full_admin(p_actor) then raise exception 'Требуются права администратора';end if;
 select * into review_row from public.reputation_reviews where id=p_review_id for update;
 if review_row.id is null or review_row.status<>'pending' then raise exception 'Отзыв уже рассмотрен или не найден';end if;
 update public.reputation_reviews set status=case when p_approve then 'approved' else 'rejected' end,reviewed_by=p_actor,reviewed_at=now() where id=p_review_id;
 if p_approve then
 delta_value:=case when review_row.sentiment=1 then 1 else -2 end;
 update public.profiles set reputation_base=greatest(1,least(100,reputation_base+delta_value)),reputation_events_count=reputation_events_count+1 where id=review_row.target_user_id;
 insert into public.reputation_ledger(user_id,delta,reason,source_type,source_id,changed_by)
 values(review_row.target_user_id,delta_value,coalesce(nullif(review_row.reason,''),case when delta_value>0 then 'Положительный отзыв' else 'Подтверждённый отрицательный отзыв' end),'review',review_row.id,p_actor);
 perform public.u2_recalculate_reputation('player',review_row.target_user_id);end if;
end $$;
revoke all on function public.apply_reputation_review(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.apply_reputation_review(uuid,uuid,boolean) to service_role;

create or replace function public.u2_legacy_stats_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from public.competition_publications p join public.event_sessions s on s.id=p.session_id
 where s.event_id=coalesce(new.event_id,old.event_id) and (coalesce(new.session_id,old.session_id) is null or p.session_id=coalesce(new.session_id,old.session_id)) and p.first_published_at is not null) then
 raise exception 'Результаты сессии уже опубликованы. Исправление выполняется целиком в редакторе результатов';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger u2_legacy_stats_guard before insert or update or delete on public.player_stats for each row execute function public.u2_legacy_stats_guard();
revoke all on function public.u2_legacy_stats_guard() from public,anon,authenticated;
commit;
