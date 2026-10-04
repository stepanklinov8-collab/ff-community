"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "@/utils/api/auth-fetch";
import { useLanguage } from "@/components/LanguageProvider";
import { isEventEffectivelyPublished } from "@/lib/event-publication";

type Source = { id: string; event_id: string | null; clan_war_id: string | null; enabled: boolean };
type EventItem = { id: string; title: string; type: string; is_published: boolean; publish_at: string | null; moderation_status: string; frozen_at: string | null; cancelled_at: string | null;
  sessions: Array<{id:string;public_number:number;start_time:string;status:string;betting_enabled:boolean;results_published:boolean}> };
type WarItem = { id: string; title: string; status: string; scheduled_at: string | null; opponent_team_id: string | null };
type Market = {
  id: string;
  subject_team_name: string | null;
  mode: string;
  market_type: string;
  selection_value: string;
  line: number | null;
  odds: number;
  status: string;
  locks_at: string;
  outcome: string | null;
  bets: Array<{id:string;stake:number;potential_payout:number;payout:number;status:string;settled_at:string|null}>;
};
type EconomySettings = {
  currency_name: string;
  starting_balance: number;
  minimum_stake: number;
  maximum_stake: number;
  maximum_odds: number;
};
type PageData = {
  markets: Market[];
  events: EventItem[];
  wars: WarItem[];
  sources: Source[];
  settings: EconomySettings | null;
  isOwner: boolean;
};

const emptyData: PageData = { markets: [], events: [], wars: [], sources: [], settings: null, isOwner: false };

