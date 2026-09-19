"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "@/utils/api/auth-fetch";

interface TeamSummary {
  id: string;
  name: string;
  type: string;
  avatar_url: string | null;
}

interface AdminClanWar {
  id: string;
  title: string;
  format: number;
  challenge_kind: "open" | "direct";
  status: "open" | "pending" | "agreed" | "completed" | "cancelled";
  scheduled_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  is_hidden: boolean;
  hidden_at: string | null;
  creator_team: TeamSummary | null;
  opponent_team: TeamSummary | null;
  can_delete: boolean;
}

const statusLabels: Record<AdminClanWar["status"], string> = {
  open: "Открытое",
  pending: "Ожидает ответа",
  agreed: "Согласовано",
  completed: "Завершено",
  cancelled: "Отменено",
};

type Filter = "all" | "visible" | "hidden";

export default function AdminClanWarsPage() {
  const [wars, setWars] = useState<AdminClanWar[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const loadWars = useCallback(async () => {
    setLoading(true);
    setError("");
    const response = await authFetch("/api/admin/clan-wars");
    const payload = await response.json() as { clanWars?: AdminClanWar[]; error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Не удалось загрузить КВ");
      setWars([]);
    } else {
      setWars(payload.clanWars ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadWars(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadWars]);

  const filteredWars = useMemo(() => wars.filter((war) => {
    if (filter === "visible") return !war.is_hidden;
    if (filter === "hidden") return war.is_hidden;
    return true;
  }), [filter, wars]);

  const changeVisibility = async (war: AdminClanWar) => {
    setBusyId(war.id);
    setError("");
    setMessage("");
    const nextHidden = !war.is_hidden;
    const response = await authFetch("/api/admin/clan-wars", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: war.id, isHidden: nextHidden }),
    });
    const payload = await response.json() as { error?: string; clanWar?: Pick<AdminClanWar, "is_hidden" | "hidden_at"> };
    if (!response.ok) {
      setError(payload.error ?? "Не удалось изменить видимость КВ");
    } else {
      setWars((current) => current.map((item) => item.id === war.id
        ? { ...item, is_hidden: nextHidden, hidden_at: payload.clanWar?.hidden_at ?? null }
        : item));
      setMessage(nextHidden ? "КВ скрыто с сайта." : "КВ снова опубликовано на сайте.");
    }
    setBusyId(null);
  };

  const deleteWar = async (war: AdminClanWar) => {
    if (!war.can_delete) return;
    if (!window.confirm(`Удалить КВ «${war.title}» навсегда? Это действие нельзя отменить.`)) return;
    setBusyId(war.id);
    setError("");
    setMessage("");
    const response = await authFetch(`/api/admin/clan-wars?id=${encodeURIComponent(war.id)}`, { method: "DELETE" });
    const payload = await response.json() as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Не удалось удалить КВ");
    } else {
      setWars((current) => current.filter((item) => item.id !== war.id));
      setMessage("КВ удалено.");
    }
    setBusyId(null);
  };

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/admin" className="text-sm text-cyan-400 hover:underline">← Админ-панель</Link>
            <h1 className="mt-2 text-3xl font-bold text-red-400">Управление КВ</h1>
            <p className="mt-1 text-sm text-gray-400">Скрывайте ошибочные и старые записи или удаляйте КВ без итоговой статистики.</p>
          </div>
          <button
            type="button"
            onClick={() => void loadWars()}
            disabled={loading}
            className="rounded bg-slate-700 px-4 py-2 hover:bg-slate-600 disabled:opacity-50"
          >
            Обновить
          </button>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {(["all", "visible", "hidden"] as Filter[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded px-4 py-2 text-sm ${filter === value ? "bg-cyan-700" : "bg-gray-800 hover:bg-gray-700"}`}
            >
              {value === "all" ? `Все (${wars.length})` : value === "visible"
                ? `На сайте (${wars.filter((war) => !war.is_hidden).length})`
                : `Скрытые (${wars.filter((war) => war.is_hidden).length})`}
            </button>
          ))}
        </div>

        {message && <div className="mb-4 rounded border border-emerald-700 bg-emerald-950/40 p-3 text-emerald-300">{message}</div>}
        {error && <div className="mb-4 rounded border border-red-800 bg-red-950/40 p-3 text-red-300">{error}</div>}

        {loading ? (
          <p className="text-gray-400">Загрузка КВ...</p>
        ) : filteredWars.length === 0 ? (
          <div className="rounded-lg bg-gray-900 p-6 text-gray-400">В этом разделе КВ нет.</div>
        ) : (
          <div className="space-y-3">
            {filteredWars.map((war) => (
              <article key={war.id} className={`rounded-lg border p-4 ${war.is_hidden ? "border-amber-700/60 bg-amber-950/20" : "border-gray-700 bg-gray-900"}`}>
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="break-words text-lg font-semibold">{war.title}</h2>
                      <span className={`rounded px-2 py-0.5 text-xs ${war.is_hidden ? "bg-amber-700 text-white" : "bg-emerald-800 text-emerald-100"}`}>
                        {war.is_hidden ? "Скрыто" : "На сайте"}
                      </span>
                      <span className="rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-200">{statusLabels[war.status]}</span>
                    </div>
                    <p className="mt-2 text-sm text-gray-300">
                      {war.creator_team?.name ?? "Удалённая команда"} <span className="text-gray-500">против</span> {war.opponent_team?.name ?? "соперник не выбран"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {war.format}×{war.format} · {war.challenge_kind === "open" ? "открытый вызов" : "адресный вызов"} · создано {new Date(war.created_at).toLocaleString("ru-RU")}
                    </p>
                    {war.is_hidden && war.hidden_at && (
                      <p className="mt-1 text-xs text-amber-400">Скрыто {new Date(war.hidden_at).toLocaleString("ru-RU")}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link href={`/clan-wars/${war.id}`} className="rounded bg-blue-700 px-3 py-2 text-sm hover:bg-blue-600">
                      Открыть
                    </Link>
                    <button
                      type="button"
                      onClick={() => void changeVisibility(war)}
                      disabled={busyId === war.id}
                      className={`rounded px-3 py-2 text-sm disabled:opacity-50 ${war.is_hidden ? "bg-emerald-700 hover:bg-emerald-600" : "bg-amber-700 hover:bg-amber-600"}`}
                    >
                      {war.is_hidden ? "Показать" : "Скрыть"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteWar(war)}
                      disabled={busyId === war.id || !war.can_delete}
                      title={war.can_delete ? "Удалить КВ навсегда" : "Завершённое КВ можно только скрыть"}
                      className="rounded bg-red-700 px-3 py-2 text-sm hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
                {!war.can_delete && (
                  <p className="mt-3 text-xs text-gray-500">Завершённое КВ нельзя удалить, потому что его результат уже участвует в статистике. Его можно скрыть.</p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
