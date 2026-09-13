import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { ApiAuthError, authErrorResponse, requireUser } from "@/utils/supabase/server-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const updateSchema = z.object({
  channelName: z.string().trim().min(1).max(100),
  channelLink: z.string().trim().url().max(500),
  contactLink: z.union([z.literal(""), z.string().trim().url().max(500)]),
  followersCount: z.number().int().min(0).max(2_000_000_000),
});

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const { data: blogger, error } = await supabase.from("bloggers")
      .select("id,user_id,channel_name,channel_link,contact_link,followers_count,status,created_at")
      .eq("id", id).eq("status", "approved").maybeSingle();
    if (error) throw error;
    if (!blogger) return Response.json({ error: "Страница блогера не найдена" }, { status: 404 });
    const { data: profile, error: profileError } = await supabase.from("profiles")
      .select("id,nickname,avatar_url,bio")
      .eq("id", blogger.user_id).maybeSingle();
    if (profileError) throw profileError;
    return Response.json({ blogger: { ...blogger, profile } });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requireUser(request);
    const { id } = await context.params;
    const payload = updateSchema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: blogger, error: bloggerError } = await supabase.from("bloggers")
      .select("id,user_id,status").eq("id", id).maybeSingle();
    if (bloggerError) throw bloggerError;
    if (!blogger) return Response.json({ error: "Страница блогера не найдена" }, { status: 404 });
    const isAdmin = auth.roles.includes("admin") || auth.roles.includes("superadmin");
    if (blogger.user_id !== auth.user.id && !isAdmin) throw new ApiAuthError("Недостаточно прав", 403);

    const { error } = await supabase.from("bloggers").update({
      channel_name: payload.channelName,
      channel_link: payload.channelLink,
      contact_link: payload.contactLink || null,
      followers_count: payload.followersCount,
    }).eq("id", id);
    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Проверьте название, ссылки и число подписчиков" }, { status: 400 });
    return authErrorResponse(error);
  }
}
