"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { authFetch } from "@/utils/api/auth-fetch";

interface Stat {
  id: string;
  user_id: string;
  nickname: string;
  kills: number;
  matches_played: number;
  screenshot_url: string | null;
  status: string;
}

export default function EventStatsModerationPage() {
  const { id } = useParams<{ id: string }>();
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadStats = useCallback(async () => {
    const response = await authFetch(`/api/admin/stats?eventId=${encodeURIComponent(id)}`);
    const payload = await response.json() as { stats?: Stat[] };
    if (response.ok) setStats(payload.stats ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadStats(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadStats]);

  const updateStatus = async (statId: string, status: "approved" | "rejected") => {
    const note = status === "rejected" ? window.prompt("Причина отклонения:", "") ?? "" : "";
    const response = await authFetch("/api/admin/stats", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: statId, status, note }),
    });
    const payload = await response.json();
    if (!response.ok) { setMessage(payload.error ?? "Не удалось сохранить решение."); return; }
    setStats((current) => current.map((stat) => stat.id === statId ? { ...stat, status } : stat));
  };

  return (
    <div className="min-h-screen p-4 md:p-7">
      <span className="section-kicker">АДМИН-ПАНЕЛЬ</span>
      <h1 className="mb-6 mt-2 text-3xl font-black">Статистика мероприятия</h1>
      {message && <p className="mb-4 rounded-xl bg-slate-950/50 p-3">{message}</p>}
      {loading ? <p>Загрузка...</p> : stats.length === 0 ? <p className="text-slate-400">Нет отправленных результатов.</p> : (
        <div className="space-y-3">
          {stats.map((stat) => (
            <article key={stat.id} className="cyber-card flex flex-wrap items-start justify-between gap-4 p-4">
              <div>
                <Link href={`/profile/${stat.user_id}`} className="font-semibold text-cyan-300">{stat.nickname}</Link>
                <p className="text-sm text-slate-400">Киллы: {stat.kills} · Матчи: {stat.matches_played}</p>
                {stat.screenshot_url && <div className="mt-2 flex flex-wrap gap-2">{stat.screenshot_url.split(",").filter(Boolean).map((url) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer"><Image src={url} alt="Подтверждение статистики" width={80} height={80} unoptimized className="size-20 rounded-lg object-cover" /></a>
                ))}</div>}
              </div>
              {stat.status === "pending" ? <div className="flex gap-2">
                <button type="button" onClick={() => updateStatus(stat.id, "approved")} className="primary-button">Подтвердить</button>
                <button type="button" onClick={() => updateStatus(stat.id, "rejected")} className="secondary-button text-red-300">Отклонить</button>
              </div> : <span className={stat.status === "approved" ? "text-emerald-300" : "text-red-300"}>{stat.status === "approved" ? "Подтверждено" : "Отклонено"}</span>}
            </article>
          ))}
        </div>
      )}
      <Link href={`/tournaments/${id}`} className="mt-6 block text-cyan-300 hover:underline">← К мероприятию</Link>
    </div>
  );
}
