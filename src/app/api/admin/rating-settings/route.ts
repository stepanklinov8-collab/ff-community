import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireAdmin } from "@/utils/supabase/server-auth";

const schema = z.object({
  eventId: z.string().uuid(),
  category: z.enum(["training", "amateur", "regional", "official", "season_final"]),
  coefficient: z.number().min(0.01).max(5).optional(),
});


export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    const isOwner = auth.roles.includes("superadmin");
    const supabase = createAdminClient();
    const [{ data: events, error: eventsError }, { data: settings, error: settingsError }] = await Promise.all([
      supabase.from("events").select("id,title,type").in("type", ["training", "tournament", "solo"]).order("created_at", { ascending: false }),
      supabase.from("rating_event_settings").select("event_id,category,hidden_coefficient,updated_at"),
    ]);
    if (eventsError || settingsError) throw eventsError ?? settingsError;
    return Response.json({
      isOwner,
      events: events ?? [],
      settings: (settings ?? []).map((setting) => isOwner ? setting : {
        event_id: setting.event_id, category: setting.category, updated_at: setting.updated_at,
      }),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    const payload = schema.parse(await request.json());
    const isOwner = auth.roles.includes("superadmin");
    const {data,error}=await createAdminClient().rpc("u2_rating_settings",{
      p_actor:auth.user.id,p_event:payload.eventId,p_category:payload.category,p_coefficient:isOwner?payload.coefficient??null:null,
    });
    if(error)throw error;
    return Response.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Проверьте категорию мероприятия" }, { status: 400 });
    return authErrorResponse(error);
  }
}
