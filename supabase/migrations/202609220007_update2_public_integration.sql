begin;
alter table public.events add column archive_end_time timestamptz;
update public.events e set archive_end_time=coalesce(to_jsonb(e)->>'end_time',to_jsonb(e)->>'end_date')::timestamptz
where coalesce(to_jsonb(e)->>'end_time',to_jsonb(e)->>'end_date') is not null;
grant select(archive_end_time,rules_text) on public.events to anon,authenticated;
revoke all on public.warnings from anon,authenticated;
alter table public.events enable row level security;
create policy u2_event_visibility_guard on public.events as restrictive for select to anon,authenticated using(
 (moderation_status='approved' and (is_published or publish_at<=now()))
 or organizer_user_id=auth.uid() or public.is_full_admin(auth.uid())
);
-- Scheduled publishing must respect approval, cancellation and organizer suspension.
create or replace function public.u2_publish_scheduled() returns void language sql security definer set search_path=public as $$
 update public.events set is_published=true where not is_published and publish_at<=now()
 and moderation_status='approved' and cancelled_at is null and frozen_at is null;
$$;
revoke all on function public.u2_publish_scheduled() from public,anon,authenticated;
grant execute on function public.u2_publish_scheduled() to service_role;
commit;
