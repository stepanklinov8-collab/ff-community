import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireUser } from "@/utils/supabase/server-auth";
import { playerRoleIds } from "@/lib/profile/roles";
import { normalizeContactSocialUrl } from "@/lib/profile/contact-social";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = z.string().uuid().parse((await context.params).id);
  const db = createAdminClient();
  const [{ data: profile, error }, { data: membership }] = await Promise.all([
    db.from("profiles").select("id,nickname,game_id,avatar_url,profile_level,reputation_score,reputation_events_count,main_rating,player_roles,contact_social_url").eq("id", id).maybeSingle(),
    db.from("team_members").select("team_id,teams(name,type)").eq("user_id", id).limit(1),
  ]);
  if (error) throw error;
  if (!profile) return Response.json({ error: "Игрок не найден" }, { status: 404 });
  let contactSocialUrl: string | null = null;
  try {
    await requireUser(request);
    contactSocialUrl = normalizeContactSocialUrl(profile.contact_social_url || "");
  } catch {
    // Guests receive the public profile without contact data.
  }
  const team = membership?.[0]?.teams as { name?: string; type?: string } | null;
  return Response.json({
    profile: {
      nickname: profile.nickname || "—", game_id: profile.game_id || "—", avatar_url: profile.avatar_url || "",
      profile_level: profile.profile_level ?? 1, reputation_score: Number(profile.reputation_score ?? 50),
      reputation_events_count: profile.reputation_events_count ?? 0, main_rating: profile.main_rating == null ? null : Number(profile.main_rating),
      player_roles: (profile.player_roles ?? []).filter((value: string) => playerRoleIds.has(value)), contact_social_url: contactSocialUrl,
    },
    team: membership?.[0] ? { id: membership[0].team_id, name: team?.name ?? "", type: team?.type ?? "team" } : null,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