export default function AdminBettingPage() {
  const { t, locale, formatDate } = useLanguage();
  const [data, setData] = useState<PageData>(emptyData);
  const [message, setMessage] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [now, setNow] = useState(()=>Date.now());
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),15000);return()=>window.clearInterval(timer);},[]);

  const load = useCallback(async () => {
    const response = await authFetch("/api/admin/betting");
    const payload = await response.json();
    if (response.ok) setData(payload);
    else setMessage(payload.error || t("adminBetting.loadError"));
  }, [t]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const enabledWars = useMemo(() => new Map(data.sources.filter((source) => source.clan_war_id).map((source) => [source.clan_war_id, source.enabled])), [data.sources]);

  const toggle = async (sourceKind: "event" | "war", sourceId: string, enabled: boolean, sessionId?:string) => {
    const key = `${sourceKind}:${sessionId ?? sourceId}`;
    setBusyKey(key);
    setMessage(enabled ? t("adminBetting.enabling") : t("adminBetting.disabling"));
    const response = await authFetch("/api/admin/betting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", sourceKind, sourceId, sessionId, enabled }),
    });
    const payload = await response.json();
    setBusyKey("");
    setMessage(response.ok
      ? enabled ? t("adminBetting.enabled") : t("adminBetting.disabled")
      : payload.error || t("adminBetting.changeError"));
    if (response.ok) await load();
  };

  const saveSettings = async () => {
    const read = (id: string) => (document.getElementById(id) as HTMLInputElement).value;
    const response = await authFetch("/api/admin/betting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    setMessage(response.ok ? t("adminBetting.settingsSaved") : payload.error || t("adminBetting.settingsError"));
    if (response.ok) await load();
  };

  return (
    <div className="page-shell">
      <span className="section-kicker">{t("adminBetting.eyebrow")}</span>
      <h1 className="mb-2 mt-2 text-3xl font-black">{t("adminBetting.title")}</h1>
      <p className="mb-6 max-w-3xl text-sm text-slate-400">
        {t("adminBetting.description")}
      </p>
      {message && <p className="mb-4 rounded-xl bg-white/[.05] p-3 text-sm">{message}</p>}

      {data.isOwner && data.settings && <section className="cyber-card mb-6 p-5">
        <h2 className="mb-3 text-lg font-bold">{t("adminBetting.currencyTitle")}</h2>
        <p className="mb-4 text-xs text-slate-500">{t("adminBetting.currencyNote")}</p>
        <div className="grid gap-3 md:grid-cols-5">
          <label className="text-xs text-slate-400">{t("adminBetting.name")}<input id="currency-name" defaultValue={data.settings.currency_name} /></label>
          <label className="text-xs text-slate-400">{t("adminBetting.startBalance")}<input id="starting-balance" type="number" min="0" defaultValue={data.settings.starting_balance} /></label>
          <label className="text-xs text-slate-400">{t("adminBetting.minStake")}<input id="minimum-stake" type="number" min="1" defaultValue={data.settings.minimum_stake} /></label>
          <label className="text-xs text-slate-400">{t("adminBetting.maxStake")}<input id="maximum-stake" type="number" min="1" defaultValue={data.settings.maximum_stake} /></label>
          <label className="text-xs text-slate-400">{t("adminBetting.maxOdds")}<input id="maximum-odds" type="number" min="1.10" step=".01" defaultValue={data.settings.maximum_odds} /></label>
        </div>
        <button className="secondary-button mt-4" type="button" onClick={() => void saveSettings()}>{t("adminBetting.save")}</button>
      </section>}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="cyber-card p-5">
          <h2 className="mb-4 text-xl font-bold">{t("adminBetting.eventsTitle")}</h2>
          <div className="space-y-3">
            {data.events.length === 0 && <p className="text-sm text-slate-500">{t("adminBetting.eventsEmpty")}</p>}
            {data.events.map((event) => <article key={event.id} className="rounded-xl border border-white/10 p-4">
              <strong>{event.title}</strong>
              {!event.sessions.length && <p className="mt-2 text-xs text-slate-500">{t("adminBetting.eventNoStart")}</p>}
              <div className="mt-3 space-y-3">{event.sessions.map(session=>{
                const ended=Date.parse(session.start_time)<=now||["cancelled","completed"].includes(session.status)||session.results_published;
                const eventAvailable=isEventEffectivelyPublished(event)&&event.moderation_status==="approved"&&!event.frozen_at&&!event.cancelled_at;
                const unavailable=ended||!eventAvailable;
                const enabled=session.betting_enabled;
                return <div key={session.id} className="rounded-lg border border-white/10 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div><p className="text-sm font-semibold">{locale==="ru"?"Сессия":locale==="kk"?"Сессия":"Сессия"} {session.public_number}</p>
                      <p className="text-xs text-slate-400">{formatDate(session.start_time,{dateStyle:"short",timeStyle:"short",timeZone:"Europe/Moscow"})} МСК</p>
                    </div>
                    <button type="button" className={enabled?"rounded bg-red-900 px-3 py-2 text-xs disabled:opacity-50":"rounded bg-emerald-700 px-3 py-2 text-xs disabled:opacity-50"}
                      disabled={!!busyKey||(!enabled&&unavailable)} onClick={()=>void toggle("event",event.id,!enabled,session.id)}>
                      {enabled?t("adminBetting.disable"):t("adminBetting.enable")}
                    </button>
                  </div>
                  <p className={`mt-2 text-xs ${unavailable?"text-amber-300":enabled?"text-emerald-300":"text-slate-400"}`}>
                    {ended ? (locale==="ru"?"Приём ставок закрыт для этой сессии":locale==="kk"?"Осы сессияға ставкалар жабық":"Бул сессияга коюмдар жабык")
                      : !eventAvailable ? t("adminBetting.eventNotPublished")
                      : enabled?t("adminBetting.enabled"):t("adminBetting.disabled")}
                  </p>
                </div>;
              })}</div>
            </article>)}
          </div>
        </div>

        <div className="cyber-card p-5">
          <h2 className="mb-4 text-xl font-bold">КВ</h2>
          <div className="space-y-3">
            {data.wars.length === 0 && <p className="text-sm text-slate-500">{t("adminBetting.warsEmpty")}</p>}
            {data.wars.map((war) => {
              const enabled = enabledWars.get(war.id) ?? false;
              const unavailable = war.status !== "agreed" || !war.opponent_team_id || !war.scheduled_at || new Date(war.scheduled_at) <= new Date();
              const key = `war:${war.id}`;
              return <article key={war.id} className="rounded-xl border border-white/10 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div><strong>{war.title}</strong><p className="mt-1 text-xs text-slate-500">КВ · {war.scheduled_at ? formatDate(war.scheduled_at, { dateStyle: "short", timeStyle: "short" }) : t("adminBetting.unknownTime")}</p></div>
                  <button type="button" className={enabled ? "rounded bg-red-900 px-3 py-2 text-xs" : "rounded bg-emerald-700 px-3 py-2 text-xs"} disabled={busyKey === key || (!enabled && unavailable)} onClick={() => void toggle("war", war.id, !enabled)}>
                    {enabled ? t("adminBetting.disable") : t("adminBetting.enable")}
                  </button>
                </div>
                {unavailable && !enabled && <p className="mt-2 text-xs text-amber-300">{t("adminBetting.warUnavailable")}</p>}
              </article>;
            })}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-bold">{t("adminBetting.marketsTitle")}</h2>
        <p className="mb-4 text-xs text-slate-500">{locale === "ru" ? "Ставки рассчитываются при публикации результатов. Возврат выполняется при отмене игры или мероприятия." : locale === "kk" ? "Ставкалар нәтижелер жарияланғанда есептеледі. Ойын не іс-шара тоқтатылса, қаражат қайтарылады." : "Коюмдар жыйынтыктар жарыяланганда эсептелет. Оюн же иш-чара жокко чыгарылса, каражат кайтарылат."}</p>
        <div className="space-y-2">{data.markets.map((market) => {
          const settled=market.status==="settled"||market.status==="void";
          const totalStake=market.bets.reduce((sum,bet)=>sum+Number(bet.stake),0);
          const totalPayout=market.bets.reduce((sum,bet)=>sum+Number(bet.payout),0);
          const pendingCount=market.bets.filter((bet)=>bet.status==="open"||bet.status==="pending").length;
          const statusLabel=market.status==="open"?"Приём открыт":market.status==="locked"?"Приём закрыт":market.status==="void"?"Возврат":"Рассчитан";
          const outcomeLabel=market.outcome==="won"?"исход состоялся":market.outcome==="lost"?"исход не состоялся":market.outcome==="void"?"возврат":"";
          return <article key={market.id} className="cyber-card p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><strong>{market.subject_team_name || t("adminBetting.outcome")}</strong><p className="mt-1 text-slate-400">{market.mode} · {market.market_type} · {market.line ?? market.selection_value} · ×{Number(market.odds).toFixed(2)}</p></div><span className={`rounded-full border px-3 py-1 text-xs font-bold ${settled?"border-emerald-400/30 bg-emerald-400/[.07] text-emerald-200":"border-amber-400/25 bg-amber-400/[.06] text-amber-200"}`}>{statusLabel}{outcomeLabel?` · ${outcomeLabel}`:""}</span></div>
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/10 pt-3 sm:grid-cols-4"><div><span className="text-xs text-slate-500">Ставок</span><p className="mt-1 font-bold">{market.bets.length}</p></div><div><span className="text-xs text-slate-500">Общая сумма</span><p className="mt-1 font-bold">{totalStake}</p></div><div><span className="text-xs text-slate-500">Выплачено</span><p className="mt-1 font-bold">{settled?totalPayout:"—"}</p></div><div><span className="text-xs text-slate-500">Ожидают расчёта</span><p className={`mt-1 font-bold ${pendingCount?"text-amber-300":"text-emerald-300"}`}>{pendingCount}</p></div></div>
          </article>;
        })}</div>
      </section>
      <Link href="/admin" className="mt-6 inline-flex text-cyan-300 hover:underline">{t("adminBetting.back")}</Link>
    </div>
  );
}
