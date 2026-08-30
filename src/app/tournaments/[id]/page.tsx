"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useParams } from "next/navigation";
import Link from "next/link";

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
}

interface Session {
  id: string;
  start_time: string;
  end_time: string;
  registration_open_time: string;
  room_code: string;
  room_password: string;
  room_note: string;
  responsible_user_id: string | null;
}

interface Registration {
  id: string;
  team_id: string;
  team_name: string;
  team_name_override: string;
  status: string;
  is_winner: boolean;
  created_at: string;
  roster: string[];
}

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const [event, setEvent] = useState<Event | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [myTeam, setMyTeam] = useState<{ id: string; name: string } | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [myMembers, setMyMembers] = useState<any[]>([]);
  const [selectedRoster, setSelectedRoster] = useState<string[]>([]);
  const [showRosterForm, setShowRosterForm] = useState(false);
  const [canEditRoster, setCanEditRoster] = useState(true);

  const [scores, setScores] = useState<Record<string, number>>({});
  const [winnerTeamId, setWinnerTeamId] = useState("");

  const [selectedRegistrationId, setSelectedRegistrationId] = useState<string | null>(null);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);

  const [showResponsible, setShowResponsible] = useState(false);
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const [roomData, setRoomData] = useState<Record<string, { code: string; password: string; note: string }>>({});

  useEffect(() => {
    const init = async () => {
      const { data: ev } = await supabase.from("events").select("*").eq("id", id).single();
      if (ev) setEvent(ev);

      const { data: sess } = await supabase
        .from("event_sessions")
        .select("*")
        .eq("event_id", id)
        .order("start_time", { ascending: true });
      if (sess) setSessions(sess);

      const { data: regs } = await supabase
        .from("event_registrations")
        .select("id, team_id, status, is_winner, created_at, roster, team_name_override")
        .eq("event_id", id)
        .order("created_at", { ascending: true });
      if (regs) {
        const enriched = await Promise.all(
          regs.map(async (r) => {
            const { data: team } = await supabase.from("teams").select("name").eq("id", r.team_id).single();
            let roster: string[] = [];
            try { roster = JSON.parse(r.roster || "[]"); } catch {}
            return { ...r, team_name: team?.name || "—", roster };
          })
        );
        setRegistrations(enriched);
      }

      const { data: profiles } = await supabase.from("profiles").select("id, nickname");
      if (profiles) setAllPlayers(profiles);

      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      if (user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();
        if (roleData) setIsAdmin(true);

        const { data: ev2 } = await supabase.from("events").select("organizer_user_id").eq("id", id).single();
        if (ev2?.organizer_user_id === user.id) setIsOrganizer(true);

        const { data: member } = await supabase
          .from("team_members")
          .select("team_id, role_in_team")
          .eq("user_id", user.id)
          .single();

        if (member) {
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
                members.map(async (m: any) => {
                  const { data: profile } = await supabase
                    .from("profiles")
                    .select("nickname")
                    .eq("id", m.user_id)
                    .single();
                  return { ...m, nickname: profile?.nickname || "—" };
                })
              );
              setMyMembers(enrichedMembers);
            }

            const found = regs?.find((r: any) => r.team_id === team.id);
            if (found) {
              setAlreadyRegistered(true);
              setRegistrationStatus(found.status);
            }
          }
        }
      }

      setLoading(false);
    };
    init();
  }, [id]);

  useEffect(() => {
    if (!event || !sessions.length) return;
    const now = new Date();
    const lockMinutes = event.roster_lock_minutes || 10;
    const firstSession = sessions[0];
    const lockTime = new Date(new Date(firstSession.start_time).getTime() - lockMinutes * 60000);
    setCanEditRoster(now < lockTime);
  }, [event, sessions]);

  const registerTeam = async () => {
    if (!myTeam) { setMessage("У вас нет верифицированной команды."); return; }

    // Проверка выбранного состава
    if (selectedRoster.length === 0) {
      setMessage("Неверное количество участников. Выберите хотя бы одного игрока.");
      return;
    }

    setMessage("Регистрация...");
    const confirmedCount = registrations.filter(r => r.status === "confirmed").length;
    const maxTeams = event?.max_teams || 0;
    const status = maxTeams > 0 && confirmedCount >= maxTeams ? "waiting" : "confirmed";

    // Проверка бана игрока
    const { data: playerBan } = await supabase
      .from("bans")
      .select("id")
      .eq("target_type", "player")
      .eq("target_id", currentUser.id)
      .eq("is_active", true)
      .maybeSingle();

    if (playerBan) {
      setMessage("Вы заблокированы и не можете участвовать в мероприятиях.");
      return;
    }

    // Проверка бана команды
    const { data: teamBan } = await supabase
      .from("bans")
      .select("id")
      .eq("target_type", "team")
      .eq("target_id", myTeam.id)
      .eq("is_active", true)
      .maybeSingle();

    if (teamBan) {
      setMessage("Ваша команда заблокирована и не может участвовать в мероприятиях.");
      return;
    }

    const { error } = await supabase.from("event_registrations").insert({
      event_id: id,
      team_id: myTeam.id,
      status,
      registered_by: currentUser.id,
      roster: JSON.stringify(selectedRoster),
    });

    if (error) {
      setMessage("Ошибка: " + error.message);
    } else {
      await supabase.from("activity_log").insert({
        user_id: currentUser.id,
        team_id: myTeam.id,
        event_id: id,
        activity_type: "registration",
        description: `Команда ${myTeam.name} записалась на мероприятие`,
      });

      await supabase.from("notifications").insert({
        user_id: currentUser.id,
        type: "registration",
        title: "Регистрация на мероприятие",
        body: `Ваша команда ${myTeam.name} зарегистрирована на "${event?.title}"`,
        link: `/tournaments/${id}`,
      });

      setAlreadyRegistered(true);
      setRegistrationStatus(status);
      setMessage(status === "confirmed" ? "✅ Вы в основном составе!" : "⏳ Вы в листе ожидания.");
      refreshRegistrations();
    }
  };

  const cancelRegistration = async () => {
    if (!alreadyRegistered) return;
    if (!confirm("Отменить регистрацию?")) return;

    const { data: myRegs } = await supabase
      .from("event_registrations")
      .select("id, status")
      .eq("event_id", id)
      .eq("team_id", myTeam?.id);

    if (!myRegs || myRegs.length === 0) return;
    const myReg = myRegs[0];

    await supabase.from("event_registrations").delete().eq("id", myReg.id);

    if (myReg.status === "confirmed") {
      const { data: firstWaiting } = await supabase
        .from("event_registrations")
        .select("id")
        .eq("event_id", id)
        .eq("status", "waiting")
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      if (firstWaiting) {
        await supabase.from("event_registrations").update({ status: "confirmed" }).eq("id", firstWaiting.id);
      }
    }

    await supabase.from("notifications").insert({
      user_id: currentUser.id,
      type: "cancellation",
      title: "Регистрация отменена",
      body: `Вы отменили регистрацию команды ${myTeam?.name} на "${event?.title}"`,
    });

    setAlreadyRegistered(false);
    setRegistrationStatus("");
    setMessage("Регистрация отменена.");
    refreshRegistrations();
  };

  const toggleRegistrationsVisibility = async () => {
    if (!event) return;
    const newVisibility = !event.show_registrations;
    await supabase.from("events").update({ show_registrations: newVisibility }).eq("id", event.id);
    setEvent({ ...event, show_registrations: newVisibility });
  };

  const saveResults = async () => {
    if (!event) return;
    for (const r of confirmed) {
      await supabase.from("event_results").upsert({
        event_id: event.id,
        team_id: r.team_id,
        score: scores[r.id] || 0,
        is_winner: r.team_id === winnerTeamId,
      }, { onConflict: "event_id,team_id" });
    }
    setMessage("Результаты сохранены!");
  };

  const assignResponsible = async (sessionId: string) => {
    if (!responsibleUserId) return;
    await supabase.from("event_sessions").update({ responsible_user_id: responsibleUserId }).eq("id", sessionId);
    fetchSessions();
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
    await supabase.from("event_sessions").update({
      room_code: data.code,
      room_password: data.password,
      room_note: data.note,
    }).eq("id", sessionId);
    setMessage("Данные комнаты сохранены.");

    const confirmedRegs = registrations.filter(r => r.status === "confirmed");
    for (const reg of confirmedRegs) {
      const { data: team } = await supabase.from("teams").select("leader_id, name").eq("id", reg.team_id).single();
      if (team?.leader_id) {
        await supabase.from("messages").insert({
          to_user_id: team.leader_id,
          from_user_id: currentUser?.id,
          subject: `Данные комнаты: ${event?.title}`,
          body: `Команда: ${team.name}\nКод: ${data.code}\nПароль: ${data.password}${data.note ? `\nПримечание: ${data.note}` : ""}`,
        });
      }
    }
  };

  const refreshRegistrations = async () => {
    const { data } = await supabase
      .from("event_registrations")
      .select("id, team_id, status, is_winner, created_at, roster, team_name_override")
      .eq("event_id", id)
      .order("created_at", { ascending: true });
    if (data) {
      const enriched = await Promise.all(
        data.map(async (r) => {
          const { data: team } = await supabase.from("teams").select("name").eq("id", r.team_id).single();
          let roster: string[] = [];
          try { roster = JSON.parse(r.roster || "[]"); } catch {}
          return { ...r, team_name: team?.name || "—", roster };
        })
      );
      setRegistrations(enriched);
    }
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

  const confirmed = registrations.filter(r => r.status === "confirmed");
  const waiting = registrations.filter(r => r.status === "waiting");
  const hasStarted = sessions.length > 0 && new Date() >= new Date(sessions[0].start_time);
  const canViewRoom = isAdmin || isOrganizer || (myTeam && confirmed.some(r => r.team_id === myTeam.id));

  return (
    <div className="min-h-screen p-6">
      <Link href="/tournaments" className="text-blue-400 hover:underline">← К турнирам</Link>

      <div className="mt-4 bg-gray-800 p-6 rounded">
        <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">{typeLabels[event.type] || event.type}</span>
        <h1 className="text-3xl font-bold mt-3 text-blue-500">{event.title}</h1>

        {event.image_url && (
          <img src={event.image_url} alt={event.title} className="w-full max-w-md rounded-lg mt-4" />
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
          <div><span className="text-gray-400">Блокировка состава:</span> за {event.roster_lock_minutes || 10} мин. до начала</div>
        </div>

        <Link href={`/tournaments/${id}/results`} className="inline-block mt-4 px-4 py-2 bg-blue-500 rounded hover:bg-blue-600">
          📊 Результаты
        </Link>

        {(isAdmin || isOrganizer) && (
          <div className="mt-4 flex gap-2 flex-wrap">
            <button onClick={toggleRegistrationsVisibility} className="px-3 py-1 bg-gray-600 rounded text-sm">
              {event.show_registrations ? "Скрыть участников" : "Показать участников"}
            </button>
            <button onClick={() => setShowResponsible(!showResponsible)} className="px-3 py-1 bg-blue-600 rounded text-sm">
              Назначить ответственных
            </button>
            <Link href={`/admin/events/${id}/stats`} className="px-3 py-1 bg-red-600 rounded text-sm">
              Модерация статистики
            </Link>
          </div>
        )}
      </div>

      {/* Сессии */}
      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-4">Расписание</h2>
        {sessions.map((s) => {
          const isResponsible = s.responsible_user_id === currentUser?.id;
          const canEditRoom = isAdmin || isOrganizer || isResponsible;
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
      {myTeam && !alreadyRegistered && (
        <div className="mt-6 bg-gray-800 p-4 rounded">
          <p className="mb-3">Команда: <Link href={`/teams/${myTeam.id}`} className="text-blue-400">{myTeam.name}</Link></p>

          <div className="mb-3">
            <button onClick={() => setShowRosterForm(!showRosterForm)} className="text-sm text-blue-400">
              {showRosterForm ? "Скрыть состав" : "Выбрать состав"} ({selectedRoster.length} чел.)
            </button>
            {showRosterForm && (
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {myMembers.map((m: any) => (
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

          <button onClick={registerTeam} className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600">Записаться</button>
          {message && <p className="mt-3 text-sm">{message}</p>}
        </div>
      )}

      {alreadyRegistered && (
        <div className="mt-6 bg-gray-800 p-4 rounded">
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
                    const player = allPlayers.find((p: any) => p.id === userId);
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
    </div>
  );
}