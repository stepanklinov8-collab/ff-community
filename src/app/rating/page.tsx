"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import Image from "next/image";

interface Player {
  id: string;
  nickname: string;
  game_id: string;
  avatar_url: string;
  kills: number;
  matches: number;
  ratio: number;
  rating: number;
}

interface OrganizationRating { id: string; name: string; type: "team" | "guild"; main_rating: number; avatar_url: string }

export default function RatingPage() {
  const supabase = useMemo(() => createClient(), []);
  const [players, setPlayers] = useState<Player[]>([]);
  const [filter, setFilter] = useState<string>("rating");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<OrganizationRating[]>([]);

  useEffect(() => {
    const fetchPlayers = async () => {
      // Получаем всех пользователей из profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nickname, game_id, avatar_url, main_rating");
      const { data: mainEvents } = await supabase.from("events").select("id").in("type", ["tournament", "training", "solo"]);
      const mainEventIds = (mainEvents ?? []).map((event) => event.id);
      const { data: organizationRows } = await supabase.from("teams")
        .select("id,name,type,main_rating,avatar_url").eq("verified", true).order("main_rating", { ascending: false });
      setOrganizations((organizationRows ?? []).map((row) => ({ ...row, main_rating: Number(row.main_rating ?? 1) })) as OrganizationRating[]);

      if (!profiles) {
        setLoading(false);
        return;
      }

      // Для каждого пользователя получаем подтверждённую статистику
      const enriched = await Promise.all(
        profiles.map(async (p) => {
          const { data: stats } = await supabase
            .from("player_stats")
            .select("kills, matches_played")
            .eq("user_id", p.id)
            .eq("status", "approved")
            .in("event_id", mainEventIds.length ? mainEventIds : ["00000000-0000-0000-0000-000000000000"]);

          const kills = stats?.reduce((sum, s) => sum + (s.kills || 0), 0) || 0;
          const matches = stats?.reduce((sum, s) => sum + (s.matches_played || 0), 0) || 0;
          const ratio = matches > 0 ? +(kills / matches).toFixed(2) : 0;
          return {
            id: p.id,
            nickname: p.nickname || "—",
            game_id: p.game_id || "—",
            avatar_url: p.avatar_url || "",
            kills,
            matches,
            ratio,
            rating: Number(p.main_rating ?? 1),
          };
        })
      );

      setPlayers(enriched);
      setLoading(false);
    };
    fetchPlayers();
  }, [supabase]);

  const filteredPlayers = players
    .filter(p => p.nickname.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (filter === "rating") return b.rating - a.rating;
      if (filter === "ratio") return b.ratio - a.ratio;
      if (filter === "kills") return b.kills - a.kills;
      if (filter === "matches") return b.matches - a.matches;
      return 0;
    });

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-6 text-blue-500">Рейтинг игроков</h1>

      {/* Поиск и фильтры */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <input
          className="p-2 text-black rounded w-full max-w-xs"
          placeholder="Поиск игрока..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("rating")}
            className={"px-3 py-1 rounded text-sm " + (filter === "rating" ? "bg-blue-500" : "bg-gray-700 hover:bg-gray-600")}
          >
            Рейтинг
          </button>
          <button
            onClick={() => setFilter("ratio")}
            className={"px-3 py-1 rounded text-sm " + (filter === "ratio" ? "bg-blue-500" : "bg-gray-700 hover:bg-gray-600")}
          >
            У/С
          </button>
          <button
            onClick={() => setFilter("kills")}
            className={"px-3 py-1 rounded text-sm " + (filter === "kills" ? "bg-blue-500" : "bg-gray-700 hover:bg-gray-600")}
          >
            Киллы
          </button>
          <button
            onClick={() => setFilter("matches")}
            className={"px-3 py-1 rounded text-sm " + (filter === "matches" ? "bg-blue-500" : "bg-gray-700 hover:bg-gray-600")}
          >
            Матчи
          </button>
        </div>
      </div>

      {loading ? (
        <p>Загрузка...</p>
      ) : filteredPlayers.length === 0 ? (
        <p className="text-gray-400">Игроки не найдены.</p>
      ) : (
        <div className="space-y-2">
          {filteredPlayers.map((p) => (
            <Link
              key={p.id}
              href={`/profile/${p.id}`}
              className="bg-gray-800 p-3 rounded flex items-center gap-3 hover:bg-gray-700"
            >
              <div className="w-10 h-10 rounded-lg bg-gray-700 overflow-hidden flex-shrink-0">
                {p.avatar_url ? (
                  <Image src={p.avatar_url} alt={`Аватар ${p.nickname}`} width={40} height={40} unoptimized className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    {p.nickname?.[0]?.toUpperCase() || "?"}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-blue-400">{p.nickname}</p>
                <p className="text-xs text-gray-400">ID: {p.game_id}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-300">У/С: {p.ratio}</p>
                <p className="text-xs text-yellow-400">Рейтинг: {p.rating.toFixed(0)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <section className="mt-10">
        <h2 className="mb-4 text-2xl font-bold">Рейтинг команд и гильдий</h2>
        <p className="mb-4 text-sm text-slate-400">60% — четыре лучших игрока, 30% — результаты, 10% — достижения.</p>
        <div className="grid gap-3 md:grid-cols-2">{organizations.map((organization, index) => <Link key={organization.id} href={`/teams/${organization.id}`} className="cyber-card flex items-center gap-3 p-4"><span className="w-8 text-lg font-black text-slate-500">#{index + 1}</span><div className="flex-1"><strong className="text-cyan-300">{organization.name}</strong><p className="text-xs text-slate-500">{organization.type === "guild" ? "Гильдия" : "Команда"}</p></div><span className="text-2xl font-black">{organization.main_rating.toFixed(0)}</span></Link>)}</div>
      </section>
    </div>
  );
}
