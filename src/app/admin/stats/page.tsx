"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/utils/api/auth-fetch";

interface Stat {
  id: string;
  user_id: string;
  nickname: string;
  game_id: string;
  kills: number;
  matches_played: number;
  screenshot_url: string | null;
  status: string;
  created_at: string;
}

export default function AdminStatsPage() {
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadStats = useCallback(async () => {
    const response = await authFetch("/api/admin/stats");
    const payload = await response.json() as { stats?: Stat[] };
    if (response.ok) setStats(payload.stats ?? []);
    else setMessage("Не удалось загрузить статистику.");
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadStats(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadStats]);

  const moderate = async (stat: Stat, status: "approved" | "rejected", corrected = false) => {
    let kills: number | undefined;
    let matches: number | undefined;
    let note = "";
    if (corrected) {
      const killsInput = window.prompt("Подтверждённые киллы:", String(stat.kills));
      const matchesInput = window.prompt("Подтверждённые матчи:", String(stat.matches_played));
      if (killsInput === null || matchesInput === null) return;
      kills = Number(killsInput);
      matches = Number(matchesInput);
      note = window.prompt("Комментарий к исправлению:", "") ?? "";
    } else if (status === "rejected") {
      note = window.prompt("Причина отклонения:", "") ?? "";
    }
    const response = await authFetch("/api/admin/stats", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: stat.id, status, kills, matches, note }),
    });
    const payload = await response.json();
    if (!response.ok) { setMessage(payload.error ?? "Не удалось сохранить решение."); return; }
    setStats((current) => current.map((item) => item.id === stat.id ? { ...item, ...payload.stat } : item));
    setMessage(status === "approved" ? "Статистика подтверждена." : "Статистика отклонена.");
  };

  return (
    <div className="min-h-screen p-4 md:p-7">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div><span className="section-kicker">АДМИН-ПАНЕЛЬ</span><h1 className="mt-2 text-3xl font-black">Модерация статистики</h1></div>
        <Link href="/admin/stats/import" className="secondary-button">Excel-импорт и откат</Link>
      </div>
      {message && <p className="mb-4 rounded-xl bg-slate-950/50 p-3">{message}</p>}
      {loading ? <p>Загрузка...</p> : (
        <div className="space-y-3">
          {stats.map((stat) => (
            <article key={stat.id} className="cyber-card flex flex-wrap items-center justify-between gap-4 p-4">
              <div>
                <Link href={`/profile/${stat.user_id}`} className="font-semibold text-cyan-300">{stat.nickname}</Link>
                <p className="text-xs text-slate-500">Game ID: {stat.game_id}</p>
                <p className="text-sm text-slate-300">Киллы: {stat.kills} · Матчи: {stat.matches_played}</p>
                {stat.screenshot_url && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {stat.screenshot_url.split(",").filter(Boolean).map((url, index) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-cyan-300">Скриншот {index + 1}</a>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-xs text-slate-500">{stat.status === "pending" ? "На проверке" : stat.status === "approved" ? "Подтверждено" : "Отклонено"}</p>
              </div>
              {stat.status === "pending" && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => moderate(stat, "approved")} className="primary-button">Подтвердить</button>
                  <button type="button" onClick={() => moderate(stat, "approved", true)} className="secondary-button">Исправить и подтвердить</button>
                  <button type="button" onClick={() => moderate(stat, "rejected")} className="secondary-button text-red-300">Отклонить</button>
                </div>
              )}
            </article>
          ))}
          {stats.length === 0 && <p className="text-slate-400">Нет записей.</p>}
        </div>
      )}
      <Link href="/admin" className="mt-6 block text-cyan-300 hover:underline">← Админ-панель</Link>
    </div>
  );
}
