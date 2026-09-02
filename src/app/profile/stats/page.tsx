"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authFetch } from "@/utils/api/auth-fetch";

interface PlayerStat {
  id: string;
  event_id: string | null;
  event_title: string | null;
  session_start: string | null;
  kills: number;
  matches_played: number;
  status: "pending" | "approved" | "rejected";
  correction_note: string | null;
  created_at: string;
}

const statusMeta = {
  approved: { label: "Подтверждено", className: "badge badge-green" },
  rejected: { label: "Отклонено", className: "badge badge-red" },
  pending: { label: "На проверке", className: "badge badge-yellow" },
} as const;

export default function MyStatsPage() {
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const response = await authFetch("/api/profile/stats");
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Не удалось загрузить статистику");
        setStats((payload.stats ?? []) as PlayerStat[]);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить статистику");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <div className="page-shell">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/profile" className="mb-3 inline-flex text-sm text-cyan-300 hover:text-cyan-200">← Вернуться в профиль</Link>
          <p className="eyebrow">Личный кабинет</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">История статистики</h1>
        </div>
        <Link href="/tournaments" className="btn-primary">Выбрать мероприятие</Link>
      </div>

      <div className="panel mb-6 p-5 text-sm text-slate-400">
        Статистика отправляется со страницы конкретного мероприятия после начала сессии. Можно приложить до пяти скриншотов JPEG, PNG или WebP по 5 МБ.
      </div>

      {loading ? <p className="text-slate-400">Загрузка…</p> : error ? (
        <div className="panel border-red-500/30 p-5 text-red-200">{error}</div>
      ) : stats.length === 0 ? (
        <div className="panel p-8 text-center"><p className="text-slate-400">Вы ещё не отправляли результаты.</p><Link href="/tournaments" className="btn-primary mt-5">Открыть расписание</Link></div>
      ) : (
        <div className="space-y-3">
          {stats.map((stat) => {
            const status = statusMeta[stat.status] ?? statusMeta.pending;
            const content = (
              <article className="panel grid gap-4 p-5 transition hover:border-cyan-400/30 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-white">{stat.event_title || "Мероприятие"}</h2><span className={status.className}>{status.label}</span></div>
                  <p className="mt-2 text-sm text-slate-400">{stat.session_start ? new Date(stat.session_start).toLocaleString("ru-RU") : new Date(stat.created_at).toLocaleString("ru-RU")}</p>
                  {stat.correction_note && <p className="mt-2 text-sm text-amber-200">Комментарий модератора: {stat.correction_note}</p>}
                </div>
                <div className="flex gap-6 sm:text-right"><div><p className="text-xs uppercase tracking-wider text-slate-500">Киллы</p><p className="text-2xl font-black">{stat.kills}</p></div><div><p className="text-xs uppercase tracking-wider text-slate-500">Матчи</p><p className="text-2xl font-black">{stat.matches_played}</p></div></div>
              </article>
            );
            return stat.event_id ? <Link key={stat.id} href={`/tournaments/${stat.event_id}`} className="block">{content}</Link> : <div key={stat.id}>{content}</div>;
          })}
        </div>
      )}
    </div>
  );
}
