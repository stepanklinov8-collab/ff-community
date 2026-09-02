import { randomUUID } from "crypto";
import { z } from "zod";
import { AvatarUploadError, readAvatarUpload, storagePathFromPublicUrl } from "@/lib/uploads/avatar";
import { createAdminClient } from "@/utils/supabase/admin";
import { ApiAuthError, authErrorResponse, requireUser } from "@/utils/supabase/server-auth";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let uploadedPath: string | null = null;
  try {
    const { id } = paramsSchema.parse(await context.params);
    const auth = await requireUser(request);
    const supabase = createAdminClient();
    const [{ data: team, error: teamError }, { data: membership, error: membershipError }] = await Promise.all([
      supabase.from("teams").select("id, avatar_url").eq("id", id).maybeSingle(),
      supabase.from("team_members").select("role_in_team").eq("team_id", id).eq("user_id", auth.user.id).maybeSingle(),
    ]);
    if (teamError) throw teamError;
    if (membershipError) throw membershipError;
    if (!team) return Response.json({ error: "Команда или гильдия не найдена" }, { status: 404 });

    const canManage = auth.roles.includes("moderator")
      || auth.roles.includes("superadmin")
      || ["leader", "senior_deputy", "deputy"].includes(membership?.role_in_team ?? "");
    if (!canManage) throw new ApiAuthError("Недостаточно прав для изменения эмблемы", 403);

    const formData = await request.formData();
    const avatar = await readAvatarUpload(formData.get("avatar"));
    uploadedPath = `teams/${id}/${randomUUID()}.${avatar.extension}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(uploadedPath, avatar.bytes, { contentType: avatar.mimeType, upsert: false });
    if (uploadError) throw uploadError;

    const avatarUrl = supabase.storage.from("avatars").getPublicUrl(uploadedPath).data.publicUrl;
    const { error: updateError } = await supabase.from("teams").update({
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (updateError) throw updateError;

    const oldPath = storagePathFromPublicUrl(team.avatar_url, "avatars");
    if (oldPath && oldPath !== uploadedPath) {
      await supabase.storage.from("avatars").remove([oldPath]);
    }
    return Response.json({ avatarUrl });
  } catch (error) {
    if (uploadedPath) await createAdminClient().storage.from("avatars").remove([uploadedPath]);
    if (error instanceof AvatarUploadError) return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof z.ZodError) return Response.json({ error: "Некорректный ID команды" }, { status: 400 });
    return authErrorResponse(error);
  }
}
