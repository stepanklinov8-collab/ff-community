export interface EventPublicationState {
  is_published?: boolean | null;
  publish_at?: string | null;
}

export function isEventEffectivelyPublished(
  event: EventPublicationState | null | undefined,
  now = Date.now(),
) {
  if (!event) return false;
  if (event.is_published) return true;
  if (!event.publish_at) return false;

  const publishAt = new Date(event.publish_at).getTime();
  return Number.isFinite(publishAt) && publishAt <= now;
}
