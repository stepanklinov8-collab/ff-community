"use client";

import Image from "next/image";
import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

interface TeamStats {
  id: string;
  name: string;
  type: string;
  avatar_url: string;
  members_count: number;
  total_kills: number;
  total_matches: number;
  ratio: number;
  cost: number;
  trophies: number;
}

export default function TeamsStatsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [teams, setTeams] = useState<TeamStats[]>([]);
  const [filter, setFilter] = useState<string>("cost");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeams = async () => {
      const { data: teamsData } = await supabase
        .from("teams")
        .select("*")
        .eq("verified", true);

      if (!teamsData) {
        setLoading(false);
        return;
      }

      const enriched = await Promise.all(
        teamsData.map(async (team) => {
          // Получаем участников команды
          const { data: members } = await supabase
            .from("team_members")
            .select("user_id")
            .eq("team_id", team.id);

          const memberIds = members?.map(m => m.user_id) || [];
          let totalKills = 0;
          let totalMatches = 0;

          // Суммируем статистику всех участников
          for (const userId of memberIds) {
            const { data: stats } = await supabase
              .from("player_stats")
              .select("kills, matches_played")
              .eq("user_id", userId)
              .eq("status", "approved");

            if (stats) {
              totalKills += stats.reduce((sum, s) => sum + (s.kills || 0), 0);
              totalMatches += stats.reduce((sum, s) => sum + (s.matches_played || 0), 0);
            }
          }

          const ratio = totalMatches > 0 ? +(totalKills / totalMatches).toFixed(2) : 0;
          const cost = Math.round(totalKills * 10 + totalMatches * 5);

          // Победы (трофеи)
          const { data: results } = await supabase
            .from("event_results")
            .select("is_winner")
            .eq("team_id", team.id)
            .eq("is_winner", true);
          const trophies = results?.length || 0;

          return {
            id: team.id,
            name: team.name,
            type: team.type,
            avatar_url: team.avatar_url || "",
            members_count: memberIds.length,
            total_kills: totalKills,
            total_matches: totalMatches,
            ratio,
            cost,
            trophies,
          };
        })
      );

      setTeams(enriched);
      setLoading(false);
    };
    fetchTeams();
  }, [supabase]);

  const filteredTeams = teams
    .filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (filter === "cost") return b.cost - a.cost;
      if (filter === "ratio") return b.ratio - a.ratio;
      if (filter === "trophies") return b.trophies - a.trophies;
      if (filter === "members") return b.members_count - a.members_count;
      return 0;
    });

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-6 text-blue-500">Статистика команд и гильдий</h1>

      <div className="flex gap-4 mb-6 flex-wrap">
        <input
          className="p-2 text-black rounded w-full max-w-xs"
          placeholder="Поиск команды..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("cost")}
            className={"px-3 py-1 rounded text-sm " + (filter === "cost" ? "bg-blue-500" : "bg-gray-700 hover:bg-gray-600")}
          >
            Стоимость
          </button>
          <button
            onClick={() => setFilter("ratio")}
            className={"px-3 py-1 rounded text-sm " + (filter === "ratio" ? "bg-blue-500" : "bg-gray-700 hover:bg-gray-600")}
          >
            У/С
          </button>
          <button
            onClick={() => setFilter("trophies")}
            className={"px-3 py-1 rounded text-sm " + (filter === "trophies" ? "bg-blue-500" : "bg-gray-700 hover:bg-gray-600")}
          >
            Трофеи
          </button>
          <button
            onClick={() => setFilter("members")}
            className={"px-3 py-1 rounded text-sm " + (filter === "members" ? "bg-blue-500" : "bg-gray-700 hover:bg-gray-600")}
          >
            Состав
          </button>
        </div>
      </div>

      {loading ? (
        <p>Загрузка...</p>
      ) : filteredTeams.length === 0 ? (
        <p className="text-gray-400">Команды не найдены.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map(t => (
            <Link
              key={t.id}
              href={`/teams/${t.id}`}
              className="bg-gray-800 p-4 rounded hover:bg-gray-700"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-lg bg-gray-700 overflow-hidden flex-shrink-0">
                  {t.avatar_url ? (
                    <Image src={t.avatar_url} alt={`Эмблема ${t.name}`} width={48} height={48} unoptimized className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      {t.name?.[0]?.toUpperCase() || "?"}
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-blue-400">{t.name}</p>
                  <span className="text-xs uppercase bg-gray-700 px-2 py-0.5 rounded">
                    {t.type === "guild" ? "Гильдия" : "Команда"}
                  </span>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-gray-300">У/С: {t.ratio}</p>
                <p className="text-gray-300">Киллы: {t.total_kills} | Матчи: {t.total_matches}</p>
                <p className="text-gray-300">Состав: {t.members_count} чел.</p>
                <p className="text-yellow-400">Стоимость: {t.cost} ₽</p>
                <p className="text-green-400">🏆 Трофеи: {t.trophies}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
