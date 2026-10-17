begin;

-- Existing profiles remain readable; the contact becomes mandatory when saved.
create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_nickname text := btrim(coalesce(new.raw_user_meta_data ->> 'nickname', ''));
  normalized_game_id text := btrim(coalesce(new.raw_user_meta_data ->> 'game_id', ''));
  normalized_contact text := btrim(coalesce(new.raw_user_meta_data ->> 'contact_social_url', ''));
begin
  if normalized_nickname = '' or char_length(normalized_nickname) > 20 then
    raise exception 'INVALID_NICKNAME';
  end if;
  if normalized_game_id = '' or normalized_game_id !~ '^[0-9]+$' then
    raise exception 'INVALID_GAME_ID';
  end if;
  if char_length(normalized_contact) > 300 or normalized_contact !~* '^https://(t\.me|telegram\.me|((www|m)\.)?vk\.(com|ru)|max\.ru|(www\.)?instagram\.com)/[^/?#[:space:]]+([^[:space:]]*)?$' then
    raise exception 'INVALID_CONTACT_SOCIAL_URL';
  end if;
  if exists (select 1 from public.profiles where nickname = normalized_nickname) then
    raise exception 'NICKNAME_ALREADY_USED';
  end if;
  if exists (select 1 from public.profiles where game_id = normalized_game_id) then
    raise exception 'GAME_ID_ALREADY_USED';
  end if;

  insert into public.profiles (id, nickname, game_id, avatar_url, contact_social_url)
  values (
    new.id,
    normalized_nickname,
    normalized_game_id,
    nullif(btrim(new.raw_user_meta_data ->> 'avatar_url'), ''),
    normalized_contact
  );
  return new;
end;
$$;

commit;
