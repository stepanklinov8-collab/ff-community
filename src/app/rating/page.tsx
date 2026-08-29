"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

interface Player {
  id: string;
  nickname: string;
  game_id: string;
  avatar_url: string;
  kills: number;
  matches: number;
  ratio: number;
  cost: number;
}

export default function RatingPage() {
  const supabase = createClient();
  const [players, setPlayers] = useState<Player[]>([]);
  const [filter, setFilter] = useState<string>("ratio");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlayers = async () => {
      // Получаем всех пользователей из profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_url");

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
            .eq("status", "approved");

          const kills = stats?.reduce((sum, s) => sum + (s.kills || 0), 0) || 0;
          const matches = stats?.reduce((sum, s) => sum + (s.matches_played || 0), 0) || 0;
          const ratio = matches > 0 ? +(kills / matches).toFixed(2) : 0;
          const cost = Math.round(kills * 10 + matches * 5);

          return {
            id: p.id,
            nickname: p.nickname || "—",
            game_id: "", // заполним позже из auth metadata
            avatar_url: p.avatar_url || "",
            kills,
            matches,
            ratio,
            cost,
          };
        })
      );

      // Получаем game_id из auth.users (через admin API в будущем, пока из profiles)
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      if (authUsers?.users) {
        for (const p of enriched) {
          const u = authUsers.users.find((au: any) => au.id === p.id);
          if (u) p.game_id = u.user_metadata?.game_id || "—";
        }
      }

      setPlayers(enriched);
      setLoading(false);
    };
    fetchPlayers();
  }, []);

  const filteredPlayers = players
    .filter(p => p.nickname.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (filter === "ratio") return b.ratio - a.ratio;
      if (filter === "cost") return b.cost - a.cost;
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
            onClick={() => setFilter("ratio")}
            className={"px-3 py-1 rounded text-sm " + (filter === "ratio" ? "bg-blue-500" : "bg-gray-700 hover:bg-gray-600")}
          >
            У/С
          </button>
          <button
            onClick={() => setFilter("cost")}
            className={"px-3 py-1 rounded text-sm " + (filter === "cost" ? "bg-blue-500" : "bg-gray-700 hover:bg-gray-600")}
          >
            Стоимость
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
                  <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
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
                <p className="text-xs text-yellow-400">Стоимость: {p.cost} ₽</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}