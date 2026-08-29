"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CreateTeamPage() {
  const supabase = createClient();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("team");
  const [socialLink, setSocialLink] = useState("");
  const [message, setMessage] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) {
      setMessage("Введите название команды");
      return;
    }

    setMessage("Создание...");

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("Ошибка: вы не авторизованы");
      return;
    }

    const { data, error } = await supabase.from("teams").insert({
      name,
      description,
      type,
      social_link: socialLink,
      leader_id: user.id,
    }).select().single();

    if (error) {
      setMessage("Ошибка: " + error.message);
    } else {
      // Добавляем лидера в состав
      if (data) {
        await supabase.from("team_members").insert({
          team_id: data.id,
          user_id: user.id,
          role_in_team: "leader",
          position: "main",
        });

        // Запись в ленту активности
        await supabase.from("activity_log").insert({
          user_id: user.id,
          team_id: data.id,
          activity_type: "team_created",
          description: `Создана команда ${name}`,
        });
      }
      setMessage("Команда создана и отправлена на модерацию!");
      setTimeout(() => router.push("/profile"), 1500);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-6 text-blue-500">Создание команды</h1>

      <div className="max-w-md">
        <input
          className="w-full p-3 mb-4 text-black rounded"
          placeholder="Название"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <textarea
          className="w-full p-3 mb-4 text-black rounded"
          placeholder="Описание"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
        <select
          className="w-full p-3 mb-4 text-black rounded"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="team">Команда</option>
          <option value="guild">Гильдия</option>
        </select>
        <input
          className="w-full p-3 mb-6 text-black rounded"
          placeholder="Ссылка на соцсеть"
          value={socialLink}
          onChange={(e) => setSocialLink(e.target.value)}
        />
        <button
          className="w-full p-3 bg-blue-500 rounded hover:bg-blue-600 mb-4"
          onClick={handleCreate}
        >
          Создать
        </button>
        {message && (
          <p className="p-3 bg-gray-800 rounded text-center">{message}</p>
        )}
        <Link href="/profile" className="block mt-4 text-blue-400 hover:underline">
          ← Назад в профиль
        </Link>
      </div>
    </div>
  );
}