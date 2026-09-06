import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireUser } from "@/utils/supabase/server-auth";

const localeSchema = z.object({ locale: z.enum(["ru", "kk", "ky"]) });

export async function PATCH(request: Request) {
  try {
    const { user } = await requireUser(request);
    const { locale } = localeSchema.parse(await request.json());
    const supabase = createAdminClient();
    const [{ error: profileError }, { error: metadataError }] = await Promise.all([
      supabase.from("profiles").update({ locale, updated_at: new Date().toISOString() }).eq("id", user.id),
      supabase.auth.admin.updateUserById(user.id, { user_metadata: { ...user.user_metadata, locale } }),
    ]);
    if (profileError || metadataError) throw profileError ?? metadataError;
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Некорректный язык" }, { status: 400 });
    return authErrorResponse(error);
  }
}
