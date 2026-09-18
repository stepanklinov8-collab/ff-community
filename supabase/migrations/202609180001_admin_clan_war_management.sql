-- Administrative visibility controls for standalone clan wars (КВ).

begin;

alter table public.clan_wars
  add column if not exists is_hidden boolean not null default false,
  add column if not exists hidden_at timestamptz,
  add column if not exists hidden_by uuid references auth.users(id) on delete set null;

create index if not exists clan_wars_visibility_created_idx
  on public.clan_wars(is_hidden, created_at desc);

drop policy if exists "clan wars are public" on public.clan_wars;
create policy "visible clan wars are public" on public.clan_wars
for select using (not is_hidden or public.is_app_admin());

drop policy if exists "clan war responses are public" on public.clan_war_responses;
create policy "visible clan war responses are public" on public.clan_war_responses
for select using (
  public.is_app_admin()
  or exists (
    select 1
    from public.clan_wars war
    where war.id = clan_war_responses.clan_war_id
      and not war.is_hidden
  )
);

drop policy if exists "clan war rosters are public" on public.clan_war_rosters;
create policy "visible clan war rosters are public" on public.clan_war_rosters
for select using (
  public.is_app_admin()
  or exists (
    select 1
    from public.clan_wars war
    where war.id = clan_war_rosters.clan_war_id
      and not war.is_hidden
  )
);

drop policy if exists "visible clan war comments are public" on public.clan_war_comments;
create policy "visible clan war comments are public" on public.clan_war_comments
for select using (
  public.is_app_admin()
  or (
    not is_deleted
    and exists (
      select 1
      from public.clan_wars war
      where war.id = clan_war_comments.clan_war_id
        and not war.is_hidden
    )
  )
);

commit;
