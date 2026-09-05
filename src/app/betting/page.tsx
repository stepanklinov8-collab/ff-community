"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/utils/api/auth-fetch";

interface Market {
  id: string;
  event_id: string | null;
  game_id: string | null;
  clan_war_id: string | null;
  subject_team_name: string | null;
  mode: "tournament" | "training" | "bo" | "kv";
  market_type: string;
  selection_value: string;
  line: number | null;
  odds: number;
  locks_at: string;
  status: string;
}
interface Bet {
  id: string;
  market_id: string;
  stake: number;
  odds: number;
  potential_payout: number;
  status: string;
  payout: number;
  placed_at: string;
}
const marketLabels: Record<string, string> = {
  kills_over: "Убийства — больше",
  kills_under: "Убийства — меньше",
  exact_place: "Точное место",
  win: "Победа",
  loss: "Поражение",
  exact_score: "Точный счёт",
};
const modeLabels = { tournament: "Турнир", training: "Тренировка", bo: "БО", kv: "КВ" };

export default function BettingPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [balance, setBalance] = useState(0);
  const [stakes, setStakes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await authFetch("/api/betting");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Войдите в аккаунт");
      setMarkets(payload.markets ?? []);
      setBets(payload.bets ?? []);
      setBalance(payload.balance ?? 0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить ставки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const place = async (market: Market) => {
    const stake = Number(stakes[market.id]);
    if (!Number.isInteger(stake) || stake <= 0) {
      setMessage("Введите целое количество монет");
      return;
    }
    setMessage("Принимаем ставку…");
    const response = await authFetch("/api/betting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketId: market.id, stake }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error || "Не удалось принять ставку");
      return;
    }
    setMessage("Ставка принята. Коэффициент зафиксирован.");
    setStakes((current) => ({ ...current, [market.id]: "" }));
    await load();
  };

  return (
    <div className="page-shell">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="section-kicker">ВИРТУАЛЬНЫЕ ПРОГНОЗЫ</span>
          <h1 className="mt-2 text-3xl font-black">Ставки</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Только внутренние монеты: без покупки, вывода и переводов. Все рынки закрываются до начала всего мероприятия.
          </p>
        </div>
        <div className="cyber-card px-5 py-3"><span className="text-sm text-slate-400">Баланс</span><p className="text-2xl font-black text-amber-300">{balance} монет</p></div>
      </div>

      {message && <p className="mb-4 rounded-xl border border-cyan-800/40 bg-cyan-950/20 p-3 text-sm">{message}</p>}
      {loading ? <p className="text-slate-400">Загрузка…</p> : markets.length === 0 ? (
        <section className="cyber-card p-8 text-center">
          <h2 className="text-xl font-bold">Открытых рынков пока нет</h2>
          <p className="mt-2 text-slate-400">Они появятся после публикации коэффициентов администратором.</p>
          <Link href="/tournaments" className="mt-5 inline-flex text-cyan-300 hover:underline">Посмотреть мероприятия</Link>
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {markets.map((market) => {
            const existing = bets.find((bet) => bet.market_id === market.id);
            const value = market.market_type.startsWith("kills_") ? market.line : market.selection_value;
            return (
              <article key={market.id} className="cyber-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="section-kicker">{modeLabels[market.mode]}</span>
                    <h2 className="mt-1 text-lg font-bold">{market.subject_team_name || "Исход мероприятия"}</h2>
                    <p className="mt-1 text-sm text-slate-400">{marketLabels[market.market_type] ?? market.market_type}: <strong className="text-slate-200">{value}</strong></p>
                  </div>
                  <div className="rounded-xl bg-amber-400/10 px-3 py-2 text-xl font-black text-amber-300">×{Number(market.odds).toFixed(2)}</div>
                </div>
                <p className="mt-3 text-xs text-slate-500">Закрытие: {new Date(market.locks_at).toLocaleString("ru-RU")}</p>
                {existing ? (
                  <div className="mt-4 rounded-xl bg-white/[.04] p-3 text-sm">
                    Ставка {existing.stake} · возможная выплата {existing.potential_payout} · {existing.status}
                  </div>
                ) : market.status === "open" ? (
                  <div className="mt-4 flex gap-2">
                    <input type="number" min={1} step={1} value={stakes[market.id] ?? ""} onChange={(event) => setStakes((current) => ({ ...current, [market.id]: event.target.value }))} placeholder="Сумма" />
                    <button type="button" className="primary-button whitespace-nowrap" onClick={() => void place(market)}>Поставить</button>
                  </div>
                ) : <p className="mt-4 text-sm text-slate-500">Приём ставок закрыт</p>}
              </article>
            );
          })}
        </div>
      )}

      {bets.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-xl font-bold">Мои ставки</h2>
          <div className="space-y-2">{bets.map((bet) => <div key={bet.id} className="cyber-card flex flex-wrap justify-between gap-3 p-3 text-sm"><span>{new Date(bet.placed_at).toLocaleString("ru-RU")} · {bet.stake} монет ×{Number(bet.odds).toFixed(2)}</span><span className="text-cyan-300">{bet.status} · выплата {bet.payout || bet.potential_payout}</span></div>)}</div>
        </section>
      )}
    </div>
  );
}
