"use client";

import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Clock3, Search, UsersRound } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

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
}

interface EventSession {
  id: string;
  event_id: string;
  start_time: string;
  end_time: string | null;
  registration_open_time: string | null;
  registration_close_time?: string | null;
  max_teams?: number | null;
}

interface EventWithSessions extends EventRow {
  sessions: EventSession[];
}

const typeLabels: Record<string, string> = {
  all: "Все",
  training: "Тренировки",
  bo: "БО",
  tournament: "Турниры",
  kv: "КВ",
  solo: "Соло",
};

function registrationLabel(session: EventSession | undefined) {
  if (!session) return "Расписание готовится";
  const now = Date.now();
  const opens = session.registration_open_time ? new Date(session.registration_open_time).getTime() : null;
  const closes = session.registration_close_time ? new Date(session.registration_close_time).getTime() : new Date(session.start_time).getTime();
  if (opens && now < opens) return "Регистрация скоро";
  if (now >= closes) return "Регистрация закрыта";
  return "Регистрация открыта";
}

export default function TournamentsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [events, setEvents] = useState<EventWithSessions[]>([]);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, [supabase]);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      const { data, error: eventsError } = await supabase
        .from("events")
        .select("id, title, type, cost, organizer, description, image_url, max_teams, created_at")
        .or(`is_published.eq.true,publish_at.lte.${new Date().toISOString()}`)
        .order("created_at", { ascending: false });
      if (eventsError) {
        setError("Не удалось загрузить мероприятия.");
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as EventRow[];
      const eventIds = rows.map((event) => event.id);
      const { data: sessions, error: sessionsError } = eventIds.length
        ? await supabase.from("event_sessions").select("id, event_id, start_time, end_time, registration_open_time, registration_close_time, max_teams").in("event_id", eventIds).order("start_time", { ascending: true })
        : { data: [] as EventSession[], error: null };
      if (sessionsError) setError("Не удалось загрузить расписание сессий.");
      const sessionRows = (sessions ?? []) as EventSession[];
      setEvents(rows.map((event) => ({ ...event, sessions: sessionRows.filter((session) => session.event_id === event.id) })));
      setLoading(false);
    };
    void fetchEvents();
  }, [supabase]);

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

  return (
    <div className="page-shell">
      <section className="panel relative mb-6 overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(249,166,37,.14),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(0,174,255,.15),transparent_36%)]" />
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div><p className="eyebrow">Расписание OMCITE</p><h1 className="mt-2 text-3xl font-black sm:text-5xl">Турниры и тренировки</h1><p className="mt-3 max-w-2xl text-slate-400">Выберите мероприятие и запишитесь на подходящую сессию. Для каждой сессии действуют отдельные лимит, состав и очередь резерва.</p></div>
          {user ? <Link href="/tournaments/propose" className="btn-primary">+ Предложить мероприятие</Link> : <Link href="/auth" className="btn-secondary">Войти для участия</Link>}
        </div>
      </section>

      <section className="panel mb-6 grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-300" /><input className="field pl-10" aria-label="Поиск мероприятий" placeholder="Найти мероприятие…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(typeLabels).map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={filter === value ? "btn-primary text-sm" : "btn-secondary text-sm"}>{label}</button>)}
        </div>
      </section>

      {loading ? (
        <div className="grid gap-5 lg:grid-cols-2">{Array.from({ length: 4 }, (_, index) => <div key={index} className="panel h-80 animate-pulse bg-white/[.03]" />)}</div>
      ) : error ? (
        <div className="panel border-red-500/30 p-6 text-red-200">{error}</div>
      ) : filteredEvents.length === 0 ? (
        <div className="panel p-10 text-center"><CalendarDays className="mx-auto mb-4 h-10 w-10 text-slate-600" /><h2 className="text-xl font-bold">Мероприятий не найдено</h2><p className="mt-2 text-slate-400">Попробуйте другой фильтр или предложите своё событие.</p></div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {filteredEvents.map((event) => {
            const nextSession = event.sessions.find((session) => new Date(session.start_time).getTime() >= Date.now()) ?? event.sessions[0];
            const registrationStatus = registrationLabel(nextSession);
            return (
              <Link key={event.id} href={"/tournaments/" + event.id} className="panel group overflow-hidden transition hover:-translate-y-1 hover:border-cyan-400/35">
                <div className="relative h-48 overflow-hidden bg-[radial-gradient(circle_at_center,rgba(0,174,255,.19),transparent_55%),#061019]">
                  {event.image_url ? <Image src={event.image_url} alt={event.title} fill sizes="(max-width: 1024px) 100vw, 50vw" unoptimized className="object-cover transition duration-500 group-hover:scale-105" /> : <Image src="/brand/omcite-hero.jpg" alt="" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover opacity-35 transition duration-500 group-hover:scale-105" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#071019] via-[#071019]/20 to-transparent" />
                  <span className="badge badge-blue absolute left-4 top-4">{typeLabels[event.type] || event.type}</span>
                  {event.cost && event.cost > 0 ? <span className="badge badge-yellow absolute right-4 top-4">{event.cost.toLocaleString("ru-RU")} ₽</span> : <span className="badge badge-green absolute right-4 top-4">Бесплатно</span>}
                </div>
                <div className="p-5">
                  <h2 className="text-2xl font-black transition group-hover:text-cyan-300">{event.title}</h2>
                  <p className="mt-2 line-clamp-2 min-h-10 text-sm text-slate-400">{event.description || "Описание мероприятия появится позднее."}</p>
                  <div className="mt-5 grid gap-3 rounded-xl border border-white/10 bg-white/[.025] p-4 sm:grid-cols-2">
                    <div className="flex items-center gap-3"><Clock3 className="h-5 w-5 text-cyan-300" /><div><p className="text-xs text-slate-500">Ближайшая сессия</p><p className="text-sm font-semibold">{nextSession ? new Date(nextSession.start_time).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Уточняется"}</p></div></div>
                    <div className="flex items-center gap-3"><UsersRound className="h-5 w-5 text-cyan-300" /><div><p className="text-xs text-slate-500">{event.sessions.length} сесс.</p><p className={registrationStatus === "Регистрация открыта" ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-slate-300"}>{registrationStatus}</p></div></div>
                  </div>
                  {event.organizer && <p className="mt-4 text-xs text-slate-500">Организатор: {event.organizer}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
