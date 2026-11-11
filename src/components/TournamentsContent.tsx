"use client";

import { formatCoins } from "@/lib/economy/currency";
import Image from "@/platform/image";
import ListThumbnail from "@/components/ListThumbnail";
import {archiveCards} from "@/lib/competition/archive";
import {competitionText} from "@/i18n/competition";
import Link from "next/link";
import { CalendarDays, Clock3, Search, UsersRound } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";

interface EventRow {
  id: string;
  title: string;
  type: string;
  cost: number | null;
  organizer: string | null;
  description: string | null;
  image_url: string | null;
  max_teams: number | null;
  created_at: string;
  archive_end_time?: string | null; final_session_id?: string | null; frozen_at?: string | null;
}

interface EventSession {
  id: string;
  event_id: string;
  published?: boolean; public_number?: number; summary?: Array<{name:string;place:number}>;
  registered_count?: number;
  start_time: string;
  end_time: string | null;
  registration_open_time: string | null;
  registration_close_time?: string | null;
  max_teams?: number | null;
}

interface EventWithSessions extends EventRow {
  sessions: EventSession[];
}

interface ScheduleData {
  events: EventRow[];
  sessions: EventSession[];
  generatedAt: number;
}

function groupSchedule({events, sessions}: ScheduleData): EventWithSessions[] {
  const byEvent = new Map<string, EventSession[]>();
  for (const session of sessions) {
    let eventSessions = byEvent.get(session.event_id);
    if (!eventSessions) byEvent.set(session.event_id, eventSessions = []);
    eventSessions.push(session);
  }
  return events.map(event => ({ ...event, sessions: byEvent.get(event.id) ?? [] }));
}

function registrationStatus(session: EventSession | undefined, now: number) {
  if (!session) return "pending" as const;
  const opens = session.registration_open_time ? new Date(session.registration_open_time).getTime() : null;
  const closes = session.registration_close_time ? new Date(session.registration_close_time).getTime() : new Date(session.start_time).getTime();
  if (opens && now < opens) return "soon" as const;
  if (now >= closes) return "closed" as const;
  return "open" as const;
}

