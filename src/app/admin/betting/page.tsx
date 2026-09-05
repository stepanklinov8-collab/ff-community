"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "@/utils/api/auth-fetch";

type Item = Record<string, unknown>;
type EconomySettings = {
  currency_name: string;
  starting_balance: number;
  minimum_stake: number;
  maximum_stake: number;
  maximum_odds: number;
};
const marketOptions = [
  ["kills_over", "Убийства больше"], ["kills_under", "Убийства меньше"],
  ["exact_place", "Точное место"], ["win", "Победа"],
  ["loss", "Поражение"], ["exact_score", "Точный счёт"],
] as const;

export default function AdminBettingPage() {
  const [data, setData] = useState<{ markets: Item[]; events: Item[]; wars: Item[]; teams: Item[]; games: Item[]; settings: EconomySettings | null; isOwner: boolean }>({ markets: [], events: [], wars: [], teams: [], games: [], settings: null, isOwner: false });
  const [source, setSource] = useState("");
  const [teamId, setTeamId] = useState("");
  const [gameId, setGameId] = useState("");
  const [marketType, setMarketType] = useState("kills_over");
  const [selectionValue, setSelectionValue] = useState("over");
  const [line, setLine] = useState("6.5");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await authFetch("/api/admin/betting");
    const payload = await response.json();
    if (response.ok) setData(payload);
    else setMessage(payload.error || "Не удалось загрузить рынки");
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const selectedEvent = useMemo(() => data.events.find((item) => "event:" + String(item.id) === source), [data.events, source]);
  const games = selectedEvent ? data.games.filter((item) => item.event_id === selectedEvent.id) : [];

  const createMarket = async () => {
    const isWar = source.startsWith("war:");
    const response = await authFetch("/api/admin/betting", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create", eventId: isWar ? null : source.replace("event:", "") || null,
        clanWarId: isWar ? source.replace("war:", "") : null, gameId: gameId || null,
        subjectTeamId: teamId, marketType, selectionValue,
        line: marketType.startsWith("kills_") ? Number(line) : null,
      }),
    });
    const payload = await response.json();
    setMessage(response.ok ? "Рынок создан, коэффициент ×" + Number(payload.market?.odds).toFixed(2) : payload.error || "Ошибка");
    if (response.ok) await load();
  };

  const settle = async (marketId: string, outcome: "won" | "lost" | "void") => {
    const response = await authFetch("/api/admin/betting", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "settle", marketId, outcome }),
    });
    const payload = await response.json();
    setMessage(response.ok ? "Рынок рассчитан" : payload.error || "Не удалось рассчитать рынок");
    if (response.ok) await load();
  };

  const saveSettings = async () => {
    const read = (id: string) => (document.getElementById(id) as HTMLInputElement).value;
    const response = await authFetch("/api/admin/betting", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "settings",
        currencyName: read("currency-name"),
        startingBalance: Number(read("starting-balance")),
        minimumStake: Number(read("minimum-stake")),
        maximumStake: Number(read("maximum-stake")),
        maximumOdds: Number(read("maximum-odds")),
      }),
    });
    const payload = await response.json();
    setMessage(response.ok ? "Настройки валюты и ставок сохранены" : payload.error || "Не удалось сохранить настройки");
    if (response.ok) await load();
  };

  return (
    <div className="page-shell">
      <span className="section-kicker">АДМИН-ПАНЕЛЬ</span>
      <h1 className="mb-6 mt-2 text-3xl font-black">Рынки и коэффициенты ставок</h1>
      {message && <p className="mb-4 rounded-xl bg-white/[.05] p-3 text-sm">{message}</p>}
      {data.isOwner && data.settings && <section className="cyber-card mb-6 p-5">
        <h2 className="mb-3 text-lg font-bold">Настройки виртуальной валюты</h2>
        <p className="mb-4 text-xs text-slate-500">Валюта не покупается, не продаётся, не переводится и не выводится в реальные деньги.</p>
        <div className="grid gap-3 md:grid-cols-5">
          <label className="text-xs text-slate-400">Название<input id="currency-name" defaultValue={data.settings.currency_name} /></label>
          <label className="text-xs text-slate-400">Стартовый баланс<input id="starting-balance" type="number" min="0" defaultValue={data.settings.starting_balance} /></label>
          <label className="text-xs text-slate-400">Мин. ставка<input id="minimum-stake" type="number" min="1" defaultValue={data.settings.minimum_stake} /></label>
          <label className="text-xs text-slate-400">Макс. ставка<input id="maximum-stake" type="number" min="1" defaultValue={data.settings.maximum_stake} /></label>
          <label className="text-xs text-slate-400">Макс. коэффициент<input id="maximum-odds" type="number" min="1.01" step=".01" defaultValue={data.settings.maximum_odds} /></label>
        </div>
        <button className="secondary-button mt-4" type="button" onClick={() => void saveSettings()}>Сохранить настройки</button>
      </section>}
      <section className="cyber-card grid gap-4 p-5 md:grid-cols-2">
        <label className="text-sm text-slate-400">Мероприятие или КВ
          <select className="mt-1" value={source} onChange={(event) => { setSource(event.target.value); setGameId(""); }}>
            <option value="">Выберите</option>
            {data.events.map((item) => <option key={"e-" + String(item.id)} value={"event:" + String(item.id)}>{String(item.title)} · {String(item.type)}</option>)}
            {data.wars.map((item) => <option key={"w-" + String(item.id)} value={"war:" + String(item.id)}>КВ · {String(item.title)}</option>)}
          </select>
        </label>
        <label className="text-sm text-slate-400">Команда
          <select className="mt-1" value={teamId} onChange={(event) => setTeamId(event.target.value)}>
            <option value="">Выберите</option>
            {data.teams.map((team) => <option key={String(team.id)} value={String(team.id)}>{String(team.name)} · рейтинг {String(team.main_rating ?? 1)}</option>)}
          </select>
        </label>
        {games.length > 0 && <label className="text-sm text-slate-400">Игра
          <select className="mt-1" value={gameId} onChange={(event) => setGameId(event.target.value)}>
            <option value="">Выберите</option>
            {games.map((game) => <option key={String(game.id)} value={String(game.id)}>Игра {String(game.game_number)} · {String(game.map_name)}</option>)}
          </select>
        </label>}
        <label className="text-sm text-slate-400">Рынок
          <select className="mt-1" value={marketType} onChange={(event) => setMarketType(event.target.value)}>
            {marketOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {marketType.startsWith("kills_") && <label className="text-sm text-slate-400">Линия убийств (с ,5)<input className="mt-1" type="number" step="1" value={line} onChange={(event) => setLine(event.target.value)} /></label>}
        <label className="text-sm text-slate-400">Выбор/значение
          <input className="mt-1" value={selectionValue} onChange={(event) => setSelectionValue(event.target.value)} placeholder={marketType === "exact_score" ? "7:3" : marketType === "exact_place" ? "1" : "win"} />
        </label>
        <button className="primary-button md:col-span-2" type="button" disabled={!source || !teamId} onClick={() => void createMarket()}>Рассчитать и открыть рынок</button>
      </section>
      <section className="mt-8">
        <h2 className="mb-3 text-xl font-bold">Созданные рынки</h2>
        <div className="space-y-2">{data.markets.map((market) => <article key={String(market.id)} className="cyber-card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <div><strong>{String(market.subject_team_name)}</strong><p className="text-slate-400">{String(market.mode)} · {String(market.market_type)} · {String(market.selection_value)} · ×{String(market.odds)} · {String(market.status)}</p></div>
          {!["settled", "void"].includes(String(market.status)) && <div className="flex gap-2"><button className="rounded bg-emerald-700 px-3 py-1" onClick={() => void settle(String(market.id), "won")}>Выиграл</button><button className="rounded bg-red-800 px-3 py-1" onClick={() => void settle(String(market.id), "lost")}>Проиграл</button><button className="rounded bg-slate-700 px-3 py-1" onClick={() => void settle(String(market.id), "void")}>Возврат</button></div>}
        </article>)}</div>
      </section>
      <Link href="/admin" className="mt-6 inline-flex text-cyan-300 hover:underline">← Админ-панель</Link>
    </div>
  );
}
