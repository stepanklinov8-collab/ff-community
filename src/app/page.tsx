"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Gamepad2,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  UsersRound,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface ActivityRow {
  id: string;
  activity_type: string | null;
  description: string | null;
  created_at: string;
  event_id: string | null;
  team_id: string | null;
}

interface UpcomingEvent {
  eventId: string;
  sessionId: string;
  title: string;
  type: string;
  startTime: string;
}

interface EventSessionRow {
  id: string;
  event_id: string;
  start_time: string;
  events: { title: string; type: string } | null;
}

interface SearchResult {
  id: string;
  name: string;
  type: "team" | "guild";
}

const typeLabels: Record<string, string> = {
  training: "Тренировка",
  bo: "БО",
  kb: "КБ",
  tournament: "Турнир",
  kv: "КВ",
  solo: "Соло",
};

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [stats, setStats] = useState({ teams: 0, players: 0, sessions: 0 });

  useEffect(() => {
    let active = true;

    async function loadHome() {
      const now = new Date().toISOString();
      const [activityResult, sessionsResult, teamsCount, playersCount, sessionsCount] = await Promise.all([
        supabase
          .from("activity_log")
          .select("id, activity_type, description, created_at, event_id, team_id")
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("event_sessions")
          .select("id, event_id, start_time, events(title, type)")
          .gte("start_time", now)
          .order("start_time", { ascending: true })
          .limit(4),
        supabase.from("teams").select("id", { count: "exact", head: true }).eq("verified", true),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("event_sessions").select("id", { count: "exact", head: true }).gte("start_time", now),
      ]);

      if (!active) return;
      setActivities((activityResult.data ?? []) as ActivityRow[]);

      const rows = (sessionsResult.data ?? []) as unknown as EventSessionRow[];
      setUpcomingEvents(rows.map((row) => ({
        eventId: row.event_id,
        sessionId: row.id,
        title: row.events?.title ?? "Мероприятие OMCITE",
        type: row.events?.type ?? "training",
        startTime: row.start_time,
      })));
      setStats({
        teams: teamsCount.count ?? 0,
        players: playersCount.count ?? 0,
        sessions: sessionsCount.count ?? 0,
      });
    }

    loadHome();
    return () => { active = false; };
  }, [supabase]);

  async function handleSearch(query: string) {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const { data } = await supabase
      .from("teams")
      .select("id, name, type")
      .ilike("name", `%${query.trim()}%`)
      .eq("verified", true)
      .limit(6);

    setSearchResults((data ?? []) as SearchResult[]);
    setShowResults(true);
  }

  return (
    <div className="home-page">
      <section className="home-hero cyber-card">
        <Image
          src="/brand/omcite-hero.jpg"
          alt="OMCITE — тренировки и турниры по Free Fire"
          fill
          priority
          sizes="(max-width: 900px) 100vw, 1400px"
          className="hero-image"
        />
        <div className="hero-shade" />
        <div className="hero-content">
          <span className="hero-eyebrow"><Sparkles size={14} /> OMCITE FREE FIRE COMMUNITY</span>
          <h1>Твоя команда.<br /><span>Твоя арена.</span></h1>
          <p>
            Турниры, тренировки, рейтинги и история игроков — в одной платформе для сообщества OMCITE.
          </p>
          <div className="hero-actions">
            <Link href="/tournaments" className="primary-button">
              Найти турнир <ArrowRight size={18} />
            </Link>
            <Link href="/teams" className="secondary-button">
              Команды и гильдии
            </Link>
          </div>
        </div>
        <div className="hero-stats" aria-label="Статистика сообщества">
          <div><strong>{stats.players}</strong><span>игроков</span></div>
          <div><strong>{stats.teams}</strong><span>команд</span></div>
          <div><strong>{stats.sessions}</strong><span>ближайших игр</span></div>
        </div>
      </section>

      <section className="global-search">
        <Search size={20} />
        <input
          aria-label="Поиск команд и гильдий"
          placeholder="Найти команду или гильдию..."
          value={searchQuery}
          onChange={(event) => handleSearch(event.target.value)}
          onFocus={() => searchResults.length > 0 && setShowResults(true)}
          onBlur={() => window.setTimeout(() => setShowResults(false), 180)}
        />
        {showResults && (
          <div className="search-results">
            {searchResults.length ? searchResults.map((result) => (
              <Link key={result.id} href={`/teams/${result.id}`}>
                <UsersRound size={18} />
                <span>{result.name}<small>{result.type === "guild" ? "Гильдия" : "Команда"}</small></span>
                <ChevronRight size={17} />
              </Link>
            )) : <p>Ничего не найдено</p>}
          </div>
        )}
      </section>

      <div className="home-grid">
        <section className="schedule-panel cyber-card">
          <div className="section-heading-row">
            <div>
              <span className="section-kicker">КАЛЕНДАРЬ</span>
              <h2 className="section-title">Ближайшие мероприятия</h2>
            </div>
            <Link href="/tournaments" className="text-link">Все мероприятия <ArrowRight size={16} /></Link>
          </div>

          <div className="event-list">
            {upcomingEvents.length === 0 ? (
              <div className="empty-state"><CalendarDays /><p>Расписание обновляется. Загляните немного позже.</p></div>
            ) : upcomingEvents.map((event) => (
              <Link key={event.sessionId} href={`/tournaments/${event.eventId}`} className="event-row">
                <div className="event-date">
                  <strong>{new Date(event.startTime).toLocaleDateString("ru", { day: "2-digit" })}</strong>
                  <span>{new Date(event.startTime).toLocaleDateString("ru", { month: "short" })}</span>
                </div>
                <div className="event-main">
                  <span className={`event-type type-${event.type}`}>{typeLabels[event.type] ?? event.type}</span>
                  <h3>{event.title}</h3>
                  <p>{new Date(event.startTime).toLocaleString("ru", { hour: "2-digit", minute: "2-digit", weekday: "short" })}</p>
                </div>
                <ChevronRight className="event-arrow" />
              </Link>
            ))}
          </div>
        </section>

        <aside className="quick-panel cyber-card">
          <span className="section-kicker">НАЧАТЬ ИГРУ</span>
          <h2 className="section-title">Собери свою команду</h2>
          <p>Создайте команду или гильдию, пройдите верификацию и участвуйте в мероприятиях OMCITE.</p>
          <div className="quick-steps">
            <div><span>01</span><UsersRound /><p>Создайте состав</p></div>
            <div><span>02</span><ShieldCheck /><p>Пройдите проверку</p></div>
            <div><span>03</span><Trophy /><p>Запишитесь на турнир</p></div>
          </div>
          <Link href="/teams/create" className="primary-button">Создать команду <ArrowRight size={18} /></Link>
        </aside>
      </div>

      <section className="features-strip">
        <Link href="/rating" className="feature-card cyber-card">
          <Sparkles /><span><strong>Рейтинг игроков</strong><small>Статистика лучших участников</small></span><ArrowRight />
        </Link>
        <Link href="/teams-stats" className="feature-card cyber-card">
          <Gamepad2 /><span><strong>Рейтинг команд</strong><small>Трофеи, матчи и составы</small></span><ArrowRight />
        </Link>
        <Link href="/tournaments/propose" className="feature-card cyber-card">
          <Swords /><span><strong>Предложить турнир</strong><small>Создайте событие для сообщества</small></span><ArrowRight />
        </Link>
      </section>

      <section className="activity-section cyber-card">
        <div className="section-heading-row">
          <div><span className="section-kicker">СООБЩЕСТВО</span><h2 className="section-title">Последние события</h2></div>
        </div>
        <div className="activity-list">
          {activities.length === 0 ? <p className="muted-copy">Лента активности пока пуста.</p> : activities.map((activity) => {
            const href = activity.event_id
              ? `/tournaments/${activity.event_id}`
              : activity.team_id
                ? `/teams/${activity.team_id}`
                : null;
            const content = (
              <>
                <span className="activity-dot" />
                <p>{activity.description ?? "Новое событие в сообществе"}</p>
                <time>{new Date(activity.created_at).toLocaleString("ru")}</time>
              </>
            );
            return href
              ? <Link key={activity.id} href={href} className="activity-row">{content}</Link>
              : <div key={activity.id} className="activity-row">{content}</div>;
          })}
        </div>
      </section>

      <style>{`
        .home-page { display: flex; flex-direction: column; gap: 24px; }
        .home-hero { position: relative; min-height: clamp(510px, 67vw, 720px); overflow: hidden; }
        .hero-image { object-fit: cover; object-position: center; }
        .hero-shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgb(0 4 8 / 94%) 0%, rgb(0 7 12 / 70%) 43%, rgb(0 4 8 / 20%) 74%), linear-gradient(0deg, rgb(2 8 12 / 90%), transparent 48%); }
        .hero-content { position: relative; z-index: 2; width: min(660px, 92%); padding: clamp(48px, 8vw, 100px) clamp(24px, 5vw, 72px) 150px; }
        .hero-eyebrow { display: inline-flex; gap: 8px; align-items: center; color: #77dcff; font-size: .72rem; font-weight: 900; letter-spacing: .2em; }
        h1 { margin: 18px 0 20px; font-family: var(--font-heading); font-size: clamp(3rem, 7vw, 6.7rem); font-weight: 950; line-height: .88; letter-spacing: -.055em; text-transform: uppercase; text-shadow: 0 8px 40px rgb(0 0 0 / 60%); }
        h1 span { color: transparent; background: linear-gradient(180deg, #e7fbff, #4acfff 48%, #087eb7); background-clip: text; }
        .hero-content > p { max-width: 580px; color: #b8cbd6; font-size: clamp(1rem, 1.7vw, 1.2rem); line-height: 1.65; }
        .hero-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 30px; }
        .hero-stats { position: absolute; right: clamp(20px, 5vw, 72px); bottom: 34px; left: clamp(20px, 5vw, 72px); z-index: 2; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); width: min(580px, calc(100% - 40px)); border-top: 1px solid rgb(88 196 240 / 25%); }
        .hero-stats div { display: flex; flex-direction: column; padding: 20px 24px 0 0; }
        .hero-stats strong { font-size: 1.65rem; }
        .hero-stats span { color: #78909d; font-size: .72rem; letter-spacing: .1em; text-transform: uppercase; }
        .global-search { position: relative; display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: center; max-width: 760px; width: 100%; margin: -46px auto 0; z-index: 5; padding: 11px 16px; color: #7edbff; background: rgb(7 20 29 / 96%); border: 1px solid rgb(61 188 241 / 34%); border-radius: 16px; box-shadow: 0 20px 60px rgb(0 0 0 / 48%); }
        .global-search input { padding: 8px 4px !important; background: transparent !important; border: 0 !important; box-shadow: none !important; }
        .search-results { position: absolute; top: calc(100% + 9px); right: 0; left: 0; overflow: hidden; background: #07131a; border: 1px solid rgb(60 181 232 / 25%); border-radius: 14px; box-shadow: 0 20px 50px rgb(0 0 0 / 50%); }
        .search-results a { display: grid; grid-template-columns: 24px 1fr auto; gap: 10px; align-items: center; padding: 12px 15px; border-bottom: 1px solid rgb(99 177 211 / 10%); }
        .search-results a:hover { background: rgb(22 122 162 / 22%); }
        .search-results span { display: flex; flex-direction: column; }
        .search-results small { color: #718a98; }
        .search-results p { padding: 15px; color: #8197a3; }
        .home-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(300px, .75fr); gap: 22px; }
        .schedule-panel, .quick-panel, .activity-section { padding: clamp(20px, 3vw, 34px); }
        .section-heading-row { display: flex; gap: 20px; align-items: end; justify-content: space-between; margin-bottom: 24px; }
        .text-link { display: inline-flex; gap: 7px; align-items: center; color: #65cdec; font-size: .86rem; }
        .event-list { display: flex; flex-direction: column; }
        .event-row { display: grid; grid-template-columns: 64px 1fr auto; gap: 16px; align-items: center; padding: 15px 0; border-top: 1px solid rgb(89 169 203 / 14%); }
        .event-row:hover h3 { color: #5bd9ff; }
        .event-date { display: grid; width: 58px; height: 58px; background: rgb(12 41 55 / 75%); border: 1px solid rgb(70 177 224 / 24%); border-radius: 12px; place-items: center; align-content: center; }
        .event-date strong { font-size: 1.3rem; line-height: 1; }
        .event-date span { margin-top: 3px; color: #58c8ee; font-size: .68rem; text-transform: uppercase; }
        .event-main h3 { margin: 5px 0 2px; font-size: 1rem; transition: color 150ms; }
        .event-main p { color: #78909d; font-size: .78rem; }
        .event-type { color: #9cdfff; font-size: .66rem; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
        .type-bo, .type-kv { color: #ff9c74; }
        .type-tournament { color: #f7c45e; }
        .event-arrow { color: #456272; }
        .empty-state { display: grid; min-height: 220px; color: #718996; place-items: center; align-content: center; text-align: center; }
        .empty-state svg { width: 42px; height: 42px; margin-bottom: 10px; opacity: .7; }
        .quick-panel { position: relative; overflow: hidden; }
        .quick-panel::after { position: absolute; right: -80px; bottom: -90px; width: 270px; height: 270px; content: ""; background: url('/brand/omcite-emblem.jpg') center/cover; border-radius: 50%; opacity: .07; }
        .quick-panel > p { margin: 14px 0 24px; color: #8299a6; line-height: 1.6; }
        .quick-steps { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; }
        .quick-steps div { display: grid; grid-template-columns: 32px 24px 1fr; gap: 10px; align-items: center; padding: 11px; background: rgb(5 18 25 / 66%); border: 1px solid rgb(67 162 203 / 14%); border-radius: 11px; }
        .quick-steps span { color: #4dbde3; font-size: .67rem; font-weight: 900; }
        .quick-steps svg { color: #d3f5ff; }
        .quick-steps p { font-size: .88rem; }
        .quick-panel .primary-button { position: relative; z-index: 1; width: 100%; }
        .features-strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .feature-card { display: grid; grid-template-columns: 42px 1fr auto; gap: 14px; align-items: center; padding: 19px; }
        .feature-card > svg:first-child { width: 28px; height: 28px; color: #48cfff; }
        .feature-card > svg:last-child { width: 17px; color: #496675; }
        .feature-card span { display: flex; flex-direction: column; }
        .feature-card small { margin-top: 4px; color: #718995; }
        .activity-list { display: flex; flex-direction: column; }
        .activity-row { display: grid; grid-template-columns: 12px 1fr auto; gap: 12px; align-items: center; padding: 13px 0; border-top: 1px solid rgb(89 169 203 / 12%); }
        .activity-dot { width: 7px; height: 7px; background: #3bc9f8; border-radius: 50%; box-shadow: 0 0 12px #35c3f4; }
        .activity-row p { font-size: .9rem; }
        .activity-row time, .muted-copy { color: #6f8692; font-size: .74rem; }
        @media (max-width: 920px) { .home-grid { grid-template-columns: 1fr; } .features-strip { grid-template-columns: 1fr; } }
        @media (max-width: 620px) {
          .home-hero { min-height: 590px; }
          .hero-shade { background: linear-gradient(0deg, rgb(0 5 8 / 97%) 0%, rgb(0 5 9 / 65%) 62%, rgb(0 3 6 / 34%)); }
          .hero-content { padding: 190px 20px 145px; }
          h1 { font-size: clamp(2.9rem, 15vw, 4.2rem); }
          .hero-content > p { font-size: .95rem; }
          .hero-actions > * { width: 100%; }
          .hero-stats { right: 16px; left: 16px; bottom: 25px; width: auto; }
          .hero-stats div { padding: 15px 8px 0 0; }
          .hero-stats strong { font-size: 1.25rem; }
          .hero-stats span { font-size: .56rem; }
          .global-search { margin-top: -38px; }
          .section-heading-row { align-items: start; flex-direction: column; }
          .event-row { grid-template-columns: 54px 1fr; }
          .event-date { width: 50px; height: 50px; }
          .event-arrow { display: none; }
          .activity-row { grid-template-columns: 10px 1fr; }
          .activity-row time { grid-column: 2; }
        }
      `}</style>
    </div>
  );
}
