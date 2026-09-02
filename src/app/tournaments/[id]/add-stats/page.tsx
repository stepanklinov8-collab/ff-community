"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "@/utils/api/auth-fetch";
import { createClient } from "@/utils/supabase/client";

interface Session {
  id: string;
  start_time: string;
}

interface Registration {
  session_id: string | null;
  status: string;
  roster: string[];
}

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxFileSize = 5 * 1024 * 1024;

export default function AddEventStatsPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [kills, setKills] = useState("");
  const [matches, setMatches] = useState("");
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eligibleSessions, setEligibleSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const checkParticipation = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (active) setChecking(false);
        return;
      }
      const [{ data: event }, { data: sessions }, registrationsResponse] = await Promise.all([
        supabase.from("events").select("title").eq("id", id).single(),
        supabase.from("event_sessions_public").select("id, start_time").eq("event_id", id),
        authFetch(`/api/events/${id}/registrations`),
      ]);
      const payload = registrationsResponse.ok
        ? await registrationsResponse.json() as { registrations?: Registration[] }
        : { registrations: [] };
      const eligibleIds = new Set(
        (payload.registrations ?? [])
          .filter((registration) =>
            registration.status === "confirmed" &&
            registration.session_id &&
            registration.roster.includes(user.id)
          )
          .map((registration) => registration.session_id as string),
      );
      const available = (sessions ?? [])
        .filter((session) => eligibleIds.has(session.id) && new Date(session.start_time) <= new Date())
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
      if (active) {
        setEventTitle(event?.title ?? "");
        setEligibleSessions(available);
        setSelectedSessionId(available[0]?.id ?? "");
        setChecking(false);
      }
    };
    void checkParticipation();
    return () => { active = false; };
  }, [id, supabase]);

  const selectFiles = (files: File[]) => {
    if (files.length > 5) {
      setMessage("Можно прикрепить не более 5 файлов.");
      return;
    }
    const invalidType = files.find((file) => !allowedTypes.has(file.type));
    if (invalidType) {
      setMessage("Допустимы только JPEG, PNG и WebP.");
      return;
    }
    const oversized = files.find((file) => file.size > maxFileSize);
    if (oversized) {
      setMessage(`Файл «${oversized.name}» больше 5 МБ.`);
      return;
    }
    setMessage("");
    setScreenshots(files);
  };

  const handleSubmit = async () => {
    const killsNumber = Number(kills);
    const matchesNumber = Number(matches);
    if (!selectedSessionId) { setMessage("Выберите завершившуюся сессию."); return; }
    if (!Number.isInteger(killsNumber) || killsNumber < 0 || !Number.isInteger(matchesNumber) || matchesNumber < 1) {
      setMessage("Укажите корректное количество киллов и матчей.");
      return;
    }
    if (screenshots.length < 1) { setMessage("Прикрепите хотя бы один скриншот."); return; }

    const formData = new FormData();
    formData.set("eventId", id);
    formData.set("sessionId", selectedSessionId);
    formData.set("kills", String(killsNumber));
    formData.set("matches", String(matchesNumber));
    screenshots.forEach((file) => formData.append("screenshots", file));

    setSubmitting(true);
    setMessage("Загрузка...");
    const response = await authFetch("/api/stats/submissions", { method: "POST", body: formData });
    const payload = await response.json();
    setSubmitting(false);
    if (!response.ok) {
      setMessage(payload.error ?? "Не удалось отправить статистику.");
      return;
    }
    setMessage("Статистика отправлена на модерацию.");
    window.setTimeout(() => router.push(`/tournaments/${id}`), 1200);
  };

  if (checking) return <div className="min-h-screen p-6"><p>Проверка участия...</p></div>;
  if (eligibleSessions.length === 0) {
    return (
      <div className="min-h-screen p-6">
        <p>Нет начавшейся сессии, где вы указаны в подтверждённом составе.</p>
        <Link href={`/tournaments/${id}`} className="text-cyan-300">← Назад</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-7">
      <Link href={`/tournaments/${id}`} className="text-cyan-300 hover:underline">← К мероприятию</Link>
      <section className="cyber-card mt-5 max-w-xl p-6">
        <span className="section-kicker">ПОДТВЕРЖДЕНИЕ РЕЗУЛЬТАТА</span>
        <h1 className="mb-1 mt-2 text-3xl font-black">Добавить статистику</h1>
        <p className="mb-6 text-slate-400">{eventTitle}</p>

        <label className="mb-4 block text-sm text-slate-300">
          Сессия
          <select className="mt-2" value={selectedSessionId} onChange={(event) => setSelectedSessionId(event.target.value)}>
            {eligibleSessions.map((session) => (
              <option key={session.id} value={session.id}>{new Date(session.start_time).toLocaleString("ru")}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <input type="number" min={0} step={1} placeholder="Киллы" value={kills} onChange={(event) => setKills(event.target.value)} />
          <input type="number" min={1} step={1} placeholder="Матчи" value={matches} onChange={(event) => setMatches(event.target.value)} />
        </div>
        <label className="mt-4 block text-sm text-slate-300">
          Скриншоты — до 5 файлов по 5 МБ
          <input
            className="mt-2"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(event) => selectFiles(Array.from(event.target.files ?? []))}
          />
        </label>
        {screenshots.length > 0 && <p className="mt-2 text-xs text-slate-500">Выбрано файлов: {screenshots.length}</p>}
        <button type="button" onClick={handleSubmit} disabled={submitting} className="primary-button mt-5 w-full disabled:opacity-50">
          {submitting ? "Отправка..." : "Отправить на модерацию"}
        </button>
        {message && <p className="mt-4 rounded-xl bg-slate-950/50 p-3 text-sm">{message}</p>}
      </section>
    </div>
  );
}
