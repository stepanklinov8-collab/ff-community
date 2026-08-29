"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

interface Event {
  id: string;
  title: string;
  type: string;
  description: string;
  cost: number;
  organizer: string;
  created_by: string;
  is_published: boolean;
  created_at: string;
}

export default function ProposalsPage() {
  const supabase = createClient();
  const [proposals, setProposals] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("is_published", false)
        .order("created_at", { ascending: false });
      if (data) setProposals(data);
      setLoading(false);
    };
    fetch();
  }, []);

  const approve = async (eventId: string) => {
    await supabase.from("events").update({ is_published: true }).eq("id", eventId);
    setProposals(proposals.filter(p => p.id !== eventId));
    setMessage("Мероприятие опубликовано!");
  };

  const reject = async (eventId: string) => {
    if (!confirm("Отклонить и удалить предложение?")) return;
    await supabase.from("events").delete().eq("id", eventId);
    setProposals(proposals.filter(p => p.id !== eventId));
    setMessage("Предложение отклонено.");
  };

  const typeLabels: Record<string, string> = {
    training: "Тренировка",
    bo: "БО",
    tournament: "Турнир",
    kv: "КВ",
  };

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-6 text-yellow-500">Предложенные мероприятия</h1>
      {message && <div className="mb-4 p-3 bg-gray-800 rounded">{message}</div>}

      {loading ? <p>Загрузка...</p> : proposals.length === 0 ? (
        <p className="text-gray-400">Нет предложенных мероприятий.</p>
      ) : (
        <div className="space-y-4">
          {proposals.map((p) => (
            <div key={p.id} className="bg-gray-800 p-4 rounded">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">{typeLabels[p.type] || p.type}</span>
                  <h2 className="text-xl font-semibold mt-2">{p.title}</h2>
                  <p className="text-gray-400 text-sm mt-1">{p.description || "Нет описания"}</p>
                  <p className="text-gray-500 text-xs mt-2">Предложил: {p.created_by || "—"}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approve(p.id)} className="px-3 py-1 bg-green-600 rounded text-sm">Опубликовать</button>
                  <button onClick={() => reject(p.id)} className="px-3 py-1 bg-red-600 rounded text-sm">Отклонить</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Link href="/admin" className="block mt-6 text-blue-400 hover:underline">← Админ-панель</Link>
    </div>
  );
}