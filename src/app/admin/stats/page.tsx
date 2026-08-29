"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

interface Stat {
  id: string;
  user_id: string;
  kills: number;
  matches_played: number;
  screenshot_url: string;
  status: string;
  created_at: string;
}

export default function AdminStatsPage() {
  const supabase = createClient();
  const [stats, setStats] = useState<Stat[]>([]);
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchStats = async () => {
      const { data } = await supabase
        .from("player_stats")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setStats(data);
      setLoading(false);
    };
    fetchStats();
  }, []);

  useEffect(() => {
    const loadNicknames = async () => {
      const result: Record<string, string> = {};
      for (const stat of stats) {
        if (!result[stat.user_id]) {
          const { data } = await supabase
            .from("profiles")
            .select("nickname")
            .eq("id", stat.user_id)
            .single();
          result[stat.user_id] = data?.nickname || "—";
        }
      }
      setNicknames(result);
    };
    if (stats.length) loadNicknames();
  }, [stats]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("player_stats").update({ status }).eq("id", id);
    setStats(stats.map(s => s.id === id ? { ...s, status } : s));
    setMessage(`Запись ${status === "approved" ? "подтверждена" : "отклонена"}.`);
  };

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-6 text-red-500">Модерация статистики</h1>
      {message && <div className="mb-4 p-3 bg-gray-800 rounded">{message}</div>}

      {loading ? <p>Загрузка...</p> : (
        <div className="space-y-3">
          {stats.map(stat => (
            <div key={stat.id} className="bg-gray-800 p-4 rounded flex justify-between items-center">
              <div>
                <p className="font-semibold">{nicknames[stat.user_id] || "—"}</p>
                <p className="text-sm text-gray-400">
                  Киллы: {stat.kills} | Матчи: {stat.matches_played}
                </p>
                {stat.screenshot_url && (
                  <a href={stat.screenshot_url} target="_blank" className="text-blue-400 text-sm">
                    Скриншот
                  </a>
                )}
                <p className="text-xs text-gray-500">
                  Статус: {stat.status === "pending" ? "⏳ На проверке" : stat.status === "approved" ? "✅ Подтверждено" : "❌ Отклонено"}
                </p>
              </div>
              {stat.status === "pending" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => updateStatus(stat.id, "approved")}
                    className="px-3 py-1 bg-green-600 rounded text-sm"
                  >
                    Подтвердить
                  </button>
                  <button
                    onClick={() => updateStatus(stat.id, "rejected")}
                    className="px-3 py-1 bg-red-600 rounded text-sm"
                  >
                    Отклонить
                  </button>
                </div>
              )}
            </div>
          ))}
          {stats.length === 0 && <p className="text-gray-400">Нет записей.</p>}
        </div>
      )}

      <Link href="/admin" className="block mt-6 text-blue-400 hover:underline">← Админ-панель</Link>
    </div>
  );
}