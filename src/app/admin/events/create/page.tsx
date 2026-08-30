"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Session {
  startTime: string;
  endTime: string;
  regOpenTime: string;
}

export default function CreateEventPage() {
  const supabase = createClient();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("training");
  const [cost, setCost] = useState("0");
  const [organizer, setOrganizer] = useState("");
  const [description, setDescription] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [maxTeams, setMaxTeams] = useState("0");
  const [rosterLock, setRosterLock] = useState("10");
  const [publishAt, setPublishAt] = useState("");
  const [organizerId, setOrganizerId] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const [sessions, setSessions] = useState<Session[]>([
    { startTime: "", endTime: "", regOpenTime: "" },
  ]);

  const addSession = () => {
    setSessions([...sessions, { startTime: "", endTime: "", regOpenTime: "" }]);
  };

  const removeSession = (index: number) => {
    setSessions(sessions.filter((_, i) => i !== index));
  };

  const updateSession = (index: number, field: keyof Session, value: string) => {
    const updated = [...sessions];
    updated[index][field] = value;
    setSessions(updated);
  };

  const handleCreate = async () => {
    if (!title) { setMessage("Введите название"); return; }
    if (sessions.some(s => !s.startTime)) { setMessage("Укажите время начала для всех сессий"); return; }

    setMessage("Создание...");
    setUploading(true);

    let imageUrl = "";

    if (imageFile) {
      const fileName = `${Date.now()}_${imageFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("event-images")
        .upload(fileName, imageFile);

      if (uploadError) {
        setMessage("Ошибка загрузки фото: " + uploadError.message);
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("event-images")
        .getPublicUrl(fileName);
      imageUrl = urlData.publicUrl;
    }

    const currentUser = (await supabase.auth.getUser()).data.user;

    const { data: event, error: eventError } = await supabase
      .from("events")
      .insert({
        title,
        type,
        cost: parseInt(cost) || 0,
        organizer,
        description,
        stream_url: streamUrl,
        image_url: imageUrl,
        max_teams: parseInt(maxTeams) || 0,
        roster_lock_minutes: parseInt(rosterLock) || 10,
        publish_at: publishAt ? new Date(publishAt).toISOString() : null,
        is_published: !publishAt,
        created_by: currentUser?.id,
        organizer_user_id: organizerId.trim() || currentUser?.id,
      })
      .select("id")
      .single();

    if (eventError || !event) {
      setMessage("Ошибка: " + eventError?.message);
      setUploading(false);
      return;
    }

    const sessionInserts = sessions.map((s) => ({
      event_id: event.id,
      start_time: new Date(s.startTime).toISOString(),
      end_time: s.endTime ? new Date(s.endTime).toISOString() : null,
      registration_open_time: s.regOpenTime ? new Date(s.regOpenTime).toISOString() : null,
    }));

    const { error: sessionError } = await supabase.from("event_sessions").insert(sessionInserts);

    if (sessionError) {
      setMessage("Ошибка сессий: " + sessionError.message);
    } else {
      setMessage("Мероприятие создано!");
      setTimeout(() => router.push("/tournaments"), 1000);
    }
    setUploading(false);
  };

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-6 text-blue-500">Создать мероприятие</h1>

      <div className="max-w-lg space-y-4">
        <input className="w-full p-2 text-black rounded" placeholder="Название" value={title} onChange={(e) => setTitle(e.target.value)} />
        <select className="w-full p-2 text-black rounded" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="training">Тренировка</option>
          <option value="bo">БО</option>
          <option value="tournament">Турнир</option>
          <option value="kv">КВ</option>
          <option value="solo">Соло-турнир</option>
        </select>
        <input className="w-full p-2 text-black rounded" type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Стоимость (0 = бесплатно)" />
        <input className="w-full p-2 text-black rounded" placeholder="Организатор (имя)" value={organizer} onChange={(e) => setOrganizer(e.target.value)} />
        <textarea className="w-full p-2 text-black rounded" placeholder="Описание" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />

        <div>
          <label className="text-gray-400 text-sm block mb-1">Ссылка на стрим</label>
          <input className="w-full p-2 text-black rounded" placeholder="https://..." value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} />
        </div>

        <div>
          <label className="text-gray-400 text-sm block mb-1">Обложка мероприятия</label>
          <input className="w-full p-2 text-white rounded bg-gray-700" type="file" accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
        </div>

        <div>
          <label className="text-gray-400 text-sm block mb-1">Лимит команд (0 = без ограничений)</label>
          <input className="w-full p-2 text-black rounded" type="number" value={maxTeams} onChange={(e) => setMaxTeams(e.target.value)} />
        </div>

        <div>
          <label className="text-gray-400 text-sm block mb-1">Блокировка состава (минут до начала)</label>
          <input className="w-full p-2 text-black rounded" type="number" value={rosterLock} onChange={(e) => setRosterLock(e.target.value)} />
        </div>

        <div>
          <label className="text-gray-400 text-sm block mb-1">
            ID организатора (если пусто — организатором станете вы)
          </label>
          <input className="w-full p-2 text-black rounded" placeholder="Введите ID пользователя" value={organizerId} onChange={(e) => setOrganizerId(e.target.value)} />
        </div>

        <div>
          <label className="text-gray-400 text-sm block mb-1">Опубликовать (пусто = сразу)</label>
          <input className="w-full p-2 text-black rounded" type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-gray-400 text-sm font-semibold">Даты проведения</label>
            <button onClick={addSession} className="px-3 py-1 bg-blue-500 rounded text-sm">+ Добавить дату</button>
          </div>
          {sessions.map((s, i) => (
            <div key={i} className="bg-gray-800 p-3 rounded mb-2 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Сессия {i + 1}</span>
                {sessions.length > 1 && <button onClick={() => removeSession(i)} className="text-red-400 text-sm">Удалить</button>}
              </div>
              <input className="w-full p-2 text-black rounded" type="datetime-local" value={s.startTime} onChange={(e) => updateSession(i, "startTime", e.target.value)} placeholder="Начало" />
              <input className="w-full p-2 text-black rounded" type="datetime-local" value={s.endTime} onChange={(e) => updateSession(i, "endTime", e.target.value)} placeholder="Конец" />
              <input className="w-full p-2 text-black rounded" type="datetime-local" value={s.regOpenTime} onChange={(e) => updateSession(i, "regOpenTime", e.target.value)} placeholder="Открытие регистрации" />
            </div>
          ))}
        </div>

        <button onClick={handleCreate} disabled={uploading} className="w-full p-2 bg-blue-500 rounded hover:bg-blue-600 disabled:opacity-50">
          {uploading ? "Загрузка..." : "Создать"}
        </button>
        {message && <p className="p-3 bg-gray-800 rounded">{message}</p>}
        <Link href="/admin" className="block text-blue-400 hover:underline">← Админ-панель</Link>
      </div>
    </div>
  );
}