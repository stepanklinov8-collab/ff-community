begin;
alter table public.profiles add column if not exists legacy_game_rating numeric;
update public.profiles set legacy_game_rating=main_rating where legacy_game_rating is null;
create or replace function public.u2_editor_role(p_actor uuid,p_session uuid,p_check_window boolean default true)
returns text language plpgsql security definer set search_path=public as $$
declare s public.event_sessions%rowtype; e public.events%rowtype; published_at timestamptz; r text;
begin
 select * into s from public.event_sessions where id=p_session;
 select * into e from public.events where id=s.event_id;
 if s.id is null then raise exception 'Сессия не найдена'; end if;
 if public.is_full_admin(p_actor) then return 'admin'; end if;
 if e.frozen_at is not null or e.cancelled_at is not null or e.moderation_status<>'approved' then raise exception 'Мероприятие недоступно для изменений'; end if;
 r:=case when e.organizer_user_id=p_actor then 'organizer' when s.responsible_user_id=p_actor then 'responsible' else 'none' end;
 if r='none' then raise exception 'Нет прав на эту сессию'; end if;
 select first_published_at into published_at from public.competition_publications where session_id=p_session;
 if p_check_window and published_at is not null and now()>=published_at+(case when r='organizer' then interval '7 days' else interval '15 minutes' end) then
 raise exception 'Срок исправления результатов истёк'; end if;
 return r;
end $$;

create or replace function public.u2_notify_target(p_type text,p_target uuid,p_key text,p_title text,p_body text,p_link text)
returns void language plpgsql security definer set search_path=public as $$
begin
 insert into public.competition_notification_outbox(dedupe_key,user_id,title,body,link)
 select p_key||':'||u.id,u.id,p_title,p_body,p_link from (
 select p_target id where p_type='player' union select user_id from public.team_members where team_id=p_target and p_type='team'
 ) u on conflict(dedupe_key) do nothing;
end $$;

create or replace function public.recalculate_player_rating(p_user_id uuid)
returns numeric language plpgsql security definer set search_path=public as $$
declare w numeric; k numeric; l numeric; v numeric; g numeric; r numeric; rep numeric; q numeric; n integer; wins_count integer; kills_count integer;
begin
 select coalesce(sum(x.weight),0),coalesce(sum(x.weight*x.kills),0),coalesce(sum(x.weight*(x.field_size-x.place)/(x.field_size-1)),0),
 coalesce(sum(x.weight*case when x.place=1 then 1 else 0 end),0),count(*),count(*) filter(where place=1),coalesce(sum(kills),0)
 into w,k,l,v,n,wins_count,kills_count from (
 select f.*,coalesce(rs.hidden_coefficient,case when f.mode='training' then .20 else 1 end) weight
 from public.competition_player_facts f join public.event_sessions s on s.id=f.session_id join public.events e on e.id=s.event_id
 left join public.rating_event_settings rs on rs.event_id=s.event_id
 where f.user_id=p_user_id and f.mode in('tournament','training') and f.field_size>=2 and f.place between 1 and f.field_size and coalesce((e.competition_rules->>'ratingEnabled')::boolean,true)
 ) x;
 select reputation_score into rep from public.profiles where id=p_user_id;
 if w>0 then g:=greatest(1,least(100,1+99*least(1,w/12)*(.50*least(1,k/w/8.25)+.35*l/w+.15*v/w)));
 else select coalesce(legacy_game_rating,1) into g from public.profiles where id=p_user_id; end if;
 q:=case when rep<=50 then (rep-50)/49 else (rep-50)/50 end;
 r:=greatest(1,least(100,g*(1+.03*q)));
 select count(*),count(*) filter(where place=1),coalesce(sum(kills),0) into n,wins_count,kills_count from public.competition_player_facts where user_id=p_user_id and mode in('tournament','training');
 insert into public.competition_ratings(target_type,target_id,mode,exact_rating,display_rating,wins,games,kills)
 values('player',p_user_id,'main',r,round(r,1),wins_count,n,kills_count)
 on conflict(target_type,target_id,mode) do update set exact_rating=excluded.exact_rating,display_rating=excluded.display_rating,
 wins=excluded.wins,games=excluded.games,kills=excluded.kills,updated_at=now();
 update public.profiles set main_rating=round(r,1) where id=p_user_id;
 return r;
