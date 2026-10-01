import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { allRows, competitionErrorResponse } from "@/lib/competition/server";
import { calculateMapStatistics } from "@/lib/competition/map-statistics";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const teamId = z.string().uuid().parse((await context.params).id);
    const db = createAdminClient();
    const { data: team, error: teamError } = await db.from("teams").select("id").eq("id", teamId).maybeSingle();
    if (teamError) throw teamError;
    if (!team) return Response.json({ error: "Команда не найдена" }, { status: 404 });
    const rows = await allRows((from, to) => db.from("competition_team_facts").select("game_id,played,place,landing_location,event_games!inner(map_name)").eq("team_id", teamId).range(from, to)).then(facts => facts.map(fact => { const relation = fact.event_games as unknown as { map_name: string } | { map_name: string }[]; return { map: Array.isArray(relation) ? relation[0]?.map_name ?? "unknown" : relation.map_name, played: fact.played, place: fact.place, landingLocation: fact.landing_location, teamId }; }));
    return Response.json({ maps: calculateMapStatistics(rows) }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=300" } });
  } catch (error) {
    return competitionErrorResponse(error);
  }
}
