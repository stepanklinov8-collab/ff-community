"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { authFetch } from "@/utils/api/auth-fetch";
import CommentsSection from "@/components/CommentsSection";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { User } from "@supabase/supabase-js";

interface Event {
  id: string;
  title: string;
  type: string;
  cost: number;
  organizer: string;
  organizer_user_id: string | null;
  description: string;
  image_url: string;
  stream_url: string;
  is_published: boolean;
  max_teams: number;
  show_registrations: boolean;
  roster_lock_minutes: number;
  min_players: number;
  comments_enabled?: boolean;
  payment_url?: string | null;
}

interface Session {
  id: string;
  start_time: string;
  end_time: string;
  registration_open_time: string;
  room_code?: string;
  room_password?: string;
  room_note?: string;
  can_edit_room?: boolean;
  responsible_user_id: string | null;
}

interface Registration {
  id: string;
  session_id: string | null;
  team_id: string;
  team_name: string;
  team_name_override: string;
  status: string;
  is_winner: boolean;
  created_at: string;
  roster: string[];
}

interface TeamMember {
  user_id: string;
  role_in_team: string;
  position: string;
  nickname: string;
}

interface PlayerSummary {
  id: string;
  nickname: string;
}

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const [event, setEvent] = useState<Event | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [myTeam, setMyTeam] = useState<{ id: string; name: string } | null>(null);
  const [canManageTeam, setCanManageTeam] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [myMembers, setMyMembers] = useState<TeamMember[]>([]);
  const [selectedRoster, setSelectedRoster] = useState<string[]>([]);
  const [showRosterForm, setShowRosterForm] = useState(false);

  const [scores, setScores] = useState<Record<string, number>>({});
  const [winnerTeamId, setWinnerTeamId] = useState("");

  const [selectedRegistrationId, setSelectedRegistrationId] = useState<string | null>(null);
  const [allPlayers, setAllPlayers] = useState<PlayerSummary[]>([]);

  const [showResponsible, setShowResponsible] = useState(false);
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const [roomData, setRoomData] = useState<Record<string, { code: string; password: string; note: string }>>({});

  const loadRegistrations = useCallback(async (authenticated: boolean) => {
    const response = authenticated
      ? await authFetch(`/api/events/${id}/registrations`)
      : await fetch(`/api/events/${id}/registrations`);
    if (!response.ok) return;
    const payload = await response.json() as { registrations?: Registration[] };
    setRegistrations(payload.registrations ?? []);
  }, [id]);

  useEffect(() => {
    const init = async () => {
      const { data: ev } = await supabase.from("events").select("*").eq("id", id).single();
      if (ev) setEvent(ev);

      const publicSessions = await supabase
        .from("event_sessions_public")
        .select("*")
        .eq("event_id", id)
        .order("start_time", { ascending: true });
      const legacySessions = publicSessions.error
        ? await supabase
            .from("event_sessions")
            .select("id, start_time, end_time, registration_open_time, responsible_user_id")
            .eq("event_id", id)
            .order("start_time", { ascending: true })
        : null;
      const sess = publicSessions.data ?? legacySessions?.data;
      if (sess) {
        setSessions(sess);
        setSelectedSessionId((current) => current || sess[0]?.id || "");
      }

      const { data: profiles } = await supabase.from("profiles").select("id, nickname");
      if (profiles) setAllPlayers(profiles);

      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      await loadRegistrations(Boolean(user));
      if (user) {
        try {
          const roomResponse = await authFetch(`/api/events/${id}/rooms`);
          if (roomResponse.ok) {
            const roomPayload = await roomResponse.json();
            setSessions((current) => current.map((session) => ({
              ...session,
              ...(roomPayload.sessions?.find((room: { id: string }) => room.id === session.id) ?? {}),
            })));
          }
        } catch {
          // Room credentials are optional and remain hidden when access is denied.
        }
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();
        if (roleData) setIsAdmin(true);

        const { data: ev2 } = await supabase.from("events").select("organizer_user_id").eq("id", id).single();
        if (ev2?.organizer_user_id === user.id) setIsOrganizer(true);

        const { data: memberships } = await supabase
          .from("team_members")
          .select("team_id, role_in_team")
          .eq("user_id", user.id);

        if (memberships?.length) {
          let member: (typeof memberships)[number] | null = null;
          for (const candidate of memberships) {
            const { data: candidateTeam } = await supabase
              .from("teams")
              .select("id, type, verified")
              .eq("id", candidate.team_id)
              .maybeSingle();
            if (candidateTeam?.type === "team" && candidateTeam.verified) {
              member = candidate;
              break;
            }
          }
          if (!member) {
            setLoading(false);
            return;
          }
          setCanManageTeam(["leader", "senior_deputy", "deputy"].includes(member.role_in_team));
          const { data: team } = await supabase
            .from("teams")
            .select("id, name")
            .eq("id", member.team_id)
            .eq("verified", true)
            .single();

          if (team) {
            setMyTeam(team);
            const { data: members } = await supabase
              .from("team_members")
              .select("user_id, role_in_team, position")
              .eq("team_id", team.id);
            if (members) {
              const enrichedMembers = await Promise.all(
                members.map(async (m) => {
                  const { data: profile } = await supabase
                    .from("profiles")
                    .select("nickname")
                    .eq("id", m.user_id)
                    .single();
                  return { ...m, nickname: profile?.nickname || "—" };
                })
              );
              setMyMembers(enrichedMembers);
              setSelectedRoster(
                enrichedMembers
                  .filter((item) => item.position === "main")
                  .slice(0, 4)
                  .map((item) => item.user_id),
              );
            }

          }
        }
      }

      setLoading(false);
    };
    init();
  }, [id, loadRegistrations, supabase]);

  const registerTeam = async () => {
    if (!myTeam) { setMessage("У вас нет верифицированной команды."); return; }
    if (!currentUser) { setMessage("Войдите, чтобы записать команду."); return; }
    if (!selectedSessionId) { setMessage("Выберите время участия."); return; }

    // Проверка минимального количества игроков, заданного для мероприятия
    const minPlayers = event?.min_players || 4;
    if (selectedRoster.length < minPlayers) {
      setMessage(`В составе команды должно быть минимум ${minPlayers} игроков.`);
      return;
    }

    setMessage("Регистрация...");
    const { data, error } = await supabase.rpc("register_team_for_session", {
      p_session_id: selectedSessionId,
      p_team_id: myTeam.id,
      p_roster: selectedRoster,
    });

    if (error) {
      setMessage("Ошибка: " + error.message);
    } else {
      const status = data?.[0]?.registration_status ?? "confirmed";
      setMessage(status === "confirmed" ? "✅ Вы в основном составе!" : "⏳ Вы в листе ожидания.");
      refreshRegistrations();
    }
  };

  const cancelRegistration = async () => {
    if (!alreadyRegistered) return;
    if (!confirm("Отменить регистрацию?")) return;

    if (!selectedRegistration) return;

    const { error } = await supabase.rpc("cancel_session_registration", {
      p_registration_id: selectedRegistration.id,
      p_reason: "Отменено руководством команды",
    });
    if (error) {
      setMessage("Ошибка: " + error.message);
      return;
    }

    setMessage("Регистрация отменена.");
    refreshRegistrations();
  };

  const toggleRegistrationsVisibility = async () => {
    if (!event) return;
    const newVisibility = !event.show_registrations;
    const response = await authFetch(`/api/events/${id}/manage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "visibility", showRegistrations: newVisibility }),
    });
    if (!response.ok) {
      const payload = await response.json();
      setMessage(payload.error ?? "Не удалось изменить видимость заявок");
      return;
    }
    setEvent({ ...event, show_registrations: newVisibility });
  };

  const saveResults = async () => {
    if (!event) return;
    const response = await authFetch(`/api/events/${id}/results`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        results: confirmed.map((registration) => ({
          teamId: registration.team_id,
          score: scores[registration.id] || 0,
          isWinner: registration.team_id === winnerTeamId,
        })),
      }),
    });
    if (!response.ok) {
      const payload = await response.json();
      setMessage(payload.error ?? "Не удалось сохранить результаты");
      return;
    }
    setMessage("Результаты сохранены.");
  };

  const assignResponsible = async (sessionId: string) => {
    if (!responsibleUserId) return;
    const response = await authFetch(`/api/events/${id}/manage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "responsible", sessionId, userId: responsibleUserId }),
    });
    if (!response.ok) {
      const payload = await response.json();
      setMessage(payload.error ?? "Не удалось назначить ответственного");
      return;
    }
    await fetchSessions();
    setResponsibleUserId("");
    setMessage("Ответственный назначен.");
  };

  const fetchSessions = async () => {
    const { data } = await supabase
      .from("event_sessions")
      .select("*")
      .eq("event_id", id)
      .order("start_time", { ascending: true });
    if (data) setSessions(data);
  };

  const saveRoomData = async (sessionId: string) => {
    const data = roomData[sessionId];
    if (!data) return;
    const response = await authFetch(`/api/events/${id}/rooms`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        roomCode: data.code ?? "",
        roomPassword: data.password ?? "",
        roomNote: data.note ?? "",
      }),
    });
    if (!response.ok) {
      const payload = await response.json();
      setMessage(payload.error ?? "Не удалось сохранить данные комнаты");
      return;
    }
    setMessage("Данные комнаты сохранены.");
  };

  const refreshRegistrations = async () => {
    await loadRegistrations(Boolean(currentUser));
  };

  const typeLabels: Record<string, string> = {
    training: "Тренировка",
    bo: "БО",
    tournament: "Турнир",
    kv: "КВ",
    solo: "Соло-турнир",
  };

  if (loading) return <div className="min-h-screen p-6"><p>Загрузка...</p></div>;
  if (!event) return <div className="min-h-screen p-6"><p>Мероприятие не найдено.</p></div>;

  const sessionRegistrations = registrations.filter((registration) => registration.session_id === selectedSessionId);
  const confirmed = sessionRegistrations.filter(r => r.status === "confirmed");
  const waiting = sessionRegistrations.filter(r => r.status === "waiting");
  const selectedSession = sessions.find((session) => session.id === selectedSessionId);
  const selectedRegistration = myTeam
    ? sessionRegistrations.find((registration) => registration.team_id === myTeam.id && registration.status !== "cancelled")
    : undefined;
  const alreadyRegistered = Boolean(selectedRegistration);
  const registrationStatus = selectedRegistration?.status ?? "";
  const lockTime = selectedSession
    ? new Date(new Date(selectedSession.start_time).getTime() - (event.roster_lock_minutes || 10) * 60_000)
    : null;
  const canEditRoster = !lockTime || new Date() < lockTime;
  const hasStarted = Boolean(selectedSession && new Date() >= new Date(selectedSession.start_time));
  const canViewRoom = isAdmin || isOrganizer || (myTeam && confirmed.some(r => r.team_id === myTeam.id));

  return (
    <div className="min-h-screen p-6">
      <Link href="/tournaments" className="text-blue-400 hover:underline">← К турнирам</Link>

      <div className="mt-4 bg-gray-800 p-6 rounded">
        <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">{typeLabels[event.type] || event.type}</span>
        <h1 className="text-3xl font-bold mt-3 text-blue-500">{event.title}</h1>

        {event.image_url && (
          <Image src={event.image_url} alt={event.title} width={900} height={500} unoptimized className="w-full max-w-md rounded-lg mt-4 object-cover" />
        )}

        <p className="text-gray-300 mt-4">{event.description || "Нет описания"}</p>

        {event.stream_url && (
          <a href={event.stream_url} target="_blank" className="inline-block mt-3 px-4 py-2 bg-red-600 rounded hover:bg-red-700">
            ▶ Смотреть стрим
          </a>
        )}

        <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
          {event.cost > 0 && <div><span className="text-gray-400">Стоимость:</span> {event.cost} ₽</div>}
          {event.organizer && <div><span className="text-gray-400">Организатор:</span> {event.organizer}</div>}
          {event.max_teams > 0 && <div><span className="text-gray-400">Лимит команд:</span> {event.max_teams}</div>}
          <div><span className="text-gray-400">Мин. игроков:</span> {event.min_players || 4}</div>
          <div><span className="text-gray-400">Блокировка состава:</span> за {event.roster_lock_minutes || 10} мин. до начала</div>
        </div>

        <Link href={`/tournaments/${id}/results`} className="inline-block mt-4 px-4 py-2 bg-blue-500 rounded hover:bg-blue-600">
          📊 Результаты
        </Link>
        {event.payment_url && (
          <a href={event.payment_url} target="_blank" rel="noopener noreferrer" className="ml-2 inline-block mt-4 px-4 py-2 bg-amber-500 text-black font-semibold rounded hover:bg-amber-400">
            Оплатить участие у организатора
          </a>
        )}

        {(isAdmin || isOrganizer) && (
          <div className="mt-4 flex gap-2 flex-wrap">
            <button onClick={toggleRegistrationsVisibility} className="px-3 py-1 bg-gray-600 rounded text-sm">
              {event.show_registrations ? "Скрыть участников" : "Показать участников"}
            </button>
            <button onClick={() => setShowResponsible(!showResponsible)} className="px-3 py-1 bg-blue-600 rounded text-sm">
              Назначить ответственных
            </button>
            {isAdmin && (
              <Link href={`/admin/events/${id}/stats`} className="px-3 py-1 bg-red-600 rounded text-sm">
                Модерация статистики
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Сессии */}
      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-4">Расписание</h2>
        {sessions.map((s) => {
          const isResponsible = s.responsible_user_id === currentUser?.id;
          const canEditRoom = Boolean(s.can_edit_room || isAdmin || isOrganizer || isResponsible);
          return (
            <div key={s.id} className="bg-gray-800 p-4 rounded mb-2">
              <p><span className="text-gray-400">Начало:</span> {new Date(s.start_time).toLocaleString("ru")}</p>
              {s.end_time && <p><span className="text-gray-400">Конец:</span> {new Date(s.end_time).toLocaleString("ru")}</p>}

              {showResponsible && (isAdmin || isOrganizer) && (
                <div className="mt-2 flex gap-2">
                  <input
                    className="flex-1 p-2 text-black rounded text-sm"
                    placeholder="ID ответственного"
                    value={responsibleUserId}
                    onChange={(e) => setResponsibleUserId(e.target.value)}
                  />
                  <button onClick={() => assignResponsible(s.id)} className="px-3 py-1 bg-green-600 rounded text-sm">Назначить</button>
                </div>
              )}

              {canEditRoom && (
                <div className="mt-3 bg-gray-700 p-3 rounded">
                  <p className="text-sm font-semibold mb-2">Данные комнаты</p>
                  <input
                    className="w-full p-2 text-black rounded mb-2"
                    placeholder="Код комнаты"
                    value={roomData[s.id]?.code || s.room_code}
                    onChange={(e) => setRoomData({ ...roomData, [s.id]: { ...roomData[s.id], code: e.target.value } })}
                  />
                  <input
                    className="w-full p-2 text-black rounded mb-2"
                    placeholder="Пароль"
                    value={roomData[s.id]?.password || s.room_password}
                    onChange={(e) => setRoomData({ ...roomData, [s.id]: { ...roomData[s.id], password: e.target.value } })}
                  />
                  <input
                    className="w-full p-2 text-black rounded mb-2"
                    placeholder="Примечание"
                    value={roomData[s.id]?.note || s.room_note}
                    onChange={(e) => setRoomData({ ...roomData, [s.id]: { ...roomData[s.id], note: e.target.value } })}
                  />
                  <button onClick={() => saveRoomData(s.id)} className="px-3 py-1 bg-blue-600 rounded text-sm">Сохранить и отправить</button>
                </div>
              )}

              {canViewRoom && (s.room_code || s.room_password) && !canEditRoom && (
                <div className="mt-3 bg-gray-700 p-3 rounded">
                  <p><span className="text-gray-400">Код:</span> {s.room_code}</p>
                  <p><span className="text-gray-400">Пароль:</span> {s.room_password}</p>
                  {s.room_note && <p><span className="text-gray-400">Примечание:</span> {s.room_note}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Запись */}
      {myTeam && canManageTeam && !alreadyRegistered && (
        <div className="mt-6 bg-gray-800 p-4 rounded">
          <p className="mb-3">Команда: <Link href={`/teams/${myTeam.id}`} className="text-blue-400">{myTeam.name}</Link></p>

          <div className="mb-4">
            <label className="text-sm text-gray-300 block mb-2">Выберите время участия</label>
            <select value={selectedSessionId} onChange={(event) => setSelectedSessionId(event.target.value)}>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {new Date(session.start_time).toLocaleString("ru")}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <button onClick={() => setShowRosterForm(!showRosterForm)} className="text-sm text-blue-400">
              {showRosterForm ? "Скрыть состав" : "Выбрать состав"} ({selectedRoster.length}/{event.min_players || 4})
            </button>
            {showRosterForm && (
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {myMembers.map((m) => (
                  <label key={m.user_id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedRoster.includes(m.user_id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedRoster([...selectedRoster, m.user_id]);
                        else setSelectedRoster(selectedRoster.filter(id => id !== m.user_id));
                      }}
                    />
                    {m.nickname} ({m.role_in_team === "leader" ? "Лидер" : m.role_in_team === "deputy" ? "Зам" : m.position === "main" ? "Основа" : "Запас"})
                  </label>
                ))}
              </div>
            )}
          </div>

          <button onClick={registerTeam} disabled={!canEditRoster} className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600 disabled:opacity-50">
            {canEditRoster ? "Записаться на выбранное время" : "Состав заблокирован"}
          </button>
          {message && <p className="mt-3 text-sm">{message}</p>}
        </div>
      )}

      {alreadyRegistered && canManageTeam && (
        <div className="mt-6 bg-gray-800 p-4 rounded">
          <label className="text-sm text-gray-300 block mb-2">Выбранное время</label>
          <select className="mb-3" value={selectedSessionId} onChange={(event) => setSelectedSessionId(event.target.value)}>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>{new Date(session.start_time).toLocaleString("ru")}</option>
            ))}
          </select>
          <p className="mb-2">{registrationStatus === "confirmed" ? "✅ Вы в основном составе" : "⏳ Вы в листе ожидания"}</p>
          <button onClick={cancelRegistration} className="px-4 py-2 bg-red-500 rounded hover:bg-red-600">Отменить запись</button>
        </div>
      )}

      {alreadyRegistered && registrationStatus === "confirmed" && hasStarted && (
        <div className="mt-6 bg-gray-800 p-4 rounded">
          <h3 className="text-lg font-semibold mb-3">Статистика</h3>
          <Link href={`/tournaments/${id}/add-stats`} className="px-4 py-2 bg-green-500 rounded hover:bg-green-600 inline-block">
            + Добавить статистику
          </Link>
        </div>
      )}

      {/* Результаты */}
      {hasStarted && (isAdmin || isOrganizer) && (
        <div className="mt-6 bg-gray-800 p-4 rounded">
          <h2 className="text-xl font-semibold mb-3">Результаты</h2>
          {confirmed.map(r => (
            <div key={r.id} className="flex items-center gap-3 mb-2">
              <input
                type="number"
                placeholder="Счёт"
                className="p-2 text-black rounded w-24"
                onChange={(e) => setScores(prev => ({ ...prev, [r.id]: parseInt(e.target.value) || 0 }))}
              />
              <span className="text-blue-400">{r.team_name_override || r.team_name}</span>
              <button
                onClick={() => setWinnerTeamId(r.team_id)}
                className={"px-3 py-1 rounded text-sm " + (winnerTeamId === r.team_id ? "bg-yellow-600" : "bg-gray-600")}
              >
                {winnerTeamId === r.team_id ? "🏆 Победитель" : "Отметить"}
              </button>
            </div>
          ))}
          <button onClick={saveResults} className="mt-2 px-4 py-2 bg-green-600 rounded hover:bg-green-700">Сохранить результаты</button>
        </div>
      )}

      {/* Заявки */}
      {(event.show_registrations || isAdmin || isOrganizer) && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-4">Заявки</h2>
          {confirmed.map((r) => (
            <div key={r.id} className="bg-gray-800 p-3 rounded mb-2">
              <div className="flex justify-between items-center">
                <div>
                  <button onClick={() => setSelectedRegistrationId(selectedRegistrationId === r.id ? null : r.id)} className="text-blue-400 hover:underline">
                    {r.team_name_override || r.team_name}
                  </button>
                  {r.is_winner && <span className="ml-2 text-yellow-400">🏆 Победитель</span>}
                </div>
                <span className="text-green-400">✓</span>
              </div>
              {selectedRegistrationId === r.id && (
                <div className="mt-2 text-sm text-gray-300">
                  {r.roster.length > 0 ? r.roster.map((userId: string) => {
                    const player = allPlayers.find((p) => p.id === userId);
                    return <div key={userId}>— {player?.nickname || userId}</div>;
                  }) : <p className="text-gray-500">Состав не указан</p>}
                </div>
              )}
            </div>
          ))}
          {waiting.map((r) => (
            <div key={r.id} className="bg-gray-800 p-3 rounded flex justify-between mb-2">
              <button onClick={() => setSelectedRegistrationId(selectedRegistrationId === r.id ? null : r.id)} className="text-blue-400 hover:underline">
                {r.team_name_override || r.team_name}
              </button>
              <span className="text-yellow-400">⏳</span>
            </div>
          ))}
        </div>
      )}
      {event.comments_enabled !== false && <CommentsSection eventId={id} />}
    </div>
  );
}
