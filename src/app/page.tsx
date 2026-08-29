"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

interface Activity {
  id: string;
  type: string;
  message: string;
  link_url: string;
  created_at: string;
}

interface UpcomingEvent {
  id: string;
  title: string;
  type: string;
  start_time: string;
}

interface Contact {
  id: string;
  name: string;
  role: string;
  description: string;
  social_link: string;
}

export default function Home() {
  const supabase = createClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    const fetchActivities = async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      if (data) setActivities(data);
    };

    const fetchUpcomingEvents = async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("event_sessions")
        .select("id, event_id, start_time, events(title, type)")
        .gte("start_time", now)
        .order("start_time", { ascending: true })
        .limit(5);

      if (data) {
        const events = data.map((s: any) => ({
          id: s.event_id,
          title: s.events?.title || "—",
          type: s.events?.type || "training",
          start_time: s.start_time,
        }));
        setUpcomingEvents(events);
      }
    };

    const fetchContacts = async () => {
      const { data } = await supabase
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: true });
      if (data) setContacts(data);
    };

    fetchActivities();
    fetchUpcomingEvents();
    fetchContacts();
  }, []);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const { data } = await supabase
      .from("teams")
      .select("id, name, type")
      .ilike("name", `%${query}%`)
      .eq("verified", true)
      .limit(5);

    if (data) {
      setSearchResults(data);
      setShowResults(true);
    }
  };

  const typeLabels: Record<string, string> = {
    training: "Тренировка",
    bo: "БО",
    tournament: "Турнир",
    kv: "КВ",
    solo: "Соло-турнир",
  };

  const typeBadge: Record<string, string> = {
    training: "bg-blue-700",
    bo: "bg-red-700",
    tournament: "bg-yellow-600",
    kv: "bg-purple-700",
    solo: "bg-green-600",
  };

  return (
    <div className="min-h-screen">
      {/* Верхняя панель */}
      <div className="flex justify-between items-center mb-8">
        <div className="relative w-full max-w-md">
          <input
            className="w-full p-2 text-black rounded"
            placeholder="Поиск команд..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
          />
          {showResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white text-black rounded mt-1 shadow-lg z-50">
              {searchResults.map((result) => (
                <Link
                  key={result.id}
                  href={`/teams/${result.id}`}
                  className="block px-3 py-2 hover:bg-gray-200 rounded"
                  onClick={() => { setShowResults(false); setSearchQuery(""); }}
                >
                  {result.name}
                  <span className="text-gray-500 text-sm ml-2">
                    ({result.type === "guild" ? "Гильдия" : "Команда"})
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
        <Link
          href="/auth"
          className="ml-4 px-4 py-2 bg-blue-500 rounded hover:bg-blue-600 whitespace-nowrap"
        >
          Войти / Регистрация
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-6 text-blue-500">FF-Community</h1>

      {/* Ближайшие мероприятия */}
      <div className="bg-gray-800 p-6 rounded mb-6">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xl font-semibold">Ближайшие мероприятия</h2>
          <Link href="/tournaments" className="text-blue-400 hover:underline text-sm">
            Все →
          </Link>
        </div>
        {upcomingEvents.length === 0 ? (
          <p className="text-gray-400">Пока нет ближайших мероприятий.</p>
        ) : (
          <div className="space-y-2">
            {upcomingEvents.map((ev, index) => (
              <Link
                key={`${ev.id}-${index}`}
                href={`/tournaments/${ev.id}`}
                className="bg-gray-700 p-3 rounded flex justify-between items-center hover:bg-gray-600"
              >
                <div>
                  <span className={"text-xs px-2 py-0.5 rounded " + (typeBadge[ev.type] || "bg-gray-600")}>
                    {typeLabels[ev.type] || ev.type}
                  </span>
                  <span className="ml-2 font-semibold">{ev.title}</span>
                </div>
                <span className="text-sm text-gray-300">
                  {new Date(ev.start_time).toLocaleString("ru")}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Лента активности */}
      <div className="bg-gray-800 p-6 rounded mb-6">
        <h2 className="text-xl font-semibold mb-3">Последние события</h2>
        {activities.length === 0 ? (
          <p className="text-gray-400">Пока нет событий.</p>
        ) : (
          <div className="space-y-2">
            {activities.map((a) => (
              <div key={a.id} className="text-sm">
                <span className="text-gray-400">
                  {new Date(a.created_at).toLocaleString("ru")}
                </span>{" "}
                — {a.message}
                {a.link_url && (
                  <Link href={a.link_url} className="text-blue-400 ml-2">
                    Подробнее
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Новости */}
      <div className="bg-gray-800 p-6 rounded mb-6">
        <h2 className="text-xl font-semibold mb-3">Новости</h2>
        <p className="text-gray-400">Новости платформы — скоро здесь.</p>
      </div>

      {/* Контакты */}
      <div className="bg-gray-800 p-6 rounded">
        <h2 className="text-xl font-semibold mb-3">Контакты</h2>
        {contacts.length === 0 ? (
          <p className="text-gray-400">Контакты пока не добавлены.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {contacts.map((c) => (
              <div key={c.id} className="bg-gray-700 p-3 rounded">
                <p className="font-semibold text-blue-400">{c.name}</p>
                {c.role && <p className="text-gray-300 text-sm">{c.role}</p>}
                {c.description && <p className="text-gray-400 text-sm">{c.description}</p>}
                {c.social_link && (
                  <a href={c.social_link} target="_blank" className="text-blue-400 text-sm hover:underline">
                    Связаться →
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}