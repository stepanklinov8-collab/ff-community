-- Profile completeness and secure avatar storage.
-- Additive and idempotent: no existing users, profiles or files are removed.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Eight legacy Auth accounts had no public profile row, so the rating page
-- could not display them. Backfill safe public fields only; email stays in Auth.
-- A duplicated game ID is left empty for every conflicting account until its
-- owner corrects it, while both accounts remain visible in the rating.
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
    from public.profiles existing_profile
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
      from public.profiles existing_profile
      where existing_profile.game_id = users.normalized_game_id
    ) then null
    else users.normalized_game_id
  end,
  nullif(btrim(users.raw_user_meta_data ->> 'avatar_url'), '')
from missing_profiles as users
on conflict (id) do nothing;

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.profiles (id, nickname, game_id, avatar_url)
    values (
      new.id,
      coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nickname'), ''), 'Игрок'),
      case
        when exists (
          select 1
          from public.profiles existing_profile
          where existing_profile.game_id = nullif(btrim(new.raw_user_meta_data ->> 'game_id'), '')
            and existing_profile.id <> new.id
        ) then null
        else nullif(btrim(new.raw_user_meta_data ->> 'game_id'), '')
      end,
      nullif(btrim(new.raw_user_meta_data ->> 'avatar_url'), '')
    )
    on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.profiles (id, nickname, game_id, avatar_url)
    values (
      new.id,
      coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nickname'), ''), 'Игрок'),
      null,
      nullif(btrim(new.raw_user_meta_data ->> 'avatar_url'), '')
    )
    on conflict (id) do nothing;
  end;
  return new;
end;
$$;

drop trigger if exists create_profile_after_auth_signup on auth.users;
create trigger create_profile_after_auth_signup
after insert on auth.users
for each row execute function public.create_profile_for_auth_user();

commit;
