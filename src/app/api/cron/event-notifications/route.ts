import { createAdminClient } from "@/utils/supabase/admin";
import { sendPushToUsers } from "@/lib/firebase/admin";
import { allRows } from "@/lib/competition/server";

export const maxDuration = 300;

interface EventRow {
  id: string;
  title: string;
  publish_at: string | null;
  created_at: string;
}

interface SessionRow {
  id: string;
  event_id: string;
  start_time: string;
  registration_open_time: string | null;
  reminder_minutes: number[] | null;
  events: { title: string } | null;
}

function isDue(target: Date, now: Date, windowMinutes = 5) {
  const difference = now.getTime() - target.getTime();
  return difference >= 0 && difference < windowMinutes * 60_000;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  for(const action of ["u2_expire_moderation","u2_publish_scheduled","u2_flush_notifications"]){
    const {error}=await supabase.rpc(action);if(error){console.error("Competition maintenance",action,error);return Response.json({error:"Не удалось завершить обработку мероприятий"},{status:500});}
  }
  const {data:cleanup}=await supabase.from("competition_storage_cleanup").select("storage_path").order("created_at").limit(100);
  if(cleanup?.length){const paths=cleanup.map(row=>row.storage_path);const {error}=await supabase.storage.from("competition-evidence").remove(paths);if(!error)await supabase.from("competition_storage_cleanup").delete().in("storage_path",paths);}
  const now = new Date();
  const horizon = new Date(now.getTime() + 25 * 60 * 60_000).toISOString();
  const subscriptions = await allRows((from, to) => supabase
    .from("push_subscriptions")
    .select("user_id")
    .eq("is_active", true).order("id").range(from, to));
  const allUserIds = [...new Set((subscriptions ?? []).map((row) => row.user_id))];
  let deliveries = 0;

  const events = await allRows((from, to) => supabase
    .from("events")
    .select("id, title, publish_at, created_at")
    .eq("is_published", true).eq("moderation_status","approved").is("cancelled_at",null).is("frozen_at",null)
    .order("id").range(from, to));

  for (const event of (events ?? []) as EventRow[]) {
    const publishedAt = new Date(event.publish_at ?? event.created_at);
    if (publishedAt > now) continue;
    const { data: existing } = await supabase
      .from("push_delivery_logs")
      .select("id")
      .eq("event_id", event.id)
      .eq("notification_type", "event_published")
      .maybeSingle();
    if (existing) continue;
    const result = await sendPushToUsers(allUserIds, {
      title: "Новое мероприятие",
      body: `Опубликовано «${event.title}» — откройте расписание и выберите время`,
      link: `/tournaments/${event.id}`,
    });
    await supabase.from("push_delivery_logs").insert({
      event_id: event.id,
      notification_type: "event_published",
      sent_count: result.successCount,
    });
    deliveries += 1;
  }

  const sessions = await allRows((from, to) => supabase
    .from("event_sessions")
    .select("id, event_id, start_time, registration_open_time, reminder_minutes, events!inner(title)")
    .eq("events.is_published",true).eq("events.moderation_status","approved").is("events.cancelled_at",null).is("events.frozen_at",null).neq("status","cancelled")
    .gte("start_time", now.toISOString())
    .lte("start_time", horizon).order("id").range(from, to));

  for (const session of (sessions ?? []) as unknown as SessionRow[]) {
    if (session.registration_open_time && new Date(session.registration_open_time) <= now) {
      const { data: existing } = await supabase
        .from("push_delivery_logs")
        .select("id")
        .eq("session_id", session.id)
        .eq("notification_type", "registration_open")
        .maybeSingle();
      if (!existing) {
        const result = await sendPushToUsers(allUserIds, {
          title: "Регистрация открыта",
          body: `Можно записаться на «${session.events?.title ?? "мероприятие OMCITE"}»`,
          link: `/tournaments/${session.event_id}`,
        });
        await supabase.from("push_delivery_logs").insert({
          event_id: session.event_id,
          session_id: session.id,
          notification_type: "registration_open",
          sent_count: result.successCount,
        });
        deliveries += 1;
      }
    }

    for (const minutes of session.reminder_minutes ?? [60]) {
      const reminderAt = new Date(new Date(session.start_time).getTime() - minutes * 60_000);
      if (!isDue(reminderAt, now)) continue;
      const { data: existing } = await supabase
        .from("push_delivery_logs")
        .select("id")
        .eq("session_id", session.id)
        .eq("notification_type", "event_reminder")
        .eq("reminder_minutes", minutes)
        .maybeSingle();
      if (existing) continue;

      const registrations = await allRows((from, to) => supabase
        .from("event_registrations")
        .select("roster_json, team_id, participant_user_id")
        .eq("session_id", session.id)
        .eq("status", "confirmed").order("id").range(from, to));
      const rosterIds = (registrations ?? []).flatMap((row) =>
        [...(Array.isArray(row.roster_json) ? row.roster_json as string[] : []), ...(row.participant_user_id ? [row.participant_user_id] : [])],
      );
      const teamIds = [...new Set((registrations ?? [])
        .map((row) => row.team_id)
        .filter((id): id is string => Boolean(id)))];
      const leaders: Array<{ user_id: string }> = [];
      for (let offset = 0; offset < teamIds.length; offset += 100) {
        leaders.push(...await allRows((from, to) => supabase.from("team_members").select("user_id")
          .in("team_id", teamIds.slice(offset, offset + 100)).in("role_in_team", ["leader", "senior_deputy", "deputy"])
          .order("team_id").order("user_id").range(from, to)));
      }
      const recipientIds = [...new Set([...rosterIds, ...(leaders ?? []).map((row) => row.user_id)])];
      const result = await sendPushToUsers(recipientIds, {
        title: "Скоро начало",
        body: `«${session.events?.title ?? "Мероприятие OMCITE"}» начнётся через ${minutes} мин.`,
        link: `/tournaments/${session.event_id}`,
      });
      await supabase.from("push_delivery_logs").insert({
        event_id: session.event_id,
        session_id: session.id,
        notification_type: "event_reminder",
        reminder_minutes: minutes,
        sent_count: result.successCount,
      });
      deliveries += 1;
    }
  }

  return Response.json({ success: true, deliveries, checkedAt: now.toISOString() });
}
