"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "@/utils/api/auth-fetch";
import { useLanguage } from "@/components/LanguageProvider";

type Source = { id: string; event_id: string | null; clan_war_id: string | null; enabled: boolean };
type EventItem = { id: string; title: string; type: string; is_published: boolean; locks_at: string | null };
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
  const { t, formatDate } = useLanguage();
  const [data, setData] = useState<PageData>(emptyData);
  const [message, setMessage] = useState("");
  const [busyKey, setBusyKey] = useState("");

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

  const enabledEvents = useMemo(() => new Map(data.sources.filter((source) => source.event_id).map((source) => [source.event_id, source.enabled])), [data.sources]);
  const enabledWars = useMemo(() => new Map(data.sources.filter((source) => source.clan_war_id).map((source) => [source.clan_war_id, source.enabled])), [data.sources]);

  const toggle = async (sourceKind: "event" | "war", sourceId: string, enabled: boolean) => {
    const key = `${sourceKind}:${sourceId}`;
    setBusyKey(key);
    setMessage(enabled ? t("adminBetting.enabling") : t("adminBetting.disabling"));
    const response = await authFetch("/api/admin/betting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", sourceKind, sourceId, enabled }),
    });
    const payload = await response.json();
    setBusyKey("");
    setMessage(response.ok
      ? enabled ? t("adminBetting.enabled") : t("adminBetting.disabled")
      : payload.error || t("adminBetting.changeError"));
    if (response.ok) await load();
  };

  const refund = async (marketId: string) => {
    setBusyKey(`market:${marketId}`);
    const response = await authFetch("/api/admin/betting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "settle", marketId, outcome: "void" }),
    });
    const payload = await response.json();
    setBusyKey("");
    setMessage(response.ok ? t("adminBetting.refundSuccess") : payload.error || t("adminBetting.refundError"));
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
            {data.events.map((event) => {
              const enabled = enabledEvents.get(event.id) ?? false;
              const unavailable = !event.is_published || !event.locks_at || new Date(event.locks_at) <= new Date();
              const key = `event:${event.id}`;
              return <article key={event.id} className="rounded-xl border border-white/10 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div><strong>{event.title}</strong><p className="mt-1 text-xs text-slate-500">{event.type} · {event.locks_at ? formatDate(event.locks_at, { dateStyle: "short", timeStyle: "short" }) : t("adminBetting.unknownTime")}</p></div>
                  <button type="button" className={enabled ? "rounded bg-red-900 px-3 py-2 text-xs" : "rounded bg-emerald-700 px-3 py-2 text-xs"} disabled={busyKey === key || (!enabled && unavailable)} onClick={() => void toggle("event", event.id, !enabled)}>
                    {enabled ? t("adminBetting.disable") : t("adminBetting.enable")}
                  </button>
                </div>
                {unavailable && !enabled && <p className="mt-2 text-xs text-amber-300">{t("adminBetting.eventUnavailable")}</p>}
              </article>;
            })}
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
        <p className="mb-4 text-xs text-slate-500">{t("adminBetting.marketsNote")}</p>
        <div className="space-y-2">{data.markets.map((market) => <article key={market.id} className="cyber-card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <div><strong>{market.subject_team_name || t("adminBetting.outcome")}</strong><p className="text-slate-400">{market.mode} · {market.market_type} · {market.line ?? market.selection_value} · ×{Number(market.odds).toFixed(2)} · {market.status}</p></div>
          {!["settled", "void"].includes(market.status) && <button className="rounded bg-slate-700 px-3 py-1 disabled:opacity-50" disabled={busyKey === `market:${market.id}`} onClick={() => void refund(market.id)}>{t("adminBetting.refund")}</button>}
        </article>)}</div>
      </section>
      <Link href="/admin" className="mt-6 inline-flex text-cyan-300 hover:underline">{t("adminBetting.back")}</Link>
    </div>
  );
}
