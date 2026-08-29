"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function AddEventStatsPage() {
  const { id } = useParams();
  const supabase = createClient();
  const router = useRouter();
  const [kills, setKills] = useState("");
  const [matches, setMatches] = useState("");
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkParticipation = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setChecking(false); return; }

      // Получаем событие
      const { data: ev } = await supabase.from("events").select("title").eq("id", id).single();
      if (ev) setEventTitle(ev.title);

      // Проверяем, состоит ли пользователь в команде, зарегистрированной на событие
      const { data: member } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user.id)
        .single();

      if (member) {
        const { data: reg } = await supabase
          .from("event_registrations")
          .select("id, status")
          .eq("event_id", id)
          .eq("team_id", member.team_id)
          .eq("status", "confirmed")
          .single();

        if (reg) setAllowed(true);
      }
      setChecking(false);
    };
    checkParticipation();
  }, [id]);

  const handleSubmit = async () => {
    if (!kills || !matches) { setMessage("Заполните киллы и матчи"); return; }
    if (screenshots.length === 0) { setMessage("Прикрепите хотя бы один скриншот"); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Загружаем скриншоты
    const uploadedUrls: string[] = [];
    for (const file of screenshots) {
      const fileName = `event_stats_${user.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const { error } = await supabase.storage.from("stats-screenshots").upload(fileName, file);
      if (!error) {
        const { data: urlData } = supabase.storage.from("stats-screenshots").getPublicUrl(fileName);
        uploadedUrls.push(urlData.publicUrl);
      }
    }

    const { error } = await supabase.from("player_stats").insert({
      user_id: user.id,
      event_id: id,
      event_title: eventTitle,
      kills: parseInt(kills),
      matches_played: parseInt(matches),
      screenshot_url: uploadedUrls.join(","),
    });

    if (error) {
      setMessage("Ошибка: " + error.message);
    } else {
      setMessage("Статистика отправлена на модерацию!");
      setTimeout(() => router.push(`/tournaments/${id}`), 1500);
    }
  };

  if (checking) return <div className="min-h-screen p-6"><p>Проверка...</p></div>;

  if (!allowed) {
    return (
      <div className="min-h-screen p-6">
        <p>Вы не можете добавить статистику — ваша команда не участвовала в этом мероприятии.</p>
        <Link href={`/tournaments/${id}`} className="text-blue-400">← Назад</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <Link href={`/tournaments/${id}`} className="text-blue-400 hover:underline">← К мероприятию</Link>
      <h1 className="text-3xl font-bold mb-2 text-blue-500 mt-4">Добавить статистику</h1>
      <p className="text-gray-400 mb-6">{eventTitle}</p>

      <div className="bg-gray-800 p-6 rounded max-w-md">
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
          <label className="text-gray-400 text-sm block mb-1">Скриншоты (можно несколько)</label>
          <input
            className="w-full text-sm text-white"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setScreenshots(Array.from(e.target.files || []))}
          />
        </div>
        <button
          onClick={handleSubmit}
          className="w-full p-2 bg-green-500 rounded hover:bg-green-600"
        >
          Отправить на модерацию
        </button>
        {message && <p className="mt-3 p-2 bg-gray-700 rounded">{message}</p>}
      </div>
    </div>
  );
}