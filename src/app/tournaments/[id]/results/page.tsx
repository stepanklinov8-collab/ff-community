"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { useParams } from "next/navigation";
import Link from "next/link";

interface EventInfo {
  id: string;
  title: string;
  type: string;
}

interface TeamResult {
  id: string;
  team_id: string;
  team_name: string;
  score: number;
  is_winner: boolean;
  mvp_user_id: string | null;
  mvp_nickname: string;
}

export default function EventResultsPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [results, setResults] = useState<TeamResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      // Получаем информацию о мероприятии
      const { data: ev } = await supabase
        .from("events")
        .select("id, title, type")
        .eq("id", id)
        .single();
      if (ev) setEvent(ev);

      const response = await fetch(`/api/events/${id}/results`);
      if (response.ok) {
        const payload = await response.json() as { results?: TeamResult[] };
        setResults(payload.results ?? []);
      }

      setLoading(false);
    };
    init();
  }, [id, supabase]);

  if (loading) return <div className="min-h-screen p-6"><p>Загрузка...</p></div>;
  if (!event) return <div className="min-h-screen p-6"><p>Мероприятие не найдено.</p></div>;

  return (
    <div className="min-h-screen p-6">
      <Link href={`/tournaments/${id}`} className="text-blue-400 hover:underline">← К мероприятию</Link>
      <h1 className="text-3xl font-bold mb-2 text-blue-500 mt-4">{event.title}</h1>
      <p className="text-gray-400 mb-6">Результаты мероприятия</p>

      {results.length === 0 ? (
        <p className="text-gray-400">Результаты ещё не опубликованы.</p>
      ) : (
        <div className="space-y-4">
          {results.map((r) => (
            <div
              key={r.id}
              className={"bg-gray-800 p-4 rounded " + (r.is_winner ? "ring-2 ring-yellow-500" : "")}
            >
              <div className="flex justify-between items-center mb-3">
                <Link href={`/teams/${r.team_id}`} className="text-xl font-semibold text-blue-400 hover:underline">
                  {r.team_name}
                </Link>
                <div className="flex items-center gap-3">
                  {r.is_winner && <span className="text-yellow-400">🏆 Победитель</span>}
                  <span className="text-2xl font-bold">{r.score}</span>
                </div>
              </div>

              {r.mvp_user_id && (
                <div className="bg-gray-700 p-2 rounded inline-block">
                  <span className="text-gray-400 text-sm">MVP: </span>
                  <Link href={`/profile/${r.mvp_user_id}`} className="text-yellow-400 hover:underline">
                    {r.mvp_nickname}
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Ссылка для админа на управление результатами */}
      <Link
        href={`/tournaments/${id}`}
        className="inline-block mt-6 text-blue-400 hover:underline"
      >
        ← Назад к мероприятию
      </Link>
    </div>
  );
}
