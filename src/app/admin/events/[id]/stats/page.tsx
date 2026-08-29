"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function EventStatsModerationPage() {
  const { id } = useParams();
  const supabase = createClient();
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const { data } = await supabase
        .from("player_stats")
        .select("*")
        .eq("event_id", id)
        .order("created_at", { ascending: false });
      if (data) {
        const enriched = await Promise.all(
          data.map(async (s) => {
            const { data: profile } = await supabase
              .from("profiles")
              .select("nickname")
              .eq("id", s.user_id)
              .single();
            return { ...s, nickname: profile?.nickname || "—" };
          })
        );
        setStats(enriched);
      }
      setLoading(false);
    };
    fetchStats();
  }, [id]);

  const approve = async (statId: string) => {
    await supabase.from("player_stats").update({ status: "approved", moderator_id: (await supabase.auth.getUser()).data.user?.id }).eq("id", statId);
    setStats(stats.map(s => s.id === statId ? { ...s, status: "approved" } : s));
  };

  const reject = async (statId: string) => {
    await supabase.from("player_stats").update({ status: "rejected", moderator_id: (await supabase.auth.getUser()).data.user?.id }).eq("id", statId);
    setStats(stats.map(s => s.id === statId ? { ...s, status: "rejected" } : s));
  };

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-6 text-red-500">Модерация статистики</h1>
      {loading ? <p>Загрузка...</p> : stats.length === 0 ? (
        <p className="text-gray-400">Нет запросов на статистику.</p>
      ) : (
        <div className="space-y-3">
          {stats.map((s) => (
            <div key={s.id} className="bg-gray-800 p-4 rounded">
              <div className="flex justify-between items-start">
                <div>
                  <Link href={`/profile/${s.user_id}`} className="text-blue-400 hover:underline font-semibold">
                    {s.nickname}
                  </Link>
                  <p className="text-sm text-gray-400">Киллы: {s.kills} | Матчи: {s.matches_played}</p>
                  {s.screenshot_url && (
                    <div className="flex gap-2 mt-2">
                      {s.screenshot_url.split(",").map((url: string, i: number) => (
                        <a key={i} href={url} target="_blank">
                          <img src={url} alt="Скриншот" className="w-20 h-20 object-cover rounded" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {s.status === "pending" ? (
                    <>
                      <button onClick={() => approve(s.id)} className="px-3 py-1 bg-green-600 rounded text-sm">✓</button>
                      <button onClick={() => reject(s.id)} className="px-3 py-1 bg-red-600 rounded text-sm">✕</button>
                    </>
                  ) : (
                    <span className={s.status === "approved" ? "text-green-400" : "text-red-400"}>
                      {s.status === "approved" ? "✓ Подтверждено" : "✕ Отклонено"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Link href={`/tournaments/${id}`} className="block mt-6 text-blue-400 hover:underline">← К мероприятию</Link>
    </div>
  );
}