import { Suspense } from "react";
import { connection } from "next/server";
import CompetitionLeaderboard, { type LeaderboardPageData } from "@/components/CompetitionLeaderboard";
import { getLeaderboard } from "@/lib/competition/leaderboard-server";

async function Leaderboard({ type }: { type: "player" | "team" }) {
  await connection();
  let initialData: LeaderboardPageData | undefined;
  try {
    const data = await getLeaderboard({
      mode: "main", type, sort: "rating", offset: 0, limit: 50, query: "", kind: null,
    });
    if (Array.isArray(data?.items)) initialData = data;
  } catch (error) {
    console.error("Public leaderboard unavailable", error);
  }
  return <CompetitionLeaderboard initialKind={type === "player" ? "player" : "all"} initialData={initialData} />;
}

export default function PublicLeaderboard({ type }: { type: "player" | "team" }) {
  return <Suspense fallback={<section className="page-shell"><h1 className="text-3xl font-black">Рейтинг</h1><p role="status">Загрузка рейтинга…</p></section>}>
    <Leaderboard type={type} />
  </Suspense>;
}
