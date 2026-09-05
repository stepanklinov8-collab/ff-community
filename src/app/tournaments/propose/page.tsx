"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authFetch } from "@/utils/api/auth-fetch";

interface Session {
  startTime: string;
  endTime: string;
  regOpenTime: string;
}

export default function ProposeEventPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("training");
  const [cost, setCost] = useState("0");
  const [organizer, setOrganizer] = useState("");
  const [description, setDescription] = useState("");
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

  const handlePropose = async () => {
    if (!title) {
      setMessage("Введите название");
      return;
    }
    if (sessions.some((s) => !s.startTime)) {
      setMessage("Укажите дату и время начала для всех сессий");
      return;
    }

    setMessage("Отправка...");

    const response = await authFetch("/api/events/proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        type,
        cost: parseInt(cost, 10) || 0,
        organizer,
        description,
        sessions: sessions.map((session) => ({
          startTime: new Date(session.startTime).toISOString(),
          endTime: session.endTime ? new Date(session.endTime).toISOString() : null,
          registrationOpenTime: session.regOpenTime ? new Date(session.regOpenTime).toISOString() : null,
        })),
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error || "Не удалось отправить предложение");
      return;
    }
    setMessage("Мероприятие предложено! Администратор рассмотрит его.");
    setTimeout(() => router.push("/tournaments"), 1500);
  };

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-2 text-blue-500">
        Предложить мероприятие
      </h1>
      <p className="text-gray-400 mb-6">
        Заполните форму. Админ рассмотрит ваше предложение и опубликует его.
      </p>

      <div className="max-w-lg space-y-4">
        <input
          className="w-full p-2 text-black rounded"
          placeholder="Название мероприятия"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <select
          className="w-full p-2 text-black rounded"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="training">Тренировка</option>
          <option value="bo">БО</option>
          <option value="tournament">Турнир</option>
        </select>

        <p className="rounded-lg border border-cyan-800/40 bg-cyan-950/25 p-3 text-sm text-cyan-100">
          КВ больше не требуют модерации. <Link href="/clan-wars/create" className="font-semibold underline">Создать КВ сразу →</Link>
        </p>

        <input
          className="w-full p-2 text-black rounded"
          type="number"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="Стоимость участия (0 = бесплатно)"
        />

        <input
          className="w-full p-2 text-black rounded"
          placeholder="Организатор (ваше имя или ник)"
          value={organizer}
          onChange={(e) => setOrganizer(e.target.value)}
        />

        <textarea
          className="w-full p-2 text-black rounded"
          placeholder="Описание мероприятия"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />

        {/* Сессии */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-gray-400 text-sm font-semibold">
              Даты проведения
            </label>
            <button
              onClick={addSession}
              className="px-3 py-1 bg-blue-500 rounded text-sm hover:bg-blue-600"
            >
              + Добавить дату
            </button>
          </div>

          {sessions.map((s, i) => (
            <div key={i} className="bg-gray-800 p-4 rounded mb-3 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400 font-semibold">Сессия {i + 1}</span>
                {sessions.length > 1 && (
                  <button
                    onClick={() => removeSession(i)}
                    className="text-red-400 text-sm hover:text-red-300"
                  >
                    ✕ Удалить
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <input
                    className="w-full p-2 text-black rounded"
                    type="datetime-local"
                    value={s.startTime}
                    onChange={(e) => updateSession(i, "startTime", e.target.value)}
                    title="Начало сессии"
                  />
                </div>
                <span className="text-gray-400 text-xs whitespace-nowrap">📅 Начало (обязательно)</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <input
                    className="w-full p-2 text-black rounded"
                    type="datetime-local"
                    value={s.endTime}
                    onChange={(e) => updateSession(i, "endTime", e.target.value)}
                    title="Конец сессии"
                  />
                </div>
                <span className="text-gray-400 text-xs whitespace-nowrap">🏁 Конец</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <input
                    className="w-full p-2 text-black rounded"
                    type="datetime-local"
                    value={s.regOpenTime}
                    onChange={(e) => updateSession(i, "regOpenTime", e.target.value)}
                    title="Открытие регистрации"
                  />
                </div>
                <span className="text-gray-400 text-xs whitespace-nowrap">🔓 Регистрация</span>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handlePropose}
          className="w-full p-3 bg-green-500 rounded hover:bg-green-600 font-semibold"
        >
          Предложить мероприятие
        </button>

        {message && (
          <div className="p-3 bg-gray-800 rounded text-center">{message}</div>
        )}

        <Link
          href="/tournaments"
          className="block text-center text-blue-400 hover:underline"
        >
          ← К турнирам
        </Link>
      </div>
    </div>
  );
}