export default function TournamentsContent({ initialData }: { initialData?: ScheduleData }) {
  const supabase = useMemo(() => createClient(), []);
  const { t, locale, formatDate } = useLanguage();
  const [events, setEvents] = useState<EventWithSessions[]>(() => initialData ? groupSchedule(initialData) : []);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<"active" | "archive">("active");
  const [archiveLimit, setArchiveLimit] = useState(10);
  const [referenceTime, setReferenceTime] = useState(initialData?.generatedAt ?? 0);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setUser(data.session?.user ?? null);
    }).catch(() => undefined);
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user ?? null);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [supabase]);

  useEffect(() => {
    if (initialData) return;
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    void fetch("/api/events/public", {
      cache: "no-store",
      signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error("Schedule unavailable");
      const payload = await response.json() as ScheduleData;
      if (active) {
        setEvents(groupSchedule(payload));
        setReferenceTime(payload.generatedAt);
      }
    }).catch(() => {
      if (active) setError(true);
    }).finally(() => {
      window.clearTimeout(timeout);
      if (active) setLoading(false);
    });
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [initialData]);

  useEffect(() => {
    const timer = window.setInterval(() => setReferenceTime(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const typeLabels: Record<string, string> = {
    all: t("tournaments.all"), training: t("tournaments.trainings"), bo: "БО",
    tournament: t("tournaments.tournaments"), kv: "КВ", kb: "КБ", solo: t("event.solo"),
  };
  const registrationLabels = {
    pending: t("tournaments.schedulePending"), soon: t("tournaments.registrationSoon"),
    closed: t("tournaments.registrationClosed"), open: t("tournaments.registrationOpen"),
  };

  const filteredEvents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ru-RU");
    return events
      .filter((event) => filter === "all" || event.type === filter)
      .filter((event) => !normalized || event.title.toLocaleLowerCase("ru-RU").includes(normalized))
      .sort((left, right) => {
        const leftStart = left.sessions[0]?.start_time;
        const rightStart = right.sessions[0]?.start_time;
        if (!leftStart) return 1;
        if (!rightStart) return -1;
        return new Date(leftStart).getTime() - new Date(rightStart).getTime();
      });
  }, [events, filter, query]);

  const {activeEvents,archiveEvents}=useMemo(()=>archiveCards(filteredEvents,referenceTime),[filteredEvents,referenceTime]);
  const displayedEvents = view === "active" ? activeEvents : archiveEvents.slice(0, archiveLimit);

  return (
    <div className="page-shell">
      <section className="panel relative mb-6 overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(249,166,37,.14),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(0,174,255,.15),transparent_36%)]" />
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div><p className="eyebrow">{t("tournaments.eyebrow")}</p><h1 className="mt-2 text-3xl font-black sm:text-5xl">{t("tournaments.title")}</h1><p className="mt-3 max-w-2xl text-slate-400">{t("tournaments.description")}</p></div>
          {user ? <div className="flex gap-3"><Link href="/tournaments/manage" className="btn-secondary">{competitionText(locale,"organizer")}</Link><Link href="/tournaments/propose" className="btn-primary">{t("tournaments.propose")}</Link></div> : <Link href="/auth" className="btn-secondary">{t("tournaments.signIn")}</Link>}
        </div>
      </section>

      <section className="panel mb-6 grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-300" /><input className="field pl-10" aria-label={t("tournaments.searchLabel")} placeholder={t("tournaments.searchPlaceholder")} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(typeLabels).map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={filter === value ? "btn-primary text-sm" : "btn-secondary text-sm"}>{label}</button>)}
        </div>
      </section>

      <div className="mb-6 flex gap-2">
        <button type="button" onClick={() => setView("active")} className={view === "active" ? "btn-primary" : "btn-secondary"}>{competitionText(locale,"active")}</button>
        <button type="button" onClick={() => setView("archive")} className={view === "archive" ? "btn-primary" : "btn-secondary"}>{competitionText(locale,"archive")} ({archiveEvents.length})</button>
      </div>

      {loading ? (
        <div className="grid gap-5 lg:grid-cols-2">{Array.from({ length: 4 }, (_, index) => <div key={index} className="panel h-80 animate-pulse bg-white/[.03]" />)}</div>
      ) : error ? (
        <div className="panel border-red-500/30 p-6 text-red-200">{t("tournaments.loadError")}</div>
      ) : displayedEvents.length === 0 ? (
        <div className="panel p-10 text-center"><CalendarDays className="mx-auto mb-4 h-10 w-10 text-slate-600" /><h2 className="text-xl font-bold">{t("tournaments.empty")}</h2><p className="mt-2 text-slate-400">{t("tournaments.emptyText")}</p></div>
      ) : (
        <>
        <div className="grid gap-5 lg:grid-cols-2">
          {displayedEvents.map((event) => {
            const nextSession = view==="archive" ? event.sessions.find(s=>s.id===event.final_session_id) ?? event.sessions[event.sessions.length-1] : event.sessions.find((session) => new Date(session.start_time).getTime() >= referenceTime) ?? event.sessions[0];
            const status = registrationStatus(nextSession, referenceTime);
            const registrationLabel = registrationLabels[status];
            return (
              <Link key={event.cardId} prefetch={false} href={"/tournaments/" + event.id + (event.archivedSessionId ? `?sessionId=${event.archivedSessionId}` : "")} className="panel group overflow-hidden transition hover:-translate-y-1 hover:border-cyan-400/35">
                <div className="relative h-48 overflow-hidden bg-[radial-gradient(circle_at_center,rgba(0,174,255,.19),transparent_55%),#061019]">
                  {event.image_url ? <ListThumbnail src={event.image_url} alt={event.title} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover transition duration-500 group-hover:scale-105" /> : <Image src="/brand/omcite-hero.jpg" alt="" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover opacity-35 transition duration-500 group-hover:scale-105" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#071019] via-[#071019]/20 to-transparent" />
                  <span className="badge badge-blue absolute left-4 top-4">{typeLabels[event.type] || event.type}</span>
                  {event.cost && event.cost > 0 ? <span className="badge badge-yellow absolute right-4 top-4">{formatCoins(event.cost, locale)}</span> : <span className="badge badge-green absolute right-4 top-4">{t("tournaments.free")}</span>}
                </div>
                <div className="p-5">
                  <h2 className="text-2xl font-black transition group-hover:text-cyan-300">{event.title}</h2>
                  <p className="mt-2 line-clamp-2 min-h-10 text-sm text-slate-400">{event.description || t("tournaments.noDescription")}</p>
                  <div className="mt-5 grid gap-3 rounded-xl border border-white/10 bg-white/[.025] p-4 sm:grid-cols-2">
                    <div className="flex items-center gap-3"><Clock3 className="h-5 w-5 text-cyan-300" /><div><p className="text-xs text-slate-500">{t("tournaments.nextSession")}</p><p className="text-sm font-semibold">{nextSession ? formatDate(nextSession.start_time, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone:"Europe/Moscow" }) : t("tournaments.pending")}</p></div></div>
                    <div className="flex items-center gap-3"><UsersRound className="h-5 w-5 text-cyan-300" /><div><p className="text-xs text-slate-500">{t("tournaments.sessionCount", { count: event.sessions.length })}</p><p className={status === "open" ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-slate-300"}>{registrationLabel}</p>{nextSession && <p className="mt-1 w-fit rounded-full border border-cyan-400/25 bg-cyan-950/40 px-2 py-0.5 text-xs font-semibold tabular-nums text-cyan-300"><span className="sr-only">Зарегистрировано / всего мест: </span>{nextSession.registered_count ?? 0}/{nextSession.max_teams ?? event.max_teams ?? "∞"}</p>}</div></div>
                  </div>
                  {view==="archive"&&<div className="mt-3 text-sm">{event.archivedSessionId&&<p>{competitionText(locale,"session")} {nextSession?.public_number} · МСК</p>}{nextSession?.published?<p>{nextSession.summary?.map(s=>`${s.place}. ${s.name}`).join(" · ")}</p>:<p className="text-amber-300">{competitionText(locale,"waiting")}</p>}</div>}
                  {event.organizer && <p className="mt-4 text-xs text-slate-500">{t("tournaments.organizer", { name: event.organizer })}</p>}
                </div>
              </Link>
            );
          })}
        </div>
        {view === "archive" && archiveLimit < archiveEvents.length && <button type="button" className="btn-secondary mx-auto mt-6 flex" onClick={() => setArchiveLimit((current) => current + 10)}>{competitionText(locale,"more")}</button>}
        </>
      )}
    </div>
  );
}