end $$;

create or replace function public.recalculate_organization_rating(p_team_id uuid)
returns numeric language plpgsql security definer set search_path=public as $$
declare players numeric; results numeric; achievements numeric; rep numeric; rating numeric; wins_count integer; n integer; kills_count integer;
begin
 select coalesce(avg(value),1) into players from (
 select coalesce(r.exact_rating,p.main_rating) value from public.team_members tm join public.profiles p on p.id=tm.user_id
 left join public.competition_ratings r on r.target_type='player' and r.target_id=p.id and r.mode='main'
 where tm.team_id=p_team_id order by value desc limit 4) best;
 select results_score,achievements_score,reputation_score into results,achievements,rep from public.teams where id=p_team_id;
 rating:=greatest(1,least(100,.98*(.60*players+.30*coalesce(results,1)+.10*coalesce(achievements,1))+.02*coalesce(rep,50)));
 select count(*) filter(where place=1 and played),count(*) filter(where played),coalesce(sum(kills),0) into wins_count,n,kills_count
 from public.competition_team_facts where team_id=p_team_id and mode in('tournament','training');
 insert into public.competition_ratings(target_type,target_id,mode,exact_rating,display_rating,wins,games,kills)
 values('team',p_team_id,'main',rating,round(rating,1),wins_count,n,kills_count)
 on conflict(target_type,target_id,mode) do update set exact_rating=excluded.exact_rating,display_rating=excluded.display_rating,
 wins=excluded.wins,games=excluded.games,kills=excluded.kills,updated_at=now();
 update public.teams set main_rating=round(rating,1) where id=p_team_id;
 return rating;
end $$;

create or replace function public.u2_recalculate_solo(p_user uuid) returns void
language plpgsql security definer set search_path=public as $$
declare w numeric; score numeric; r numeric; n integer; victories integer; total_kills integer;
begin
 select coalesce(sum(weight),0),coalesce(sum(weight*(participants-place)/(participants-1)),0) into w,score from (
 select c.*,coalesce(rs.hidden_coefficient,case when e.type='training' then .20 else .70 end) weight
 from public.competition_solo_contributions c join public.event_sessions s on s.id=c.session_id join public.events e on e.id=s.event_id
 left join public.rating_event_settings rs on rs.event_id=e.id
 where c.user_id=p_user and c.participants>=2 and coalesce((e.competition_rules->>'ratingEnabled')::boolean,true)) x;
 r:=case when w>0 then greatest(1,least(100,1+99*least(1,w/5)*score/w)) else 1 end;
 select count(*),count(*) filter(where place=1),coalesce(sum(kills),0) into n,victories,total_kills from public.competition_player_facts where user_id=p_user and mode='solo';
 insert into public.competition_ratings(target_type,target_id,mode,exact_rating,display_rating,wins,games,kills)
 values('player',p_user,'solo',r,round(r,1),victories,n,total_kills)
 on conflict(target_type,target_id,mode) do update set exact_rating=excluded.exact_rating,display_rating=excluded.display_rating,
 wins=excluded.wins,games=excluded.games,kills=excluded.kills,updated_at=now();
end $$;

