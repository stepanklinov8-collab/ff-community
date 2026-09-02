import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireAdmin, requireSuperadmin } from "@/utils/supabase/server-auth";

const verificationSchema = z.object({
  teamId: z.string().uuid(),
  verified: z.boolean(),
});

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const supabase = createAdminClient();
    const { data: teams, error } = await supabase.from("teams").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    const leaderIds = [...new Set((teams ?? []).map((team) => team.leader_id).filter(Boolean))];
    const { data: profiles } = leaderIds.length
      ? await supabase.from("profiles").select("id, nickname").in("id", leaderIds)
      : { data: [] };
    const nicknameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.nickname]));
    return Response.json({
      teams: (teams ?? []).map((team) => ({
        ...team,
        leader_nickname: nicknameById.get(team.leader_id) ?? "—",
      })),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin(request);
    const payload = verificationSchema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: team, error } = await supabase
      .from("teams")
      .update({ verified: payload.verified })
      .eq("id", payload.teamId)
      .select("id, name")
      .single();
    if (error) throw error;
    const { data: members } = await supabase.from("team_members").select("user_id").eq("team_id", payload.teamId);
    if (members?.length) {
      await supabase.from("notifications").insert(members.map((member) => ({
        user_id: member.user_id,
        type: "verification",
        title: payload.verified ? "Организация верифицирована" : "Верификация отозвана",
        body: payload.verified
          ? `«${team.name}» прошла проверку и доступна на платформе`
          : `Для «${team.name}» требуется повторная проверка`,
        link: `/teams/${team.id}`,
      })));
    }
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Некорректные данные команды" }, { status: 400 });
    return authErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireSuperadmin(request);
    const teamId = z.string().uuid().parse(new URL(request.url).searchParams.get("teamId"));
    const supabase = createAdminClient();
    const { error } = await supabase.from("teams").delete().eq("id", teamId);
    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Некорректный ID команды" }, { status: 400 });
    return authErrorResponse(error);
  }
}
