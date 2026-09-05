-- Security hardening and immutable audit helpers for the competitive economy.
begin;

revoke all on public.betting_markets from anon, authenticated;
revoke all on public.currency_ledger from anon;
revoke all on public.site_wallets from anon;
revoke all on public.site_bets from anon;

create or replace function public.audit_organization_history()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if row(old.*) is distinct from row(new.*) then
  if nullif(trim(coalesce(new.correction_note,'')),'') is null then
   raise exception 'Correction note is required';
  end if;
  insert into public.organization_history_change_logs(history_id,changed_by,before_values,after_values,note)
  values(old.id,coalesce(auth.uid(),new.recorded_by,old.recorded_by),to_jsonb(old),to_jsonb(new),new.correction_note);
 end if;
 return new;
end $$;
drop trigger if exists audit_organization_history_trigger on public.organization_participation_history;
create trigger audit_organization_history_trigger before update on public.organization_participation_history
for each row execute function public.audit_organization_history();

create or replace function public.void_game_markets_on_material_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare market_id uuid;
begin
 if tg_op='DELETE' or old.map_name is distinct from new.map_name
    or old.game_number is distinct from new.game_number then
  for market_id in select id from public.betting_markets
   where game_id=old.id and status in('open','locked')
  loop
   perform public.settle_betting_market(market_id,'void',auth.uid());
  end loop;
 end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
drop trigger if exists void_game_markets_trigger on public.event_games;
create trigger void_game_markets_trigger before update or delete on public.event_games
for each row execute function public.void_game_markets_on_material_change();

create or replace function public.apply_reputation_review(p_review_id uuid,p_actor uuid,p_approve boolean)
returns void language plpgsql security definer set search_path=public as $$
declare review_row public.reputation_reviews%rowtype; reputation numeric; delta_value numeric;
begin
 select * into review_row from public.reputation_reviews where id=p_review_id for update;
 if review_row.id is null or review_row.status<>'pending' then raise exception 'Review is already processed'; end if;
 update public.reputation_reviews set status=case when p_approve then 'approved' else 'rejected' end,
  reviewed_by=p_actor,reviewed_at=now() where id=p_review_id;
 if p_approve then
  delta_value:=case when review_row.sentiment=1 then 1 else -2 end;
  update public.profiles set reputation_score=greatest(1,least(100,reputation_score+delta_value)),
   reputation_events_count=reputation_events_count+1 where id=review_row.target_user_id
   returning reputation_score into reputation;
  insert into public.reputation_ledger(user_id,delta,reason,source_type,source_id,changed_by)
  values(review_row.target_user_id,delta_value,
   coalesce(nullif(review_row.reason,''),case when delta_value>0 then 'Положительный отзыв' else 'Подтверждённый отрицательный отзыв' end),
   'review',review_row.id,p_actor);
 end if;
end $$;
revoke all on function public.apply_reputation_review(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.apply_reputation_review(uuid,uuid,boolean) to service_role;

commit;
