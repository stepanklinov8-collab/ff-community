"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AddStatsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [kills, setKills] = useState("");
  const [matches, setMatches] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const handleSubmit = async () => {
    if (!user) {
      setMessage("Вы не авторизованы.");
      return;
    }
    if (!kills || !matches) {
      setMessage("Заполните киллы и матчи.");
      return;
    }

    setUploading(true);
    let screenshotUrl = "";

    if (screenshot) {
      const fileName = `stats_${user.id}_${Date.now()}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, screenshot);

      if (uploadError) {
        setMessage("Ошибка загрузки скриншота: " + uploadError.message);
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);
      screenshotUrl = urlData.publicUrl;
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
      setTimeout(() => router.push("/profile"), 1500);
    }
    setUploading(false);
  };

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-6 text-blue-500">Добавить статистику</h1>

      <div className="max-w-md space-y-4">
        <input
          className="w-full p-3 text-black rounded"
          type="number"
          placeholder="Киллы"
          value={kills}
          onChange={(e) => setKills(e.target.value)}
        />
        <input
          className="w-full p-3 text-black rounded"
          type="number"
          placeholder="Сыграно матчей"
          value={matches}
          onChange={(e) => setMatches(e.target.value)}
        />
        <div>
          <label className="text-gray-400 text-sm block mb-1">Скриншот (обязательно для подтверждения)</label>
          <input
            className="w-full p-2 text-white bg-gray-700 rounded"
            type="file"
            accept="image/*"
            onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={uploading}
          className="w-full p-3 bg-blue-500 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {uploading ? "Отправка..." : "Отправить"}
        </button>
        {message && <p className="p-3 bg-gray-800 rounded text-center">{message}</p>}
        <Link href="/profile" className="block text-blue-400 hover:underline text-center">
          ← В профиль
        </Link>
      </div>
    </div>
  );
}