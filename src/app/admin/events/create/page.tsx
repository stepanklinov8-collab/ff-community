"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authFetch } from "@/utils/api/auth-fetch";

interface SessionForm {
  startTime: string;
  endTime: string;
  registrationOpenTime: string;
  registrationCloseTime: string;
  maxTeams: string;
  reminderMinutes: string;
}

const emptySession = (): SessionForm => ({
  startTime: "",
  endTime: "",
  registrationOpenTime: "",
  registrationCloseTime: "",
  maxTeams: "",
  reminderMinutes: "60",
});

function toIso(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export default function CreateEventPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("training");
  const [cost, setCost] = useState("0");
  const [organizer, setOrganizer] = useState("");
  const [organizerId, setOrganizerId] = useState("");
  const [description, setDescription] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [paymentUrl, setPaymentUrl] = useState("");
  const [maxTeams, setMaxTeams] = useState("12");
  const [minPlayers, setMinPlayers] = useState("4");
  const [rosterLock, setRosterLock] = useState("10");
  const [publishAt, setPublishAt] = useState("");
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [sessions, setSessions] = useState<SessionForm[]>([emptySession()]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const updateSession = (index: number, field: keyof SessionForm, value: string) => {
    setSessions((current) => current.map((session, sessionIndex) =>
      sessionIndex === index ? { ...session, [field]: value } : session,
    ));
  };

  const handleCreate = async () => {
    if (!title.trim()) { setMessage("Введите название."); return; }
    if (sessions.some((session) => !session.startTime)) { setMessage("Укажите начало каждой сессии."); return; }
    if (imageFile && (imageFile.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(imageFile.type))) {
      setMessage("Обложка: JPEG/PNG/WebP, не более 5 МБ.");
      return;
    }

    const payload = {
      title: title.trim(),
      type,
      cost: Number(cost) || 0,
      organizer: organizer.trim(),
      organizerUserId: organizerId.trim() || null,
      description: description.trim(),
      streamUrl: streamUrl.trim(),
      paymentUrl: paymentUrl.trim(),
      maxTeams: Number(maxTeams) || 0,
      minPlayers: Number(minPlayers) || 4,
      rosterLockMinutes: Number(rosterLock) || 0,
      publishAt: toIso(publishAt),
      commentsEnabled,
      sessions: sessions.map((session) => ({
        startTime: toIso(session.startTime),
        endTime: toIso(session.endTime),
        registrationOpenTime: toIso(session.registrationOpenTime),
        registrationCloseTime: toIso(session.registrationCloseTime),
        maxTeams: Number(session.maxTeams) || Number(maxTeams) || 0,
        reminderMinutes: session.reminderMinutes
          .split(",")
          .map((value) => Number(value.trim()))
          .filter((value) => Number.isInteger(value) && value > 0),
      })),
    };
    const formData = new FormData();
    formData.set("payload", JSON.stringify(payload));
    if (imageFile) formData.set("image", imageFile);

    setBusy(true);
    setMessage("Создаём мероприятие...");
    const response = await authFetch("/api/admin/events", { method: "POST", body: formData });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) {
      setMessage(result.error ?? "Не удалось создать мероприятие.");
      return;
    }
    setMessage("Мероприятие создано.");
    window.setTimeout(() => router.push(`/tournaments/${result.eventId}`), 900);
  };

  return (
    <div className="min-h-screen p-4 md:p-7">
      <span className="section-kicker">АДМИН-ПАНЕЛЬ</span>
      <h1 className="mb-6 mt-2 text-3xl font-black">Новое мероприятие</h1>

      <section className="cyber-card max-w-3xl space-y-5 p-5 md:p-7">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm text-slate-300">Название<input className="mt-2" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} /></label>
          <label className="text-sm text-slate-300">Тип
            <select className="mt-2" value={type} onChange={(event) => setType(event.target.value)}>
              <option value="training">Тренировка</option><option value="bo">БО</option>
              <option value="tournament">Турнир</option><option value="kv">КВ</option><option value="solo">Соло</option>
            </select>
          </label>
          <label className="text-sm text-slate-300">Организатор<input className="mt-2" value={organizer} onChange={(event) => setOrganizer(event.target.value)} /></label>
          <label className="text-sm text-slate-300">ID аккаунта организатора<input className="mt-2" value={organizerId} onChange={(event) => setOrganizerId(event.target.value)} placeholder="Пусто — текущий администратор" /></label>
          <label className="text-sm text-slate-300">Стоимость, ₽<input className="mt-2" type="number" min={0} value={cost} onChange={(event) => setCost(event.target.value)} /></label>
          <label className="text-sm text-slate-300">Лимит команд по умолчанию<input className="mt-2" type="number" min={0} value={maxTeams} onChange={(event) => setMaxTeams(event.target.value)} /></label>
          <label className="text-sm text-slate-300">Минимум игроков<input className="mt-2" type="number" min={1} value={minPlayers} onChange={(event) => setMinPlayers(event.target.value)} /></label>
          <label className="text-sm text-slate-300">Блокировка состава, минут<input className="mt-2" type="number" min={0} value={rosterLock} onChange={(event) => setRosterLock(event.target.value)} /></label>
        </div>

        <label className="block text-sm text-slate-300">Описание<textarea className="mt-2" rows={5} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm text-slate-300">Ссылка на трансляцию<input className="mt-2" type="url" value={streamUrl} onChange={(event) => setStreamUrl(event.target.value)} placeholder="https://..." /></label>
          <label className="text-sm text-slate-300">Ссылка для оплаты<input className="mt-2" type="url" value={paymentUrl} onChange={(event) => setPaymentUrl(event.target.value)} placeholder="https://..." /></label>
          <label className="text-sm text-slate-300">Дата публикации<input className="mt-2" type="datetime-local" value={publishAt} onChange={(event) => setPublishAt(event.target.value)} /></label>
          <label className="text-sm text-slate-300">Обложка<input className="mt-2" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} /></label>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={commentsEnabled} onChange={(event) => setCommentsEnabled(event.target.checked)} /> Разрешить комментарии</label>

        <div className="flex items-center justify-between gap-3">
          <div><span className="section-kicker">РАСПИСАНИЕ</span><h2 className="mt-1 text-xl font-bold">Сессии</h2></div>
          <button type="button" onClick={() => setSessions((current) => [...current, emptySession()])} className="secondary-button">+ Добавить время</button>
        </div>
        <div className="space-y-4">
          {sessions.map((session, index) => (
            <fieldset key={index} className="rounded-2xl border border-sky-900/30 bg-slate-950/35 p-4">
              <div className="mb-3 flex justify-between">
                <legend className="font-semibold">Сессия {index + 1}</legend>
                {sessions.length > 1 && <button type="button" onClick={() => setSessions((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-sm text-red-300">Удалить</button>}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs text-slate-400">Начало<input className="mt-1" type="datetime-local" value={session.startTime} onChange={(event) => updateSession(index, "startTime", event.target.value)} /></label>
                <label className="text-xs text-slate-400">Конец<input className="mt-1" type="datetime-local" value={session.endTime} onChange={(event) => updateSession(index, "endTime", event.target.value)} /></label>
                <label className="text-xs text-slate-400">Открытие регистрации<input className="mt-1" type="datetime-local" value={session.registrationOpenTime} onChange={(event) => updateSession(index, "registrationOpenTime", event.target.value)} /></label>
                <label className="text-xs text-slate-400">Закрытие регистрации<input className="mt-1" type="datetime-local" value={session.registrationCloseTime} onChange={(event) => updateSession(index, "registrationCloseTime", event.target.value)} /></label>
                <label className="text-xs text-slate-400">Лимит команд<input className="mt-1" type="number" min={0} value={session.maxTeams} onChange={(event) => updateSession(index, "maxTeams", event.target.value)} placeholder={maxTeams} /></label>
                <label className="text-xs text-slate-400">Напоминания, минут через запятую<input className="mt-1" value={session.reminderMinutes} onChange={(event) => updateSession(index, "reminderMinutes", event.target.value)} placeholder="60, 15" /></label>
              </div>
            </fieldset>
          ))}
        </div>

        <button type="button" onClick={handleCreate} disabled={busy} className="primary-button w-full disabled:opacity-50">{busy ? "Создание..." : "Создать мероприятие"}</button>
        {message && <p className="rounded-xl bg-slate-950/50 p-3 text-sm">{message}</p>}
        <Link href="/admin" className="block text-sm text-cyan-300 hover:underline">← Админ-панель</Link>
      </section>
    </div>
  );
}
