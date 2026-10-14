# Warning administration

The admin dashboard opens `/admin/warnings`. The page uses the existing protected admin layout and moderation component, with only the warning workspace visible. The older `/admin/competition-moderation` route remains available for other moderation tools.

Warnings and associated sanctions are separated into “Команды и гильдии” and “Игроки”. Cards show a linked recipient name, issue date (`activated_at`, falling back to `created_at`), reason, event title and link, optional session start and expiry in Moscow time. Search covers recipient, event and reason. Records without an event say so explicitly; missing related records use a readable fallback instead of displaying UUIDs as names.

The moderation API resolves profiles, teams, event titles and session times only after applying its existing access scope. Lookups are batched at 200 IDs. Event metadata attached to warnings is separate from the organizer's event picker, so the change does not broaden the blacklist picker. Existing issuance, cancellation, appeal and sanction permissions remain enforced by the existing API/RPCs. No database migration or production data rewrite is required.

Verification includes grouped recipients, names/profile links, event links, activation vs creation dates, Moscow session time, unbound warnings, search, mobile width, cancellation ID/reason and guest redirection away from the admin page. Browser action fixtures never send real warnings or cancel real records.
