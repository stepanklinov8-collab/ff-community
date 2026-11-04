begin;

-- Forecast wallets and ledgers stay separate. This changes their label only.
update public.economy_settings set currency_name='Arena Points' where singleton;

create table public.analytics_user_clock(
 user_id uuid primary key references public.profiles(id) on delete cascade,
 last_seen_at timestamptz not null default now(),
 last_active_at timestamptz
);
create table public.analytics_visits(
 id uuid primary key,user_id uuid not null references public.profiles(id) on delete cascade,
 started_at timestamptz not null default now(),last_seen_at timestamptz not null default now(),
 active_seconds integer not null default 0 check(active_seconds>=0),
 screen_kind text not null check(screen_kind in('mobile','desktop'))
);
create index analytics_visits_user_time on public.analytics_visits(user_id,started_at desc);
create index analytics_visits_time on public.analytics_visits(started_at desc);
create table public.analytics_page_views(
 id uuid primary key,visit_id uuid not null references public.analytics_visits(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 path text not null check(length(path) between 1 and 160 and path ~ '^/[a-zA-Z0-9_:/-]*$'),
 started_at timestamptz not null default now(),last_seen_at timestamptz not null default now(),
 active_seconds integer not null default 0 check(active_seconds>=0)
);
create index analytics_views_user_time on public.analytics_page_views(user_id,started_at desc);
create index analytics_views_visit on public.analytics_page_views(visit_id);

alter table public.analytics_user_clock enable row level security;
alter table public.analytics_visits enable row level security;
alter table public.analytics_page_views enable row level security;
revoke all on public.analytics_user_clock,public.analytics_visits,public.analytics_page_views from public,anon,authenticated;

create function public.analytics_touch(p_visit uuid,p_view uuid,p_path text,p_active boolean,p_screen text)
returns void language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid();clock_row analytics_user_clock%rowtype;v analytics_visits%rowtype;page analytics_page_views%rowtype;
 credit integer:=0;at_time timestamptz:=clock_timestamp();
begin
 if actor is null then raise exception 'AUTH_REQUIRED';end if;
 if p_visit is null or p_view is null or p_path is null or length(p_path)>160 or p_path !~ '^/[a-zA-Z0-9_:/-]*$'
 or p_screen is null or p_screen not in('mobile','desktop') or p_active is null then raise exception 'INVALID_ACTIVITY';end if;
 -- A single per-account clock prevents two tabs/devices counting the same time twice.
 insert into analytics_user_clock(user_id) values(actor) on conflict do nothing;
 select * into strict clock_row from analytics_user_clock where user_id=actor for update;
 select * into v from analytics_visits where id=p_visit;
 if v.id is not null and v.user_id<>actor then raise exception 'VISIT_OWNER';end if;
 select * into page from analytics_page_views where id=p_view;
 if page.id is not null and(page.user_id<>actor or page.visit_id<>p_visit or page.path<>p_path) then raise exception 'VIEW_OWNER';end if;
 if v.id is null then insert into analytics_visits(id,user_id,screen_kind,started_at,last_seen_at) values(p_visit,actor,p_screen,at_time,at_time);end if;
 if page.id is not null and page.last_seen_at>at_time-interval '10 seconds' then return;end if;
 if page.id is null and (select count(*) from analytics_page_views where user_id=actor and started_at>at_time-interval '1 minute')>=30 then return;end if;
 if p_active and page.id is not null and clock_row.last_active_at>=at_time-interval '70 seconds' then
 credit:=greatest(0,least(45,floor(extract(epoch from at_time-clock_row.last_active_at))::integer));end if;
 insert into analytics_page_views(id,visit_id,user_id,path,started_at,last_seen_at,active_seconds)
 values(p_view,p_visit,actor,p_path,at_time,at_time,credit)
 on conflict(id) do update set last_seen_at=excluded.last_seen_at,active_seconds=analytics_page_views.active_seconds+excluded.active_seconds;
 update analytics_visits set last_seen_at=at_time,active_seconds=active_seconds+credit where id=p_visit;
 update analytics_user_clock set last_seen_at=at_time,last_active_at=case when p_active then at_time else last_active_at end where user_id=actor;
end $$;

create function public.analytics_report(p_actor uuid,p_from timestamptz,p_to timestamptz,p_search text default '',p_offset integer default 0,p_user uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if not coalesce(public.is_full_admin(p_actor),false) then raise exception 'ADMIN_REQUIRED';end if;
 if p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '91 days' or p_offset<0 or p_offset>100000 then raise exception 'INVALID_PERIOD';end if;
 with activity as(
  select a.user_id,count(*)::int views,coalesce(sum(a.active_seconds),0)::bigint seconds,min(a.started_at) first_at,max(a.last_seen_at) last_at
  from analytics_page_views a where a.started_at>=p_from and a.started_at<p_to group by a.user_id
 ),matched as(
  select p.id,p.nickname,a.views,a.seconds,a.first_at,a.last_at,
  (select count(distinct v.id) from analytics_visits v join analytics_page_views pv on pv.visit_id=v.id where v.user_id=p.id and pv.started_at>=p_from and pv.started_at<p_to)::int visits,
  coalesce(c.last_active_at>now()-interval '70 seconds',false) online
  from activity a join profiles p on p.id=a.user_id left join analytics_user_clock c on c.user_id=p.id
  where coalesce(p.nickname,'') ilike '%'||left(coalesce(p_search,''),80)||'%'
 )select jsonb_build_object('summary',(select jsonb_build_object('users',count(*),'visits',coalesce(sum(visits),0),'views',coalesce(sum(views),0),'seconds',coalesce(sum(seconds),0),'online',count(*) filter(where online)) from matched),
 'items',coalesce((select jsonb_agg(x) from(select * from matched order by last_at desc,id limit 50 offset p_offset)x),'[]'::jsonb),
 'hasMore',(select count(*)>p_offset+50 from matched),
 'history',case when p_user is null then '[]'::jsonb else coalesce((select jsonb_agg(x) from(select a.path,a.started_at,a.last_seen_at,a.active_seconds,v.screen_kind from analytics_page_views a join analytics_visits v on v.id=a.visit_id where a.user_id=p_user and a.started_at>=p_from and a.started_at<p_to order by a.started_at desc,a.id limit 100)x),'[]'::jsonb) end) into result;
 return result;
end $$;

create function public.analytics_cleanup() returns void language sql security definer set search_path=public as $$
 delete from analytics_page_views where last_seen_at<now()-interval '90 days';
 delete from analytics_visits where last_seen_at<now()-interval '90 days';
 delete from analytics_user_clock where last_seen_at<now()-interval '90 days';
$$;
revoke all on function public.analytics_touch(uuid,uuid,text,boolean,text),public.analytics_report(uuid,timestamptz,timestamptz,text,integer,uuid),public.analytics_cleanup() from public,anon,authenticated,service_role;
grant execute on function public.analytics_touch(uuid,uuid,text,boolean,text) to authenticated;
grant execute on function public.analytics_report(uuid,timestamptz,timestamptz,text,integer,uuid),public.analytics_cleanup() to service_role;
commit;
