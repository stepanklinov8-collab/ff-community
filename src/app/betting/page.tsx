"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "@/utils/api/auth-fetch";
import { useLanguage } from "@/components/LanguageProvider";

type Mode = "tournament" | "training" | "bo" | "kv";
type MarketType = "kills_over" | "kills_under" | "exact_place" | "win" | "loss" | "exact_score";
type Game = { id: string; session_id: string; game_number: number; map_name: string };
type Team = { id: string; name: string; main_rating: number; sessionIds?: string[] };
type Source = { id: string; title: string; mode: Mode; locksAt: string; games: Game[]; teams: Team[] };
type Preview = {
  sourceId: string;
  sourceTitle: string;
  teamId: string;
  teamName: string;
  gameId: string | null;
  marketType: MarketType;
  line: number | null;
  available: boolean;
  odds?: number;
  message?: string;
};
type BetMarket = { subject_team_name: string | null; market_type: string; selection_value: string; line: number | null; mode: string };
type Bet = {
  id: string;
  market_id: string;
  stake: number;
  odds: number;
  potential_payout: number;
  status: string;
  payout: number;
  placed_at: string;
  betting_markets: BetMarket | BetMarket[] | null;
};
type Quote = { available: boolean; quoteId?: string; odds?: number; expiresAt?: string; message?: string };
type PageData = {
  balance: number;
  currencyName: string;
  minimumStake: number;
  maximumStake: number;
  sources: Source[];
  previews: Preview[];
  bets: Bet[];
};

const mapLabels: Record<string, string> = {
  bermuda: "Бермуды", nexterra: "Некстера", solara: "Солара", purgatory: "Чистилище", kalahari: "Калахари",
};

const initialData: PageData = {
  balance: 0,
  currencyName: "Монеты Арены",
  minimumStake: 10,
  maximumStake: 200,
  sources: [],
  previews: [],
  bets: [],
};

