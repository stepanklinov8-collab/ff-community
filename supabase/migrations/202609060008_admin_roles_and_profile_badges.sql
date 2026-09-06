-- Make profile badges independent from blogger applications and keep approved
-- applications synchronized with the public Blogger badge.
begin;

create table if not exists public.profile_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge text not null check (badge in ('blogger')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, badge)
);

insert into public.profile_badges (user_id, badge)
select user_id, 'blogger'
from public.bloggers
where status = 'approved'
on conflict (user_id, badge) do nothing;

alter table public.profile_badges enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profile_badges'
      and policyname = 'profile badges are publicly readable'
  ) then
    execute 'create policy "profile badges are publicly readable" '
      || 'on public.profile_badges for select using (true)';
  end if;
end $$;

grant select on public.profile_badges to anon, authenticated;
grant all on public.profile_badges to service_role;

commit;
