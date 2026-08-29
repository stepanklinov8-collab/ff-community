"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function MyStatsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [kills, setKills] = useState("");
  const [matches, setMatches] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [myStats, setMyStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("player_stats")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) setMyStats(data);
      setLoading(false);
    };
    fetchStats();
  }, []);

  const handleSubmit = async () => {
    if (!kills || !matches) {
      setMessage("Заполните киллы и матчи");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let screenshotUrl = "";
    if (screenshot) {
      const fileName = `stats_${user.id}_${Date.now()}`;
      const { error: uploadError } = await supabase.storage.from("stats-screenshots").upload(fileName, screenshot);
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("stats-screenshots").getPublicUrl(fileName);
        screenshotUrl = urlData.publicUrl;
      }
    }

    const { error } = await supabase.from("player_stats").insert({
      user_id: user.id,
      kills: parseInt(kills),
      matches_played: parseInt(matches),
      screenshot_url: screenshotUrl,
    });

    if (error) {
      setMessage("Ошибка: " + error.message);
    } else {
      setMessage("Статистика отправлена на модерацию!");
      setKills("");
      setMatches("");
      setScreenshot(null);
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen p-6">
      <Link href="/profile" className="text-blue-400 hover:underline">← В профиль</Link>
      <h1 className="text-3xl font-bold mb-6 text-blue-500 mt-4">Моя статистика</h1>

      <div className="bg-gray-800 p-6 rounded max-w-md mb-6">
        <h2 className="text-xl font-semibold mb-4">Внести результат</h2>
        <input
          className="w-full p-2 mb-3 text-black rounded"
          type="number"
          placeholder="Киллы"
          value={kills}
          onChange={(e) => setKills(e.target.value)}
        />
        <input
          className="w-full p-2 mb-3 text-black rounded"
          type="number"
          placeholder="Сыграно матчей"
          value={matches}
          onChange={(e) => setMatches(e.target.value)}
        />
        <div className="mb-4">
          <label className="text-gray-400 text-sm block mb-1">Скриншот (обязательно)</label>
          <input
            className="w-full text-sm text-white"
            type="file"
            accept="image/*"
            onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
          />
        </div>
        <button
          onClick={handleSubmit}
          className="w-full p-2 bg-blue-500 rounded hover:bg-blue-600"
        >
          Отправить на модерацию
        </button>
        {message && <p className="mt-3 p-2 bg-gray-700 rounded">{message}</p>}
      </div>

      <h2 className="text-xl font-semibold mb-4">История заявок</h2>
      {loading ? <p>Загрузка...</p> : myStats.length === 0 ? (
        <p className="text-gray-400">Заявок пока нет.</p>
      ) : (
        <div className="space-y-2">
          {myStats.map((s) => (
            <div key={s.id} className="bg-gray-800 p-3 rounded flex justify-between items-center">
              <span>Киллы: {s.kills} | Матчи: {s.matches_played}</span>
              <span className={s.status === "approved" ? "text-green-400" : s.status === "rejected" ? "text-red-400" : "text-yellow-400"}>
                {s.status === "approved" ? "✓" : s.status === "rejected" ? "✕" : "⏳"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}