-- Structured system messages and cached translations for user-authored text.

begin;

alter table public.activity_log
  add column if not exists message_key text,
  add column if not exists message_params jsonb not null default '{}'::jsonb;

create or replace function public.populate_activity_message()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  source_text text := coalesce(new.description, new.details, '');
  quoted_name text;
begin
  if nullif(new.message_key, '') is not null then return new; end if;
  quoted_name := substring(source_text from '«([^»]+)»');

  if new.action = 'team_created' or new.activity_type = 'team_created' then
    new.message_key := case when lower(source_text) like '%гильди%' then
      'activity.teamCreated.guild' else 'activity.teamCreated.team' end;
    new.message_params := jsonb_build_object('organizationName', coalesce(quoted_name, 'OMCITE'));
  elsif new.action = 'registration_roster_updated' then
    new.message_key := 'activity.rosterUpdated';
    new.message_params := jsonb_build_object('eventName', coalesce(quoted_name, 'OMCITE'));
  elsif new.activity_type = 'registration' and new.team_id is null then
    new.message_key := 'activity.playerRegistered';
    new.message_params := jsonb_build_object('eventName', coalesce(quoted_name, 'OMCITE'));
  elsif new.activity_type = 'registration' then
    new.message_key := 'activity.teamRegistered';
    new.message_params := jsonb_build_object('eventName', coalesce(quoted_name, 'OMCITE'));
  end if;
  return new;
end;
$$;

drop trigger if exists populate_activity_message_trigger on public.activity_log;
create trigger populate_activity_message_trigger
before insert or update of action, activity_type, description, details, message_key
on public.activity_log
for each row execute function public.populate_activity_message();

-- Backfill known legacy rows through the same normalization trigger.
update public.activity_log set message_key = null
where message_key is null
  and (activity_type in ('team_created','registration') or action = 'registration_roster_updated');

alter table public.notifications
  add column if not exists title_key text,
  add column if not exists body_key text,
  add column if not exists message_params jsonb not null default '{}'::jsonb;

create or replace function public.populate_notification_message()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  quoted_name text := substring(coalesce(new.body, '') from '«([^»]+)»');
  display_date text := substring(coalesce(new.body, '') from '\(([^()]*)\)$');
  leading_name text;
  format_text text;
