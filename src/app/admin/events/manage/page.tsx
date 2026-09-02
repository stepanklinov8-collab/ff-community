"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { authFetch } from "@/utils/api/auth-fetch";

interface Event {
  id: string;
  title: string;
  type: string;
  description: string;
  cost: number;
  organizer: string;
  stream_url: string;
  image_url: string;
  max_teams: number;
  roster_lock_minutes: number;
  is_published: boolean;
  created_at: string;
}

interface Session {
  id: string;
  start_time: string;
  end_time: string;
  registration_open_time: string;
}

interface Registration {
  id: string;
  team_id: string;
  team_name: string;
  team_name_override: string;
  status: string;
  created_at: string;
  roster: string[];
}

interface PlayerSummary {
  id: string;
  nickname: string;
}

export default function ManageEventsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState("training");
  const [editDescription, setEditDescription] = useState("");
  const [editCost, setEditCost] = useState("0");
  const [editOrganizer, setEditOrganizer] = useState("");
  const [editStreamUrl, setEditStreamUrl] = useState("");
  const [editMaxTeams, setEditMaxTeams] = useState("0");
  const [editRosterLock, setEditRosterLock] = useState("10");
  const [editPublished, setEditPublished] = useState(false);

  // Просмотр состава заявки
  const [selectedRegistrationId, setSelectedRegistrationId] = useState<string | null>(null);
  const [allPlayers, setAllPlayers] = useState<PlayerSummary[]>([]);

  const fetchEvents = useCallback(async () => {
    const response = await authFetch("/api/admin/events");
    const payload = await response.json() as { events?: Event[] };
    if (response.ok) setEvents(payload.events ?? []);
    else setMessage("Не удалось загрузить мероприятия");
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchEvents();
      void supabase.from("profiles").select("id, nickname").then(({ data }) => {
        if (data) setAllPlayers(data);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchEvents, supabase]);

  const selectEvent = async (event: Event) => {
    setSelectedEvent(event);
    setSelectedRegistrationId(null);

    const { data: sess } = await supabase
      .from("event_sessions")
      .select("*")
      .eq("event_id", event.id)
      .order("start_time", { ascending: true });
    if (sess) setSessions(sess);

    const response = await authFetch(`/api/events/${event.id}/registrations`);
    const payload = await response.json() as { registrations?: Registration[] };
    if (response.ok) setRegistrations(payload.registrations ?? []);
  };

  const startEdit = () => {
    if (!selectedEvent) return;
    setEditId(selectedEvent.id);
    setEditTitle(selectedEvent.title);
    setEditType(selectedEvent.type);
    setEditDescription(selectedEvent.description || "");
    setEditCost(String(selectedEvent.cost || 0));
    setEditOrganizer(selectedEvent.organizer || "");
    setEditStreamUrl(selectedEvent.stream_url || "");
    setEditMaxTeams(String(selectedEvent.max_teams || 0));
    setEditRosterLock(String(selectedEvent.roster_lock_minutes || 10));
    setEditPublished(selectedEvent.is_published);
  };

  const saveEdit = async () => {
    if (!editId) return;
    const response = await authFetch("/api/admin/events", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editId,
        title: editTitle,
        type: editType,
        description: editDescription,
        cost: parseInt(editCost) || 0,
        organizer: editOrganizer,
        streamUrl: editStreamUrl,
        maxTeams: parseInt(editMaxTeams) || 0,
        rosterLockMinutes: parseInt(editRosterLock) || 10,
        isPublished: editPublished,
      }),
    });

    if (response.ok) {
      setEditId(null);
      setMessage("Мероприятие обновлено!");
      fetchEvents();
      if (selectedEvent) selectEvent(selectedEvent);
    } else {
      const payload = await response.json();
      setMessage("Ошибка: " + (payload.error ?? "изменения не сохранены"));
    }
  };

  const togglePublish = async (event: Event) => {
    await authFetch("/api/admin/events", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: event.id, isPublished: !event.is_published }),
    });
    fetchEvents();
  };

  const deleteEvent = async (eventId: string) => {
    if (!confirm("Удалить мероприятие?")) return;
    await authFetch(`/api/admin/events?eventId=${encodeURIComponent(eventId)}`, { method: "DELETE" });
    setSelectedEvent(null);
    setSessions([]);
    setRegistrations([]);
    fetchEvents();
    setMessage("Мероприятие удалено.");
  };

  const updateRegistration = async (
    registrationId: string,
    changes: { status?: "confirmed" | "waiting" | "cancelled"; teamNameOverride?: string },
  ) => {
    await authFetch("/api/admin/events", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "registration", registrationId, ...changes }),
    });
  };

  const moveToWaiting = async (regId: string) => {
    await updateRegistration(regId, { status: "waiting" });
    if (selectedEvent) selectEvent(selectedEvent);
  };

  const moveToConfirmed = async (regId: string) => {
    await updateRegistration(regId, { status: "confirmed" });
    if (selectedEvent) selectEvent(selectedEvent);
  };

  const removeRegistration = async (regId: string, teamName: string) => {
    if (!confirm(`Удалить ${teamName} из заявок?`)) return;
    await authFetch(`/api/admin/events?registrationId=${encodeURIComponent(regId)}`, { method: "DELETE" });
    if (selectedEvent) selectEvent(selectedEvent);
  };

  const renameTeam = async (regId: string, currentName: string) => {
    const newName = prompt("Новое название команды на мероприятии:", currentName);
    if (newName && newName.trim()) {
      await updateRegistration(regId, { teamNameOverride: newName.trim() });
      if (selectedEvent) selectEvent(selectedEvent);
    }
  };

  const typeLabels: Record<string, string> = {
    training: "Тренировка",
    bo: "БО",
    tournament: "Турнир",
    kv: "КВ",
    solo: "Соло-турнир",
  };

  const confirmed = registrations.filter(r => r.status === "confirmed");
  const waiting = registrations.filter(r => r.status === "waiting");

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-6 text-blue-500">Управление мероприятиями</h1>
      {message && <div className="mb-4 p-3 bg-gray-800 rounded">{message}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Список мероприятий */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Мероприятия ({events.length})</h2>
          {loading ? (
            <p>Загрузка...</p>
          ) : events.length === 0 ? (
            <p className="text-gray-400">Мероприятий нет.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {events.map(event => (
                <div
                  key={event.id}
                  onClick={() => selectEvent(event)}
                  className={"bg-gray-800 p-3 rounded cursor-pointer hover:bg-gray-700 " + (selectedEvent?.id === event.id ? "ring-2 ring-blue-500" : "")}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">{event.title}</span>
                    <span className={event.is_published ? "text-green-400 text-sm" : "text-yellow-400 text-sm"}>
                      {event.is_published ? "✓" : "⏳"}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{typeLabels[event.type] || event.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Детали мероприятия */}
        <div>
          {selectedEvent ? (
            editId === selectedEvent.id ? (
              <div className="bg-gray-800 p-4 rounded space-y-3">
                <h2 className="text-xl font-semibold mb-2">Редактирование</h2>
                <input className="w-full p-2 text-black rounded" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Название" />
                <select className="w-full p-2 text-black rounded" value={editType} onChange={(e) => setEditType(e.target.value)}>
                  <option value="training">Тренировка</option>
                  <option value="bo">БО</option>
                  <option value="tournament">Турнир</option>
                  <option value="kv">КВ</option>
                  <option value="solo">Соло-турнир</option>
                </select>
                <textarea className="w-full p-2 text-black rounded" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} placeholder="Описание" />
                <input className="w-full p-2 text-black rounded" type="number" value={editCost} onChange={(e) => setEditCost(e.target.value)} placeholder="Стоимость" />
                <input className="w-full p-2 text-black rounded" value={editOrganizer} onChange={(e) => setEditOrganizer(e.target.value)} placeholder="Организатор" />
                <input className="w-full p-2 text-black rounded" value={editStreamUrl} onChange={(e) => setEditStreamUrl(e.target.value)} placeholder="Ссылка на стрим" />
                <input className="w-full p-2 text-black rounded" type="number" value={editMaxTeams} onChange={(e) => setEditMaxTeams(e.target.value)} placeholder="Лимит команд" />
                <input className="w-full p-2 text-black rounded" type="number" value={editRosterLock} onChange={(e) => setEditRosterLock(e.target.value)} placeholder="Блокировка состава (мин)" />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editPublished} onChange={(e) => setEditPublished(e.target.checked)} />
                  Опубликовано
                </label>
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="px-4 py-2 bg-green-600 rounded">Сохранить</button>
                  <button onClick={() => setEditId(null)} className="px-4 py-2 bg-gray-600 rounded">Отмена</button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-800 p-4 rounded space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-blue-500">{selectedEvent.title}</h2>
                    <p className="text-sm text-gray-400">{typeLabels[selectedEvent.type] || selectedEvent.type}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={startEdit} className="px-3 py-1 bg-blue-500 rounded text-sm">Редактировать</button>
                    <button onClick={() => togglePublish(selectedEvent)} className={"px-3 py-1 rounded text-sm " + (selectedEvent.is_published ? "bg-green-600" : "bg-gray-600")}>
                      {selectedEvent.is_published ? "Опубл." : "Скрыто"}
                    </button>
                    <button onClick={() => deleteEvent(selectedEvent.id)} className="px-3 py-1 bg-red-600 rounded text-sm">Удалить</button>
                  </div>
                </div>

                <div>
                  <span className="text-gray-400">Описание:</span>
                  <p>{selectedEvent.description || "Нет"}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-400">Стоимость:</span> {selectedEvent.cost || 0} ₽</div>
                  <div><span className="text-gray-400">Организатор:</span> {selectedEvent.organizer || "—"}</div>
                  <div><span className="text-gray-400">Лимит команд:</span> {selectedEvent.max_teams || 0}</div>
                  <div><span className="text-gray-400">Блокировка состава:</span> {selectedEvent.roster_lock_minutes || 10} мин</div>
                </div>

                {selectedEvent.stream_url && (
                  <a href={selectedEvent.stream_url} target="_blank" className="text-blue-400 text-sm">Ссылка на стрим</a>
                )}

                {/* Сессии */}
                <div>
                  <h3 className="font-semibold mb-2">Расписание ({sessions.length})</h3>
                  {sessions.length === 0 ? (
                    <p className="text-sm text-gray-400">Нет сессий</p>
                  ) : (
                    <div className="space-y-1 text-sm">
                      {sessions.map(s => (
                        <div key={s.id} className="bg-gray-700 p-2 rounded">
                          {new Date(s.start_time).toLocaleString("ru")}
                          {s.end_time && ` → ${new Date(s.end_time).toLocaleString("ru")}`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Заявки */}
                <div>
                  <h3 className="font-semibold mb-2">
                    Заявки (осн: {confirmed.length} / запас: {waiting.length})
                  </h3>

                  {confirmed.length > 0 && (
                    <div className="mb-3">
                      <p className="text-sm text-green-400 mb-1">Основные:</p>
                      <div className="space-y-1 text-sm">
                        {confirmed.map(r => (
                          <div key={r.id} className="bg-gray-700 p-2 rounded">
                            <div className="flex items-center justify-between gap-2">
                              <button
                                onClick={() => setSelectedRegistrationId(selectedRegistrationId === r.id ? null : r.id)}
                                className="text-blue-400 hover:underline"
                              >
                                {r.team_name_override || r.team_name}
                              </button>
                              <div className="flex gap-1">
                                <button onClick={() => renameTeam(r.id, r.team_name_override || r.team_name)} className="px-2 py-1 bg-gray-500 rounded text-xs">✏️</button>
                                <button onClick={() => moveToWaiting(r.id)} className="px-2 py-1 bg-yellow-600 rounded text-xs">В запас</button>
                                <button onClick={() => removeRegistration(r.id, r.team_name_override || r.team_name)} className="px-2 py-1 bg-red-600 rounded text-xs">✕</button>
                              </div>
                            </div>

                            {selectedRegistrationId === r.id && (
                              <div className="mt-2 text-xs text-gray-300">
                                {r.roster.length > 0 ? (
                                  r.roster.map((userId: string) => {
                                    const player = allPlayers.find((p) => p.id === userId);
                                    return <div key={userId}>— {player?.nickname || userId}</div>;
                                  })
                                ) : (
                                  <p className="text-gray-500">Состав не указан</p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {waiting.length > 0 && (
                    <div>
                      <p className="text-sm text-yellow-400 mb-1">Запас:</p>
                      <div className="space-y-1 text-sm">
                        {waiting.map(r => (
                          <div key={r.id} className="bg-gray-700 p-2 rounded">
                            <div className="flex items-center justify-between gap-2">
                              <button
                                onClick={() => setSelectedRegistrationId(selectedRegistrationId === r.id ? null : r.id)}
                                className="text-blue-400 hover:underline"
                              >
                                {r.team_name_override || r.team_name}
                              </button>
                              <div className="flex gap-1">
                                <button onClick={() => renameTeam(r.id, r.team_name_override || r.team_name)} className="px-2 py-1 bg-gray-500 rounded text-xs">✏️</button>
                                <button onClick={() => moveToConfirmed(r.id)} className="px-2 py-1 bg-green-600 rounded text-xs">В основу</button>
                                <button onClick={() => removeRegistration(r.id, r.team_name_override || r.team_name)} className="px-2 py-1 bg-red-600 rounded text-xs">✕</button>
                              </div>
                            </div>

                            {selectedRegistrationId === r.id && (
                              <div className="mt-2 text-xs text-gray-300">
                                {r.roster.length > 0 ? (
                                  r.roster.map((userId: string) => {
                                    const player = allPlayers.find((p) => p.id === userId);
                                    return <div key={userId}>— {player?.nickname || userId}</div>;
                                  })
                                ) : (
                                  <p className="text-gray-500">Состав не указан</p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {confirmed.length === 0 && waiting.length === 0 && (
                    <p className="text-sm text-gray-400">Нет заявок</p>
                  )}
                </div>
              </div>
            )
          ) : (
            <p className="text-gray-400">Выберите мероприятие слева.</p>
          )}
        </div>
      </div>

      <Link href="/admin" className="block mt-6 text-blue-400 hover:underline">← Админ-панель</Link>
    </div>
  );
}