create or replace function public.u2_recalculate_reputation(p_type text,p_target uuid) returns void
language plpgsql security definer set search_path=public as $$
declare deductions numeric; base numeric; rep numeric; organization uuid;
begin
 select coalesce(sum(w.penalty),0) into deductions from public.warnings w
 left join public.competition_sanctions s on s.id=w.used_in_sanction
 where w.update2 and w.target_type=p_type and w.target_id=p_target and w.activated_at is not null and w.cancelled_at is null
 and ((w.used_in_sanction is null and (w.expires_at is null or w.expires_at>now()))
 or (w.used_in_sanction is not null and s.lifted_at is null and (s.ends_at is null or s.ends_at>now())));
 if p_type='player' then
 select reputation_base into base from public.profiles where id=p_target;
 rep:=round(greatest(1,least(100,base-deductions)));
 update public.profiles set reputation_score=rep where id=p_target;
 perform public.recalculate_player_rating(p_target);
 for organization in select team_id from public.team_members where user_id=p_target loop perform public.recalculate_organization_rating(organization); end loop;
 else
 select reputation_base into base from public.teams where id=p_target;
 update public.teams set reputation_score=round(greatest(1,least(100,base-deductions))) where id=p_target;
 perform public.recalculate_organization_rating(p_target);
 end if;
end $$;

-- Lock wallets before markets in callers that settle many markets. Reverse the prior
-- payout and apply the new payout without touching stake or accepted odds.
create or replace function public.settle_betting_market(p_market_id uuid,p_outcome text,p_actor uuid)
returns void language plpgsql security definer set search_path=public as $$
declare m public.betting_markets%rowtype; b public.site_bets%rowtype; target_payout bigint; new_balance bigint;
begin
 if p_outcome not in('won','lost','void') then raise exception 'Unsupported outcome'; end if;
 perform pg_advisory_xact_lock(hashtextextended('competition-finance',0));
 select * into m from public.betting_markets where id=p_market_id for update;
 if m.id is null then raise exception 'Market not found'; end if;
 if m.outcome=p_outcome and m.status in('settled','void') then return; end if;
 for b in select * from public.site_bets where market_id=p_market_id order by user_id,id for update loop
 target_payout:=case p_outcome when 'won' then b.potential_payout when 'void' then b.stake else 0 end;
 if target_payout<>b.payout then
 if b.payout<>0 then
 update public.site_wallets set balance=balance-b.payout,updated_at=now() where user_id=b.user_id returning balance into new_balance;
 if not found then raise exception 'Wallet not found'; end if;
 insert into public.currency_ledger(user_id,amount,balance_after,operation_type,reference_type,reference_id,description)
 values(b.user_id,-b.payout,new_balance,'correction','bet',b.id,'Отмена прежней выплаты при исправлении результата');
 end if;
 if target_payout<>0 then
 update public.site_wallets set balance=balance+target_payout,updated_at=now() where user_id=b.user_id returning balance into new_balance;
 if not found then raise exception 'Wallet not found'; end if;
 insert into public.currency_ledger(user_id,amount,balance_after,operation_type,reference_type,reference_id,description)
 values(b.user_id,target_payout,new_balance,case when p_outcome='void' then 'refund' else 'payout' end,'bet',b.id,'Расчёт по действующему результату');
 end if;
 end if;
 update public.site_bets set payout=target_payout,status=case p_outcome when 'won' then 'won' when 'void' then 'refunded' else 'lost' end,settled_at=now() where id=b.id;
 end loop;
 update public.betting_markets set status=case when p_outcome='void' then 'void' else 'settled' end,
 outcome=p_outcome,settled_by=p_actor,settled_at=now(),updated_at=now() where id=p_market_id;
end $$;

create or replace function public.u2_flush_notifications() returns integer
language plpgsql security definer set search_path=public as $$
declare item record; processed integer:=0;
begin
 for item in select * from public.competition_notification_outbox where delivered_at is null order by created_at limit 500 for update skip locked loop
 insert into public.notifications(id,user_id,type,title,body,link) values(item.id,item.user_id,'system',item.title,item.body,item.link) on conflict(id) do nothing;
 update public.competition_notification_outbox set delivered_at=now() where id=item.id;
 processed:=processed+1;
 end loop; return processed;
end $$;

do $$ declare f record; begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname like 'u2\_%' escape '\' loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
commit;
