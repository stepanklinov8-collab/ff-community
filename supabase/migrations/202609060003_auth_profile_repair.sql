-- Repair legacy Auth accounts that do not have a public profile.
-- New accounts are handled by create_profile_after_auth_signup.

begin;

with auth_profiles as (
  select
    users.*,
    nullif(btrim(users.raw_user_meta_data ->> 'game_id'), '') as normalized_game_id,
    count(*) over (
      partition by nullif(btrim(users.raw_user_meta_data ->> 'game_id'), '')
    ) as game_id_uses
  from auth.users as users
),
missing_profiles as (
  select users.*
  from auth_profiles as users
  where not exists (
    select 1
    from public.profiles as existing_profile
    where existing_profile.id = users.id
  )
)
insert into public.profiles (id, nickname, game_id, avatar_url)
select
  users.id,
  coalesce(nullif(btrim(users.raw_user_meta_data ->> 'nickname'), ''), 'Игрок'),
  case
    when users.normalized_game_id is null or users.game_id_uses > 1 then null
    when exists (
      select 1
      from public.profiles as existing_profile
      where existing_profile.game_id = users.normalized_game_id
    ) then null
    else users.normalized_game_id
  end,
  nullif(btrim(users.raw_user_meta_data ->> 'avatar_url'), '')
from missing_profiles as users
on conflict (id) do nothing;

commit;
