import { getPublicSchedule } from "@/lib/competition/public-schedule-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getPublicSchedule(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Public events", error);
    return Response.json({ error: "Не удалось загрузить мероприятия" }, { status: 500 });
  }
}
