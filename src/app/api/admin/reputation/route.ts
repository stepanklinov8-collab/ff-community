import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireModerator } from "@/utils/supabase/server-auth";

const decisionSchema = z.object({
  reviewId: z.string().uuid(),
  approve: z.boolean(),
});

export async function GET(request: Request) {
  try {
    await requireModerator(request);
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("reputation_reviews")
      .select("id,event_id,reviewer_id,target_user_id,sentiment,reason,status,created_at")
      .eq("status", "pending").order("created_at");
    if (error) throw error;
    const ids = [...new Set((data ?? []).flatMap((row) => [row.reviewer_id, row.target_user_id]))];
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id,nickname").in("id", ids)
      : { data: [] };
    const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.nickname]));
    return Response.json({ reviews: (data ?? []).map((row) => ({
      ...row,
      reviewerName: names.get(row.reviewer_id) ?? "Игрок",
      targetName: names.get(row.target_user_id) ?? "Игрок",
    })) });
  } catch (error) {
    return authErrorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const { user } = await requireModerator(request);
    const payload = decisionSchema.parse(await request.json());
    const supabase = createAdminClient();
    const { error } = await supabase.rpc("apply_reputation_review", {
      p_review_id: payload.reviewId,
      p_actor: user.id,
      p_approve: payload.approve,
    });
    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Некорректное решение" }, { status: 400 });
    return authErrorResponse(error);
  }
}