export default function BettingPage() {
  const { t, formatDate } = useLanguage();
  const [data, setData] = useState<PageData>(initialData);
  const [sourceId, setSourceId] = useState("");
  const [gameId, setGameId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [marketType, setMarketType] = useState<MarketType>("kills_over");
  const [selectionValue, setSelectionValue] = useState("1");
  const [line, setLine] = useState("6.5");
  const [stake, setStake] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await authFetch("/api/betting");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || t("betting.signIn"));
      setData(payload);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("betting.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!quote?.expiresAt) return;
    const update = () => setSecondsLeft(Math.max(0, Math.ceil((new Date(quote.expiresAt!).getTime() - Date.now()) / 1000)));
    const initialTimer = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [quote]);

  const selectedSource = useMemo(() => data.sources.find((source) => source.id === sourceId) ?? null, [data.sources, sourceId]);
  const selectedGame = useMemo(() => selectedSource?.games.find((game) => game.id === gameId) ?? null, [gameId, selectedSource]);
  const availableTeams = useMemo(() => {
    if (!selectedSource) return [];
    if (!selectedGame) return selectedSource.teams;
    return selectedSource.teams.filter((team) => !team.sessionIds || team.sessionIds.includes(selectedGame.session_id));
  }, [selectedGame, selectedSource]);
  const isClassic = selectedSource?.mode === "tournament" || selectedSource?.mode === "training";
  const marketLabels: Record<MarketType, string> = {
    kills_over: t("betting.killsOver"), kills_under: t("betting.killsUnder"), exact_place: t("betting.exactPlace"),
    win: t("betting.win"), loss: t("betting.loss"), exact_score: t("betting.exactScore"),
  };
  const modeLabels: Record<Mode, string> = { tournament: t("event.tournament"), training: t("event.training"), bo: "БО", kv: "КВ" };
  const marketOptions: [MarketType, string][] = isClassic
    ? [["exact_place", marketLabels.exact_place], ["kills_over", marketLabels.kills_over], ["kills_under", marketLabels.kills_under]]
    : [["win", marketLabels.win], ["loss", marketLabels.loss], ["kills_over", marketLabels.kills_over], ["kills_under", marketLabels.kills_under], ["exact_score", marketLabels.exact_score]];

  const resetQuote = () => {
    setQuote(null);
    setSecondsLeft(0);
  };

  const changeSource = (nextSourceId: string) => {
    const source = data.sources.find((item) => item.id === nextSourceId);
    const firstGame = source?.games[0];
    const firstTeam = firstGame
      ? source?.teams.find((team) => !team.sessionIds || team.sessionIds.includes(firstGame.session_id))
      : source?.teams[0];
    setSourceId(nextSourceId);
    setGameId(firstGame?.id ?? "");
    setTeamId(firstTeam?.id ?? "");
    setMarketType(source?.mode === "tournament" || source?.mode === "training" ? "exact_place" : "win");
    setSelectionValue(source?.mode === "tournament" || source?.mode === "training" ? "1" : "win");
    resetQuote();
  };

  const requestQuote = async () => {
    if (!sourceId || !teamId || (isClassic && !gameId)) {
      setMessage(t("betting.selectRequired"));
      return;
    }
    setBusy(true);
    setMessage(t("betting.loadingQuote"));
    const response = await authFetch("/api/betting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "quote",
        sourceId,
        gameId: isClassic ? gameId : null,
        teamId,
        marketType,
        selectionValue: marketType === "exact_place" || marketType === "exact_score" ? selectionValue : marketType,
        line: marketType.startsWith("kills_") ? Number(line) : null,
      }),
    });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok) {
      resetQuote();
      setMessage(payload.error || t("betting.calculateError"));
      return;
    }
    setQuote(payload);
    setMessage(payload.available ? t("betting.quoteReady") : t("betting.unavailable"));
  };

  const confirmBet = async () => {
    const stakeNumber = Number(stake);
    if (!quote?.available || !quote.quoteId || secondsLeft <= 0) {
      setMessage(t("betting.quoteExpired"));
      return;
    }
    if (!Number.isInteger(stakeNumber) || stakeNumber < data.minimumStake || stakeNumber > data.maximumStake) {
      setMessage(t("betting.stakeRange", { min: data.minimumStake, max: data.maximumStake }));
      return;
    }
    setBusy(true);
    setMessage(t("betting.confirming"));
    const response = await authFetch("/api/betting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm", quoteId: quote.quoteId, stake: stakeNumber }),
    });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok) {
      if (payload.code === "QUOTE_CHANGED" && payload.quote?.available) {
        setQuote(payload.quote);
        setMessage(t("betting.changed", { odds: Number(payload.quote.odds).toFixed(2) }));
      } else {
        resetQuote();
        setMessage(payload.error || t("betting.confirmError"));
      }
      return;
    }
    setMessage(t("betting.accepted"));
    setStake("");
    resetQuote();
    await load();
  };

  return (
    <div className="page-shell">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="section-kicker">{t("betting.eyebrow")}</span>
          <h1 className="mt-2 text-3xl font-black">{t("betting.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">{t("betting.description")}</p>
        </div>
        <div className="cyber-card px-5 py-3"><span className="text-sm text-slate-400">{t("betting.balance")}</span><p className="text-2xl font-black text-amber-300">{data.balance} {data.currencyName}</p></div>
      </div>

      {message && <p className="mb-4 rounded-xl border border-cyan-800/40 bg-cyan-950/20 p-3 text-sm">{message}</p>}
      {loading ? <p className="text-slate-400">{t("common.loading")}</p> : data.sources.length === 0 ? (
        <section className="cyber-card p-8 text-center"><h2 className="text-xl font-bold">{t("betting.noSources")}</h2><p className="mt-2 text-slate-400">{t("betting.noSourcesText")}</p><Link href="/tournaments" className="mt-5 inline-flex text-cyan-300 hover:underline">{t("betting.viewEvents")}</Link></section>
      ) : <>
        {data.previews.length > 0 && <section className="mb-6">
          <h2 className="mb-3 text-xl font-bold">{t("betting.preliminary")}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.previews.map((preview, index) => <button key={`${preview.sourceId}:${preview.teamId}:${index}`} type="button" className="cyber-card p-4 text-left transition hover:border-cyan-500/40" onClick={() => {
              changeSource(preview.sourceId);
              setGameId(preview.gameId ?? "");
              setTeamId(preview.teamId);
              setMarketType(preview.marketType);
              if (preview.line != null) setLine(String(preview.line));
            }}>
              <span className="text-xs text-slate-500">{preview.sourceTitle}</span>
              <strong className="mt-1 block">{preview.teamName}</strong>
              <span className="mt-1 block text-sm text-slate-400">{marketLabels[preview.marketType]}{preview.line != null ? ` ${preview.line}` : ""}</span>
              {preview.available
                ? <span className="mt-2 block text-xl font-black text-amber-300">×{Number(preview.odds).toFixed(2)}</span>
                : <span className="mt-2 block text-xs text-amber-300">{t("betting.unavailableShort")}</span>}
            </button>)}
          </div>
        </section>}

        <section className="cyber-card p-5 md:p-6">
          <h2 className="mb-5 text-xl font-bold">{t("betting.chooseOutcome")}</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm text-slate-400">{t("betting.event")}<select className="mt-1" value={sourceId} onChange={(event) => changeSource(event.target.value)}><option value="">{t("common.choose")}</option>{data.sources.map((source) => <option key={source.id} value={source.id}>{modeLabels[source.mode]} · {source.title}</option>)}</select></label>
            {isClassic && <label className="text-sm text-slate-400">{t("betting.gameMap")}<select className="mt-1" value={gameId} onChange={(event) => { const nextGame = selectedSource?.games.find((game) => game.id === event.target.value); setGameId(event.target.value); setTeamId(selectedSource?.teams.find((team) => !nextGame || !team.sessionIds || team.sessionIds.includes(nextGame.session_id))?.id ?? ""); resetQuote(); }}><option value="">{t("common.choose")}</option>{selectedSource?.games.map((game) => <option key={game.id} value={game.id}>{t("betting.game", { number: game.game_number })} · {mapLabels[game.map_name] ?? game.map_name}</option>)}</select></label>}
            <label className="text-sm text-slate-400">{t("common.team")}<select className="mt-1" value={teamId} onChange={(event) => { setTeamId(event.target.value); resetQuote(); }}><option value="">{t("common.choose")}</option>{availableTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
            <label className="text-sm text-slate-400">{t("betting.outcome")}<select className="mt-1" value={marketType} onChange={(event) => { const next = event.target.value as MarketType; setMarketType(next); setSelectionValue(next === "exact_place" ? "1" : next === "exact_score" ? "7:3" : next); resetQuote(); }}>{marketOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            {marketType.startsWith("kills_") && <label className="text-sm text-slate-400">{t("betting.killsLine")}<input className="mt-1" type="number" min="0.5" step="1" value={line} onChange={(event) => { setLine(event.target.value); resetQuote(); }} /><span className="mt-1 block text-xs text-slate-600">{t("betting.lineHint")}</span></label>}
            {marketType === "exact_place" && <label className="text-sm text-slate-400">{t("betting.place")}<input className="mt-1" type="number" min="1" max={Math.max(1, availableTeams.length)} step="1" value={selectionValue} onChange={(event) => { setSelectionValue(event.target.value); resetQuote(); }} /></label>}
            {marketType === "exact_score" && <label className="text-sm text-slate-400">{t("betting.score")}<select className="mt-1" value={selectionValue} onChange={(event) => { setSelectionValue(event.target.value); resetQuote(); }}>{Array.from({ length: 14 }, (_, index) => index < 7 ? `7:${index}` : `${index - 7}:7`).map((score) => <option key={score}>{score}</option>)}</select></label>}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button className="primary-button" type="button" disabled={busy || !sourceId || !teamId || Boolean(isClassic && !gameId)} onClick={() => void requestQuote()}>{t("betting.calculate")}</button>
            <button className="secondary-button" type="button" onClick={() => { resetQuote(); setStake(""); setMessage(t("betting.choiceCancelled")); }}>{t("betting.cancelChoice")}</button>
          </div>

          {quote && <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/[.05] p-4">
            {quote.available && quote.odds != null ? <>
              <div className="flex flex-wrap items-center justify-between gap-3"><div><span className="text-sm text-slate-400">{t("betting.yourOdds")}</span><p className="text-3xl font-black text-amber-300">×{Number(quote.odds).toFixed(2)}</p></div><span className={secondsLeft > 10 ? "text-sm text-emerald-300" : "text-sm text-red-300"}>{secondsLeft > 0 ? t("betting.validFor", { seconds: secondsLeft }) : t("betting.quoteExpired")}</span></div>
              <div className="mt-4 flex flex-wrap gap-2"><input className="max-w-56" type="number" min={data.minimumStake} max={data.maximumStake} step="1" value={stake} onChange={(event) => setStake(event.target.value)} placeholder={`${data.minimumStake}–${data.maximumStake}`} /><button className="primary-button" type="button" disabled={busy || secondsLeft <= 0} onClick={() => void confirmBet()}>{t("betting.confirm")}</button></div>
              {stake && Number(stake) > 0 && <p className="mt-2 text-xs text-slate-400">{t("betting.potentialPayout", { amount: Math.floor(Number(stake) * Number(quote.odds)), currency: data.currencyName })}</p>}
            </> : <p className="text-amber-300">{t("betting.unavailable")}</p>}
          </div>}
        </section>
      </>}

      {data.bets.length > 0 && <section className="mt-8"><h2 className="mb-3 text-xl font-bold">{t("betting.myBets")}</h2><div className="space-y-2">{data.bets.map((bet) => {
        const relation = Array.isArray(bet.betting_markets) ? bet.betting_markets[0] : bet.betting_markets;
        return <div key={bet.id} className="cyber-card flex flex-wrap justify-between gap-3 p-3 text-sm"><span>{relation?.subject_team_name || t("betting.outcome")} · {formatDate(bet.placed_at, { dateStyle: "short", timeStyle: "short" })} · {bet.stake} ×{Number(bet.odds).toFixed(2)}</span><span className="text-cyan-300">{bet.status} · {bet.payout || bet.potential_payout}</span></div>;
      })}</div></section>}
    </div>
  );
}
