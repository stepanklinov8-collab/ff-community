"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

interface Team {
  id: string;
  name: string;
  description: string;
  type: string;
  created_at: string;
  avatar_url: string;
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchTeams = async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .eq("verified", true)
        .order("created_at", { ascending: false });

      if (!error && data) setTeams(data);
      setLoading(false);
    };
    fetchTeams();
  }, []);

  return (
    <div className="min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-blue-500">Команды и гильдии</h1>
        <Link
          href="/teams/create"
          className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600 whitespace-nowrap"
        >
          + Создать команду
        </Link>
      </div>

      {loading ? (
        <p>Загрузка...</p>
      ) : teams.length === 0 ? (
        <p className="text-gray-400">Пока нет верифицированных команд.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/teams/${team.id}`}
              className="bg-gray-800 p-4 rounded hover:bg-gray-700 transition"
            >
              {team.avatar_url && (
                <img src={team.avatar_url} alt={team.name} className="w-full h-32 object-cover rounded mb-2" />
              )}
              <span className="text-xs uppercase text-gray-400 bg-gray-700 px-2 py-1 rounded">
                {team.type === "guild" ? "Гильдия" : "Команда"}
              </span>
              <h2 className="text-xl font-semibold mt-2">{team.name}</h2>
              <p className="text-gray-400 text-sm mt-1 line-clamp-2">
                {team.description || "Нет описания"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}