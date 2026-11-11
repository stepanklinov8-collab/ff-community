import { Suspense } from "react";
import { connection } from "next/server";
import TournamentsContent from "@/components/TournamentsContent";
import { getPublicSchedule } from "@/lib/competition/public-schedule-server";

async function Schedule() {
  await connection();
  const schedule = await getPublicSchedule().catch(error => {
    console.error("Public schedule unavailable", error);
    return undefined;
  });
  return <TournamentsContent initialData={schedule} />;
}

export default function Page() {
  return <Suspense fallback={<section className="page-shell"><h1 className="text-3xl font-black">Турниры и тренировки</h1><p role="status">Загрузка расписания…</p></section>}>
    <Schedule />
  </Suspense>;
}