begin
  if nullif(new.title_key, '') is not null and nullif(new.body_key, '') is not null then return new; end if;

  if new.type = 'registration' then
    new.title_key := case new.title
      when 'Участие подтверждено' then 'notification.registration.confirmedTitle'
      when 'Команда участвует' then 'notification.registration.teamConfirmedTitle'
      when 'Вы в листе ожидания' then 'notification.registration.waitingTitle'
      when 'Команда в листе ожидания' then 'notification.registration.teamWaitingTitle'
      when 'Команда в листе замены' then 'notification.registration.teamWaitingTitle'
      when 'Вы переведены в основной список' then 'notification.promoted.playerTitle'
      when 'Команда переведена в основной состав' then 'notification.promoted.teamTitle'
      else new.title_key end;
    if new.title in ('Вы переведены в основной список') then
      new.body_key := 'notification.promoted.playerBody';
    elsif new.title in ('Команда переведена в основной состав') then
      new.body_key := 'notification.promoted.teamBody';
    elsif coalesce(new.body, '') like 'Вы записались на %' then
      new.body_key := 'notification.registration.playerBody';
    elsif coalesce(new.body, '') like 'Команда записана на %' then
      new.body_key := 'notification.registration.teamBody';
    end if;
    new.message_params := new.message_params || jsonb_strip_nulls(jsonb_build_object('eventName', quoted_name, 'date', display_date));
  elsif new.type = 'cancellation' and new.title = 'Участие отменено' then
    new.title_key := 'notification.cancellation.title';
    new.body_key := case when coalesce(new.body, '') like '%личн%' then
      'notification.cancellation.playerBody' else 'notification.cancellation.teamBody' end;
  elsif new.type = 'team_invitation' then
    new.title_key := 'notification.invitation.title';
    new.body_key := 'notification.invitation.body';
    new.message_params := new.message_params || jsonb_strip_nulls(jsonb_build_object('organizationName', quoted_name));
  elsif new.type = 'team_request' then
    new.title_key := case new.title
      when 'Новая заявка' then 'notification.joinRequest.title'
      when 'Заявка принята' then 'notification.joinRequest.acceptedTitle'
      when 'Заявка отклонена' then 'notification.joinRequest.rejectedTitle'
      else new.title_key end;
    new.body_key := case new.body
      when 'Игрок подал заявку на вступление' then 'notification.joinRequest.body'
      when 'Вы добавлены в состав' then 'notification.joinRequest.acceptedBody'
      when 'Руководство отклонило заявку' then 'notification.joinRequest.rejectedBody'
      else new.body_key end;
  elsif new.type = 'room_updated' then
    new.title_key := 'notification.room.title';
    new.body_key := 'notification.room.body';
  elsif new.type = 'team_verification' and new.title = 'Новая организация на проверке' then
    new.title_key := 'notification.verification.pendingTitle';
    new.body_key := case when coalesce(new.body, '') like 'Гильдия %' then
      'notification.verification.pendingGuildBody' else 'notification.verification.pendingTeamBody' end;
    new.message_params := new.message_params || jsonb_strip_nulls(jsonb_build_object('organizationName', quoted_name));
  elsif new.type = 'verification' then
    new.title_key := case new.title
      when 'Организация верифицирована' then 'notification.verification.approvedTitle'
      when 'Верификация отозвана' then 'notification.verification.revokedTitle'
      else new.title_key end;
    new.body_key := case
      when coalesce(new.body, '') like '%прошла проверку%' then 'notification.verification.approvedBody'
      when coalesce(new.body, '') like '%требуется повторная проверка%' then 'notification.verification.revokedBody'
      else new.body_key end;
    new.message_params := new.message_params || jsonb_strip_nulls(jsonb_build_object('organizationName', quoted_name));
  elsif new.type = 'blogger_status' then
    new.title_key := case new.title
      when 'Статус блогера подтверждён' then 'notification.blogger.approvedTitle'
      when 'Заявка блогера отклонена' then 'notification.blogger.rejectedTitle'
      else new.title_key end;
    new.body_key := case new.body
      when 'Профиль появился на витрине блогеров' then 'notification.blogger.approvedBody'
      when 'Свяжитесь с администрацией для уточнения причины' then 'notification.blogger.rejectedBody'
      else new.body_key end;
  elsif new.type = 'message' and new.title = 'Новое сообщение' then
    new.title_key := 'notification.message.title';
    new.body_key := 'notification.message.body';
    new.message_params := new.message_params || jsonb_build_object('subject', regexp_replace(coalesce(new.body, ''), '^У вас новое сообщение: ', ''));
  elsif new.type = 'stats_moderation' then
    new.title_key := case new.title
      when 'Статистика подтверждена' then 'notification.stats.approvedTitle'
      when 'Статистика отклонена' then 'notification.stats.rejectedTitle'
      else new.title_key end;
    new.body_key := case new.body
      when 'Результат добавлен в профиль' then 'notification.stats.approvedBody'
      when 'Проверьте данные и доказательства' then 'notification.stats.rejectedBody'
      else new.body_key end;
  elsif new.type = 'event_proposal' and new.title = 'Новое предложение мероприятия' then
    new.title_key := 'notification.eventProposal.title';
    new.body_key := 'notification.eventProposal.body';
    new.message_params := new.message_params || jsonb_strip_nulls(jsonb_build_object('eventName', quoted_name));
  elsif new.type = 'clan_war_challenge' then
    leading_name := split_part(coalesce(new.body, ''), ' предлагает ', 1);
    format_text := substring(coalesce(new.body, '') from 'предлагает ([^:]+):');
    new.title_key := 'notification.clanWar.challengeTitle';
    new.body_key := 'notification.clanWar.challengeBody';
    new.message_params := new.message_params || jsonb_strip_nulls(jsonb_build_object(
      'organizationName', nullif(leading_name, ''), 'format', format_text, 'eventName', quoted_name
    ));
  elsif new.type = 'clan_war_response' then
    new.title_key := case new.title
      when 'Новый отклик на КВ' then 'notification.clanWar.responseTitle'
      when 'Отклик на КВ отклонён' then 'notification.clanWar.responseRejectedTitle'
      else new.title_key end;
    if new.title = 'Новый отклик на КВ' then
      leading_name := split_part(coalesce(new.body, ''), ' откликнулась на ', 1);
      new.body_key := 'notification.clanWar.responseBody';
      new.message_params := new.message_params || jsonb_strip_nulls(jsonb_build_object('organizationName', nullif(leading_name, ''), 'eventName', quoted_name));
    elsif new.title = 'Отклик на КВ отклонён' then
      new.body_key := 'notification.clanWar.responseRejectedBody';
      new.message_params := new.message_params || jsonb_strip_nulls(jsonb_build_object('eventName', quoted_name));
    end if;
  elsif new.type = 'clan_war_status' then
    new.title_key := case new.title
      when 'Вызов на КВ принят' then 'notification.clanWar.acceptedTitle'
      when 'Вызов на КВ отклонён' then 'notification.clanWar.declinedTitle'
      when 'Ваш отклик на КВ принят' then 'notification.clanWar.responseAcceptedTitle'
      when 'КВ завершено' then 'notification.clanWar.completedTitle'
      when 'КВ отменено' then 'notification.clanWar.cancelledTitle'
      else new.title_key end;
    if new.title in ('Вызов на КВ принят', 'Вызов на КВ отклонён') then
      leading_name := split_part(coalesce(new.body, ''), ': «', 1);
      new.body_key := 'notification.clanWar.statusBody';
      new.message_params := new.message_params || jsonb_strip_nulls(jsonb_build_object('organizationName', nullif(leading_name, ''), 'eventName', quoted_name));
    elsif new.title = 'Ваш отклик на КВ принят' then
      new.body_key := 'notification.clanWar.responseAcceptedBody';
      new.message_params := new.message_params || jsonb_strip_nulls(jsonb_build_object('eventName', quoted_name));
    elsif new.title in ('КВ завершено', 'КВ отменено') then
      new.body_key := 'notification.clanWar.eventBody';
      new.message_params := new.message_params || jsonb_build_object('eventName', coalesce(new.body, 'OMCITE'));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists populate_notification_message_trigger on public.notifications;
create trigger populate_notification_message_trigger
before insert or update of type, title, body, title_key, body_key, message_params
on public.notifications
for each row execute function public.populate_notification_message();

update public.notifications set title_key = null, body_key = null
where title_key is null and type in (
  'registration','cancellation','team_invitation','team_request','room_updated',
  'team_verification','verification','blogger_status','message','stats_moderation',
  'event_proposal','clan_war_challenge','clan_war_response','clan_war_status'
);

create table if not exists public.content_translations (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check(source_type in('event','comment','clan_war','news','notification','contact','message')),
  source_id uuid not null,
  source_field text not null,
  source_hash text not null,
  source_locale text not null default 'ru' check(source_locale in('ru','kk','ky')),
  target_locale text not null check(target_locale in('ru','kk','ky')),
  translated_text text not null,
  provider text not null,
  created_at timestamptz not null default now(),
  unique(source_type, source_id, source_field, source_hash, target_locale)
);

create index if not exists content_translations_lookup_idx
  on public.content_translations(source_type, source_id, source_field, target_locale, created_at desc);

alter table public.content_translations enable row level security;
-- Reads and writes go through the authenticated server route so the external
-- translation provider cannot be abused directly from the browser.

commit;
