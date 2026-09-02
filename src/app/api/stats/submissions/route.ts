import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireUser } from "@/utils/supabase/server-auth";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const fieldsSchema = z.object({
  eventId: z.string().uuid(),
  sessionId: z.string().uuid(),
  kills: z.coerce.number().int().min(0).max(10000),
  matches: z.coerce.number().int().min(1).max(1000),
});

function rosterIncludes(rosterJson: unknown, legacyRoster: unknown, userId: string) {
  if (Array.isArray(rosterJson)) return rosterJson.includes(userId);
  if (Array.isArray(legacyRoster)) return legacyRoster.includes(userId);
  if (!legacyRoster) return false;
  try {
    const parsed: unknown = JSON.parse(String(legacyRoster));
    return Array.isArray(parsed) && parsed.includes(userId);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const uploadedPaths: string[] = [];
  try {
    const { user } = await requireUser(request);
    const formData = await request.formData();
    const fields = fieldsSchema.parse({
      eventId: formData.get("eventId"),
      sessionId: formData.get("sessionId"),
      kills: formData.get("kills"),
      matches: formData.get("matches"),
    });
    const files = formData.getAll("screenshots").filter((value): value is File => value instanceof File);
    if (files.length < 1 || files.length > MAX_FILES) {
      return Response.json({ error: "Прикрепите от 1 до 5 скриншотов" }, { status: 400 });
    }
    for (const file of files) {
      if (!ALLOWED_TYPES.has(file.type)) {
        return Response.json({ error: "Допустимы только JPEG, PNG и WebP" }, { status: 400 });
      }
      if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
        return Response.json({ error: "Размер каждого файла должен быть не больше 5 МБ" }, { status: 400 });
      }
    }

    const supabase = createAdminClient();
    const { data: registrations, error: registrationsError } = await supabase
      .from("event_registrations")
      .select("id, roster, roster_json, session_id")
      .eq("event_id", fields.eventId)
      .eq("session_id", fields.sessionId)
      .eq("status", "confirmed");
    if (registrationsError) throw registrationsError;
    if (!(registrations ?? []).some((registration) =>
      rosterIncludes(registration.roster_json, registration.roster, user.id)
    )) {
      return Response.json({ error: "Игрок не найден в подтверждённом составе этой сессии" }, { status: 403 });
    }

    const { data: session, error: sessionError } = await supabase
      .from("event_sessions")
      .select("start_time")
      .eq("id", fields.sessionId)
      .eq("event_id", fields.eventId)
      .single();
    if (sessionError) throw sessionError;
    if (new Date(session.start_time) > new Date()) {
      return Response.json({ error: "Статистику можно отправить после начала сессии" }, { status: 400 });
    }

    const { data: duplicate } = await supabase
      .from("player_stats")
      .select("id")
      .eq("user_id", user.id)
      .eq("event_id", fields.eventId)
      .eq("session_id", fields.sessionId)
      .in("status", ["pending", "approved"])
      .maybeSingle();
    if (duplicate) {
      return Response.json({ error: "Статистика для этой сессии уже отправлена" }, { status: 409 });
    }

    for (const file of files) {
      const path = `${user.id}/${fields.eventId}/${fields.sessionId}/${randomUUID()}.${EXTENSIONS[file.type]}`;
      const { error: uploadError } = await supabase.storage
        .from("stats-screenshots")
        .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      uploadedPaths.push(path);
    }
    const screenshotUrls = uploadedPaths.map((path) =>
      supabase.storage.from("stats-screenshots").getPublicUrl(path).data.publicUrl
    );
    const { data: event } = await supabase.from("events").select("title").eq("id", fields.eventId).single();
    const { error: insertError } = await supabase.from("player_stats").insert({
      user_id: user.id,
      event_id: fields.eventId,
      session_id: fields.sessionId,
      event_title: event?.title ?? "",
      kills: fields.kills,
      matches_played: fields.matches,
      screenshot_url: screenshotUrls.join(","),
      status: "pending",
    });
    if (insertError) throw insertError;

    return Response.json({ success: true });
  } catch (error) {
    if (uploadedPaths.length) {
      try {
        await createAdminClient().storage.from("stats-screenshots").remove(uploadedPaths);
      } catch {
        // Only files created by this failed request are removed.
      }
    }
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Проверьте выбранную сессию, киллы и матчи" }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
