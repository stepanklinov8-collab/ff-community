import { randomUUID } from "crypto";
import { AvatarUploadError, readAvatarUpload, storagePathFromPublicUrl } from "@/lib/uploads/avatar";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireUser } from "@/utils/supabase/server-auth";

export async function POST(request: Request) {
  let uploadedPath: string | null = null;
  try {
    const { user } = await requireUser(request);
    const formData = await request.formData();
    const avatar = await readAvatarUpload(formData.get("avatar"));
    const supabase = createAdminClient();
    const { data: currentProfile, error: profileReadError } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    if (profileReadError) throw profileReadError;

    uploadedPath = `players/${user.id}/${randomUUID()}.${avatar.extension}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(uploadedPath, avatar.bytes, { contentType: avatar.mimeType, upsert: false });
    if (uploadError) throw uploadError;

    const avatarUrl = supabase.storage.from("avatars").getPublicUrl(uploadedPath).data.publicUrl;
    const { error: updateError } = await supabase.from("profiles").update({
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    if (updateError) throw updateError;

    const oldPath = storagePathFromPublicUrl(currentProfile?.avatar_url, "avatars");
    if (oldPath && oldPath !== uploadedPath) {
      await supabase.storage.from("avatars").remove([oldPath]);
    }
    return Response.json({ avatarUrl });
  } catch (error) {
    if (uploadedPath) await createAdminClient().storage.from("avatars").remove([uploadedPath]);
    if (error instanceof AvatarUploadError) return Response.json({ error: error.message }, { status: 400 });
    return authErrorResponse(error);
  }
}
