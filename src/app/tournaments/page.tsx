"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

interface Event {
  id: string;
  title: string;
  type: string;
  cost: number;
  organizer: string;
  description: string;
  image_url: string;
  stream_url: string;
  is_published: boolean;
  publish_at: string | null;
  created_by: string;
  created_at: string;
}

export default function TournamentsPage() {
  const supabase = createClient();
  const [events, setEvents] = useState<Event[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      let query = supabase
        .from("events")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("type", filter);
      }

      const { data } = await query;
      if (data) setEvents(data);
      setLoading(false);
    };
    fetchEvents();
  }, [filter]);

 const typeLabels: Record<string, string> = {
  all: "Все",
  training: "Тренировки",
  bo: "БО",
  tournament: "Турниры",
  kv: "КВ",
  solo: "Соло-турниры",
};

  const typeBadge: Record<string, string> = {
    training: "bg-blue-700",
    bo: "bg-red-700",
    tournament: "bg-yellow-600",
    kv: "bg-purple-700",
  };

  return (
    <div className="min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-blue-500">Турниры</h1>
        {user && (
          <Link
            href="/tournaments/propose"
            className="px-4 py-2 bg-green-500 rounded hover:bg-green-600 whitespace-nowrap"
          >
            + Предложить мероприятие
          </Link>
        )}
      </div>

      {/* Фильтры */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {Object.entries(typeLabels).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={"px-3 py-1 rounded text-sm " + (filter === key ? "bg-blue-500" : "bg-gray-700 hover:bg-gray-600")}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Загрузка...</p>
      ) : events.length === 0 ? (
        <p className="text-gray-400">Мероприятий пока нет.</p>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/tournaments/${event.id}`}
              className="block bg-gray-800 rounded hover:bg-gray-700 overflow-hidden"
            >
              {event.image_url && (
                <img src={event.image_url} alt={event.title} className="w-full h-40 object-cover" />
              )}
              <div className="p-4">
                <span className={"text-xs px-2 py-0.5 rounded " + (typeBadge[event.type] || "bg-gray-600")}>
                  {typeLabels[event.type] || event.type}
                </span>
                <h2 className="text-xl font-semibold mt-2">{event.title}</h2>
                {event.description && <p className="text-gray-400 text-sm mt-1">{event.description}</p>}
                <div className="text-right text-sm text-gray-400 mt-2">
                  {event.cost > 0 && <p className="text-yellow-400">{event.cost} ₽</p>}
                  {event.organizer && <p>Орг: {event.organizer}</p>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}