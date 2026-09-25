"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { authFetch } from "@/utils/api/auth-fetch";
import TranslatedText from "@/components/TranslatedText";
import CommentsSection from "@/components/CommentsSection";
import SessionControls from "@/components/SessionControls";
import { useParams } from "next/navigation";
import {useLanguage} from "@/components/LanguageProvider";
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
  allow_individual_registration?: boolean;
}

interface Session {
  id: string;
  start_time: string;
  end_time: string;
  registration_open_time: string;
  registration_close_time: string | null;
  room_code?: string;
  room_password?: string;
  room_note?: string;
  can_edit_room?: boolean;
  responsible_user_id: string | null;
}

interface Registration {
  id: string;
  session_id: string | null;
  team_id: string | null;
  participant_user_id: string | null;
  registration_kind?: "team" | "individual";
  team_name: string;
  team_name_override: string;
  status: string;
  is_winner: boolean;
  created_at: string;
  roster: string[];
  team_avatar_url?: string | null;
  team_rating?: number;
  roster_players?: { id: string; nickname: string; avatar_url?: string | null; main_rating?: number }[];
}

interface EventGame { id: string; session_id: string; game_number: number; map_name: string }
const gameMapLabels: Record<string, string> = { bermuda: "Бермуды", nexterra: "Некстера", solara: "Солара", purgatory: "Чистилище", kalahari: "Калахари" };

interface TeamMember {
  user_id: string;
  role_in_team: string;
  position: string;
  nickname: string;
}

interface ManagedOrganization {
  id: string;
  name: string;
  type: "team" | "guild";
}

function registrationErrorMessage(errorMessage: string) {
  if (errorMessage.includes("duplicate key") || errorMessage.includes("already registered for this session")) {
    return "На это время уже есть активная заявка с этой командой или одним из выбранных игроков.";
  }
  if (errorMessage.includes("overlapping session")) {
    return "Один из выбранных игроков уже участвует в другой пересекающейся сессии.";
  }
  if (errorMessage.includes("Not enough players")) {
    return "В составе недостаточно игроков.";
  }
  if (errorMessage.includes("outside this team")) {
    return "В составе есть игрок, который больше не состоит в этой команде или гильдии.";
  }
  if (errorMessage.includes("banned")) {
    return "Команда или один из выбранных игроков заблокированы для участия.";
  }
  if (errorMessage.includes("Roster is locked")) {
    return "Изменение состава уже заблокировано — до начала осталось 10 минут или меньше.";
  }
  return errorMessage;
}

export default function EventPage() {
  const {locale} = useLanguage();
  const [clockNow,setClockNow] = useState(() => Date.now());
  useEffect(() => {const timer=setInterval(()=>setClockNow(Date.now()),30000);return()=>clearInterval(timer);}, []);
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const [event, setEvent] = useState<Event | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [games, setGames] = useState<EventGame[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [myTeam, setMyTeam] = useState<ManagedOrganization | null>(null);
  const [managedOrganizations, setManagedOrganizations] = useState<ManagedOrganization[]>([]);
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
  const [rosterSaving, setRosterSaving] = useState(false);


  const [selectedRegistrationId, setSelectedRegistrationId] = useState<string | null>(null);

  const [showResponsible, setShowResponsible] = useState(false);
  const [responsibleUserId, setResponsibleUserId] = useState("");

  const loadRegistrations = useCallback(async (authenticated: boolean) => {
    const response = authenticated
      ? await authFetch(`/api/events/${id}/registrations`)
      : await fetch(`/api/events/${id}/registrations`);
    if (!response.ok) return [] as Registration[];
    const payload = await response.json() as { registrations?: Registration[] };
    const rows = payload.registrations ?? [];
    setRegistrations(rows);
    return rows;
  }, [id]);

  const loadOrganizationMembers = useCallback(async (team: ManagedOrganization) => {
    setMyTeam(team);
    setCanManageTeam(false);
    setMyMembers([]);
    setSelectedRoster([]);
    const { data: members } = await supabase
      .from("team_members")
      .select("user_id, role_in_team, position")
      .eq("team_id", team.id);
    const memberRows = members ?? [];
    const { data: memberProfiles } = memberRows.length
      ? await supabase.from("profiles")
          .select("id,nickname")
          .in("id", memberRows.map((membership) => membership.user_id))
      : { data: [] };
    const nicknameById = new Map((memberProfiles ?? []).map((profile) => [profile.id, profile.nickname]));
    const enrichedMembers = memberRows.map((membership) => ({
      ...membership,
      nickname: nicknameById.get(membership.user_id) || "—",
    }));
    setMyMembers(enrichedMembers);
    setSelectedRoster(
      enrichedMembers
        .filter((item) => item.position === "main")
        .slice(0, 4)
        .map((item) => item.user_id),
    );
    setCanManageTeam(true);
    setShowRosterForm(false);
  }, [supabase]);

  useEffect(() => {
    const init = async () => {
      const { data: ev } = await supabase.from("events").select("id,title,type,cost,organizer,organizer_user_id,description,image_url,stream_url,is_published,max_teams,show_registrations,roster_lock_minutes,min_players,comments_enabled,payment_url,allow_individual_registration").eq("id", id).single();
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
        setSelectedSessionId((current) => current || sess.find(s=>s.id===new URLSearchParams(window.location.search).get("sessionId"))?.id || sess.find(s=>Date.parse(s.end_time||s.start_time)>Date.now())?.id || sess[sess.length-1]?.id || "");
      }
      const { data: gameRows } = await supabase.from("event_games").select("id,session_id,game_number,map_name").eq("event_id", id).order("game_number");
      setGames((gameRows ?? []) as EventGame[]);

      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      const loadedRegistrations = await loadRegistrations(Boolean(user));
      if (user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .in("role", ["moderator", "admin", "superadmin"])
          .limit(1);
        if (roleData?.length) setIsAdmin(true);

        if (ev?.organizer_user_id === user.id) setIsOrganizer(true);

        const { data: memberships } = await supabase
          .from("team_members")
          .select("team_id, role_in_team")
          .eq("user_id", user.id);

        if (memberships?.length) {
          const { data: membershipTeams } = await supabase.from("teams")
            .select("id,name,type,verified").in("id", memberships.map((membership) => membership.team_id));
          const eligibleTeamIds = new Set((membershipTeams ?? [])
            .filter((team) => (team.type === "team" || team.type === "guild") && team.verified)
            .map((team) => team.id));
          const manageableTeamIds = new Set(memberships
            .filter((membership) => ["leader", "senior_deputy", "deputy"].includes(membership.role_in_team))
            .map((membership) => membership.team_id));
          const manageableTeams = (membershipTeams ?? [])
            .filter((team): team is typeof team & { type: "team" | "guild" } =>
              eligibleTeamIds.has(team.id) && manageableTeamIds.has(team.id) &&
              (team.type === "team" || team.type === "guild"),
            )
            .map(({ id: teamId, name, type }) => ({ id: teamId, name, type }));
          setManagedOrganizations(manageableTeams);

          const registeredTeamId = loadedRegistrations.find((registration) =>
            registration.status !== "cancelled" &&
            Boolean(registration.team_id && manageableTeamIds.has(registration.team_id)),
          )?.team_id;
          const team = manageableTeams.find((candidate) => candidate.id === registeredTeamId) ?? manageableTeams[0] ?? null;
          if (team) await loadOrganizationMembers(team);
        }
      }

      setLoading(false);
    };
    init();
  }, [id, loadOrganizationMembers, loadRegistrations, supabase]);

  const registerTeam = async () => {
    if (!myTeam) { setMessage("У вас нет верифицированной команды или гильдии."); return; }
    if (!currentUser) { setMessage("Войдите, чтобы записать команду или гильдию."); return; }
    if (!selectedSessionId) { setMessage("Выберите время участия."); return; }

    // Проверка минимального количества игроков, заданного для мероприятия
    const minPlayers = event?.min_players || 4;
    if (selectedRoster.length < minPlayers) {
      setMessage(`В составе команды должно быть минимум ${minPlayers} игроков.`);
      return;
    }

    setRestrictionLinks([]);
    setMessage("Регистрация...");
    const { data, error } = await supabase.rpc("register_team_for_session", {
      p_session_id: selectedSessionId,
      p_team_id: myTeam.id,
      p_roster: selectedRoster,
    });

    if (error) {
      setMessage("Ошибка: " + registrationErrorMessage(error.message));
      await loadRegistrationRestrictions(myTeam.id);
    } else {
      const status = data?.[0]?.registration_status ?? "confirmed";
      setMessage(status === "confirmed" ? "✅ Вы в основном составе!" : "⏳ Вы в листе ожидания.");
      setShowRosterForm(false);
      void refreshRegistrations();
    }
  };

  const [restrictionLinks,setRestrictionLinks] = useState<Array<{id:string;reason:string;appealUrl:string}>>([]);
  const loadRegistrationRestrictions = async (teamId?:string) => {
    try {const r=await authFetch(`/api/events/${id}/eligibility${teamId?`?teamId=${teamId}`:""}`),d=await r.json();if(r.ok)setRestrictionLinks(d.restrictions??[]);}catch { /* Keep the original registration error visible. */ }
  };

  const registerPlayer = async () => {
    if (!currentUser) { setMessage("Войдите, чтобы записаться."); return; }
    if (!selectedSessionId) { setMessage("Выберите время участия."); return; }

    setRestrictionLinks([]);
    setMessage("Регистрация...");
    const { data, error } = await supabase.rpc("register_player_for_session", {
      p_session_id: selectedSessionId,
    });

    if (error) {
      setMessage("Ошибка: " + registrationErrorMessage(error.message));
      await loadRegistrationRestrictions();
    } else {
      const status = data?.[0]?.registration_status ?? "confirmed";
      setMessage(status === "confirmed" ? "✅ Вы записаны!" : "⏳ Вы в листе ожидания.");
      void refreshRegistrations();
    }
  };

  const saveRoster = async (registrationId: string) => {
    const currentMemberIds = new Set(myMembers.map((member) => member.user_id));
    const normalizedRoster = [...new Set(selectedRoster)];
    if (normalizedRoster.some((userId) => !currentMemberIds.has(userId))) {
      setMessage("Список участников изменился. Закройте форму, снова нажмите «Изменить состав» и выберите игроков заново.");
      return;
    }
    const minPlayers = event?.min_players || 4;
    if (normalizedRoster.length < minPlayers) {
      setMessage(`В составе команды должно быть минимум ${minPlayers} игроков.`);
      return;
    }

    setRosterSaving(true);
    setMessage("Сохраняем состав...");
    const { error } = await supabase.rpc("update_team_registration_roster", {
      p_registration_id: registrationId,
      p_roster: normalizedRoster,
    });
    setRosterSaving(false);

    if (error) {
      setMessage("Ошибка: " + registrationErrorMessage(error.message));
      return;
    }

    setShowRosterForm(false);
    setMessage("✅ Состав обновлён.");
    await refreshRegistrations();
  };

  const cancelRegistration = async () => {
    if (!alreadyRegistered) return;
    if (!confirm("Отменить регистрацию?")) return;

    if (!selectedRegistration) return;

    const { error } = await supabase.rpc("cancel_session_registration", {
      p_registration_id: selectedRegistration.id,
      p_reason: selectedRegistration.participant_user_id ? "Отменено игроком" : "Отменено руководством команды",
    });
    if (error) {
      setMessage("Ошибка: " + error.message);
      return;
    }

    setMessage("Регистрация отменена.");
    setShowRosterForm(false);
    void refreshRegistrations();
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

  const refreshRegistrations = async () => {
    await loadRegistrations(Boolean(currentUser));
  };

  const selectOrganization = async (teamId: string) => {
    const team = managedOrganizations.find((candidate) => candidate.id === teamId);
    if (!team || team.id === myTeam?.id) return;
    setMessage("");
    await loadOrganizationMembers(team);
  };

  const selectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setShowRosterForm(false);
    setMessage("");

    const registeredTeamId = registrations.find((registration) =>
      registration.session_id === sessionId &&
      registration.status !== "cancelled" &&
      Boolean(registration.team_id && managedOrganizations.some((team) => team.id === registration.team_id)),
    )?.team_id;
    if (registeredTeamId && registeredTeamId !== myTeam?.id) {
      void selectOrganization(registeredTeamId);
    }
  };

  const beginRosterEdit = (registration: Registration) => {
    const currentMemberIds = new Set(myMembers.map((member) => member.user_id));
    const editableRoster = [...new Set(registration.roster.filter((userId) => currentMemberIds.has(userId)))];
    const removedCount = registration.roster.length - editableRoster.length;
    setSelectedRoster(editableRoster);
    setShowRosterForm(true);
    setMessage(removedCount > 0
      ? `Из прежнего состава исключено игроков, которые больше не состоят в этой команде или гильдии: ${removedCount}. Выберите замену и сохраните состав.`
      : "");
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
  const selectedRegistration = sessionRegistrations.find((registration) =>
    registration.status !== "cancelled" && (
      (myTeam && registration.team_id === myTeam.id) ||
      registration.participant_user_id === currentUser?.id
    ),
  );
  const alreadyRegistered = Boolean(selectedRegistration);
  const registrationStatus = selectedRegistration?.status ?? "";
  const lockTime = selectedSession
    ? new Date(new Date(selectedSession.start_time).getTime() - (event.roster_lock_minutes ?? 10) * 60_000)
    : null;
  const canEditRoster = !lockTime || new Date() < lockTime;
  const hasStarted = Boolean(selectedSession && new Date() >= new Date(selectedSession.start_time));
  const registrationOpensAt = selectedSession?.registration_open_time
    ? new Date(selectedSession.registration_open_time)
    : null;
  const registrationClosesAt = selectedSession
    ? new Date(selectedSession.registration_close_time || selectedSession.start_time)
    : null;
  const registrationIsOpen = Boolean(
    selectedSession &&
    (!registrationOpensAt || new Date() >= registrationOpensAt) &&
    registrationClosesAt &&
    new Date() < registrationClosesAt,
  );
  const registrationHint = !selectedSession
    ? "Расписание пока не добавлено."
    : registrationOpensAt && new Date() < registrationOpensAt
      ? `Регистрация откроется ${registrationOpensAt.toLocaleString("ru-RU",{timeZone:"Europe/Moscow"}) + " МСК"}.`
      : registrationClosesAt && new Date() >= registrationClosesAt
        ? "Регистрация закрыта."
        : "Регистрация открыта.";
  const allowsIndividualRegistration = event.type === "solo" || Boolean(event.allow_individual_registration);
  const allowsCollectiveRegistration = event.type !== "solo";
  const collectiveLabel = myTeam?.type === "guild" ? "Гильдия" : "Команда";
  return (
    <div className="min-h-screen p-6">
      <Link href="/tournaments" className="text-blue-400 hover:underline">← К турнирам</Link>

      <div className="mt-4 bg-gray-800 p-6 rounded">
        <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">{typeLabels[event.type] || event.type}</span>
        <h1 className="text-3xl font-bold mt-3 text-blue-500">{event.title}</h1>

        {event.image_url && (
          <Image src={event.image_url} alt={event.title} width={900} height={500} unoptimized className="w-full max-w-md rounded-lg mt-4 object-cover" />
        )}

        {event.description
          ? <TranslatedText sourceType="event" sourceId={event.id} sourceField="description" original={event.description} className="mt-4" textClassName="text-gray-300 whitespace-pre-wrap" />
          : <p className="text-gray-300 mt-4">Нет описания</p>}

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
          <div>
            <span className="text-gray-400">Формат регистрации:</span>{" "}
            {allowsIndividualRegistration
              ? allowsCollectiveRegistration ? "команда/гильдия или личная заявка" : "личная заявка"
              : "только команда или гильдия"}
          </div>
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
            <Link href={`/tournaments/${id}/edit`} className="rounded bg-cyan-800 px-3 py-1 text-sm">Редактировать мероприятие</Link>
            {isAdmin && (
              <Link href={`/admin/events/${id}/stats`} className="px-3 py-1 bg-red-600 rounded text-sm">
                Модерация статистики
              </Link>
            )}
            <Link href={`/tournaments/${id}/manage-results`} className="rounded bg-emerald-700 px-3 py-1 text-sm">
              Игры и итоговые результаты
            </Link>
          </div>
        )}
      </div>

      {/* Сессии */}
      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-4">Расписание</h2>
        {sessions.map((s) => {
          const isResponsible = s.responsible_user_id === currentUser?.id;
          return (
            <div key={s.id} className="bg-gray-800 p-4 rounded mb-2">
              <p><span className="text-gray-400">Начало:</span> {new Date(s.start_time).toLocaleString("ru-RU",{timeZone:"Europe/Moscow"}) + " МСК"}</p>
              {s.end_time && <p><span className="text-gray-400">Конец:</span> {new Date(s.end_time).toLocaleString("ru-RU",{timeZone:"Europe/Moscow"}) + " МСК"}</p>}
              {games.some((game) => game.session_id === s.id) && <div className="mt-3 flex flex-wrap gap-2">{games.filter((game) => game.session_id === s.id).map((game) => <span key={game.id} className="rounded bg-cyan-950 px-3 py-1 text-xs text-cyan-200">Игра {game.game_number}: {gameMapLabels[game.map_name] ?? game.map_name}</span>)}</div>}

              <div className="my-3 flex gap-3"><Link className="text-cyan-300" href={`/tournaments/${id}/results?sessionId=${s.id}`}>Итоги сессии</Link>{(isResponsible||isAdmin||isOrganizer)&&<Link className="text-emerald-300" href={`/tournaments/${id}/manage-results?sessionId=${s.id}`}>Ввести результаты</Link>}</div>
              <SessionControls eventId={id} sessionId={s.id} authenticated={!!currentUser}/>
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

            </div>
          );
        })}
      </div>

      {/* Запись */}
      {allowsCollectiveRegistration && managedOrganizations.length > 1 && myTeam && (
        <div className="mt-6 rounded bg-gray-800 p-4">
          <label className="mb-2 block text-sm text-gray-300" htmlFor="registration-organization">
            От какой команды или гильдии подаётся заявка
          </label>
          <select
            id="registration-organization"
            value={myTeam.id}
            onChange={(event) => void selectOrganization(event.target.value)}
          >
            {managedOrganizations.map((team) => (
              <option key={team.id} value={team.id}>
                {team.type === "guild" ? "Гильдия" : "Команда"}: {team.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {allowsCollectiveRegistration && myTeam && canManageTeam && !alreadyRegistered && (
        <div className="mt-6 bg-gray-800 p-4 rounded">
          <p className="mb-3">{collectiveLabel}: <Link href={`/teams/${myTeam.id}`} className="text-blue-400">{myTeam.name}</Link></p>

          <div className="mb-4">
            <label className="text-sm text-gray-300 block mb-2">Выберите время участия</label>
            <select value={selectedSessionId} onChange={(event) => selectSession(event.target.value)}>
              {sessions.filter(session=>Date.parse(session.end_time||session.start_time)>clockNow).map((session) => (
                <option key={session.id} value={session.id}>
                  {new Date(session.start_time).toLocaleString("ru-RU",{timeZone:"Europe/Moscow"}) + " МСК"}
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

          <p className={registrationIsOpen ? "mb-3 text-sm text-green-400" : "mb-3 text-sm text-yellow-300"}>{registrationHint}</p>
          <button onClick={registerTeam} disabled={!registrationIsOpen || !canEditRoster} className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600 disabled:opacity-50">
            {!registrationIsOpen ? "Регистрация недоступна" : canEditRoster ? `Записать ${myTeam.type === "guild" ? "гильдию" : "команду"}` : "Состав заблокирован"}
          </button>
          {message && <p className="mt-3 text-sm">{message}</p>}{restrictionLinks.map(r=><p key={r.id} className="mt-2 text-sm text-amber-200">{r.reason} · <Link className="text-cyan-300 underline" href={r.appealUrl}>{locale==="ru"?"Обжаловать":locale==="kk"?"Шағымдану":"Даттануу"}</Link></p>)}
        </div>
      )}

      {currentUser && allowsIndividualRegistration && !alreadyRegistered && (
        <div className="mt-6 bg-gray-800 p-4 rounded">
          <h2 className="text-lg font-semibold">Личная заявка</h2>
          <p className="mt-1 text-sm text-gray-300">Можно участвовать самостоятельно, даже если вы не состоите в команде или гильдии.</p>
          <div className="my-4">
            <label className="text-sm text-gray-300 block mb-2">Выберите время участия</label>
            <select value={selectedSessionId} onChange={(event) => selectSession(event.target.value)}>
              {sessions.filter(session=>Date.parse(session.end_time||session.start_time)>clockNow).map((session) => (
                <option key={session.id} value={session.id}>{new Date(session.start_time).toLocaleString("ru-RU",{timeZone:"Europe/Moscow"}) + " МСК"}</option>
              ))}
            </select>
          </div>
          <p className={registrationIsOpen ? "mb-3 text-sm text-green-400" : "mb-3 text-sm text-yellow-300"}>{registrationHint}</p>
          <button onClick={registerPlayer} disabled={!registrationIsOpen} className="px-4 py-2 bg-green-600 rounded hover:bg-green-700 disabled:opacity-50">
            {registrationIsOpen ? "Записаться лично" : "Регистрация недоступна"}
          </button>
          {message && <p className="mt-3 text-sm">{message}</p>}{restrictionLinks.map(r=><p key={r.id} className="mt-2 text-sm text-amber-200">{r.reason} · <Link className="text-cyan-300 underline" href={r.appealUrl}>{locale==="ru"?"Обжаловать":locale==="kk"?"Шағымдану":"Даттануу"}</Link></p>)}
        </div>
      )}

      {currentUser && allowsCollectiveRegistration && !allowsIndividualRegistration && !alreadyRegistered && (!myTeam || !canManageTeam) && (
        <div className="mt-6 bg-gray-800 p-4 rounded">
          <h2 className="text-lg font-semibold">Командная регистрация</h2>
          <p className="mt-1 text-sm text-gray-300">
            На это мероприятие заявку подаёт руководитель верифицированной команды или гильдии.
          </p>
          <Link href="/teams" className="mt-3 inline-block text-blue-400 hover:underline">Перейти к командам и гильдиям</Link>
        </div>
      )}

      {!currentUser && (
        <div className="mt-6 bg-gray-800 p-4 rounded">
          <p className="text-sm text-gray-300">{registrationHint}</p>
          <p className="mt-2 text-sm text-gray-300">
            {allowsIndividualRegistration
              ? "Доступна личная заявка без команды или гильдии."
              : "Для участия потребуется верифицированная команда или гильдия."}
          </p>
          <Link href="/auth" className="mt-3 inline-block px-4 py-2 bg-blue-500 rounded hover:bg-blue-600">Войти для участия</Link>
        </div>
      )}

      {alreadyRegistered && (canManageTeam || selectedRegistration?.participant_user_id === currentUser?.id) && (
        <div className="mt-6 bg-gray-800 p-4 rounded">
          <label className="text-sm text-gray-300 block mb-2">Выбранное время</label>
          <select
            className="mb-3"
            value={selectedSessionId}
            onChange={(event) => selectSession(event.target.value)}
          >
            {sessions.filter(session=>Date.parse(session.end_time||session.start_time)>clockNow).map((session) => (
              <option key={session.id} value={session.id}>{new Date(session.start_time).toLocaleString("ru-RU",{timeZone:"Europe/Moscow"}) + " МСК"}</option>
            ))}
          </select>
          <p className="mb-2">
            {selectedRegistration?.participant_user_id ? "Личная заявка: " : "Заявка команды: "}
            {registrationStatus === "confirmed" ? "✅ участие подтверждено" : "⏳ лист ожидания"}
          </p>

          {selectedRegistration?.team_id && canManageTeam && (
            <div className="mb-4 rounded bg-gray-700 p-3">
              <p className="text-sm font-semibold">
                Состав ({selectedRegistration.roster.length}/{event.min_players || 4})
              </p>
              <div className="mt-2 space-y-1 text-sm text-gray-300">
                {selectedRegistration.roster.length > 0 ? selectedRegistration.roster.map((userId) => (
                  <p key={userId}>— {myMembers.find((member) => member.user_id === userId)?.nickname || selectedRegistration.roster_players?.find((player) => player.id === userId)?.nickname || "Игрок"}</p>
                )) : <p className="text-gray-400">Состав не указан.</p>}
              </div>

              {canEditRoster ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (!showRosterForm) {
                        beginRosterEdit(selectedRegistration);
                      } else {
                        setShowRosterForm(false);
                        setMessage("");
                      }
                    }}
                    className="mt-3 text-sm text-blue-400 hover:underline"
                  >
                    {showRosterForm ? "Закрыть изменение состава" : "Изменить состав"}
                  </button>

                  {showRosterForm && (
                    <div className="mt-3 border-t border-gray-600 pt-3">
                      <p className="mb-2 text-sm text-gray-300">
                        Выбрано: {selectedRoster.length}. Минимум: {event.min_players || 4}.
                      </p>
                      <div className="max-h-48 space-y-1 overflow-y-auto">
                        {myMembers.map((member) => (
                          <label key={member.user_id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selectedRoster.includes(member.user_id)}
                              onChange={(checkboxEvent) => {
                                if (checkboxEvent.target.checked) {
                                  setSelectedRoster((current) => [...current, member.user_id]);
                                } else {
                                  setSelectedRoster((current) => current.filter((userId) => userId !== member.user_id));
                                }
                              }}
                            />
                            {member.nickname} ({member.role_in_team === "leader" ? "Лидер" : member.role_in_team === "senior_deputy" ? "Старший зам" : member.role_in_team === "deputy" ? "Зам" : member.position === "main" ? "Основа" : "Запас"})
                          </label>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void saveRoster(selectedRegistration.id)}
                          disabled={rosterSaving || selectedRoster.length < (event.min_players || 4)}
                          className="rounded bg-blue-500 px-4 py-2 hover:bg-blue-600 disabled:opacity-50"
                        >
                          {rosterSaving ? "Сохраняем..." : "Сохранить состав"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRoster(selectedRegistration.roster);
                            setShowRosterForm(false);
                            setMessage("");
                          }}
                          className="rounded bg-gray-600 px-4 py-2 hover:bg-gray-500"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="mt-3 text-sm text-yellow-300">
                  Состав заблокирован за {event.roster_lock_minutes ?? 10} минут до начала.
                </p>
              )}
            </div>
          )}

          <button onClick={cancelRegistration} className="px-4 py-2 bg-red-500 rounded hover:bg-red-600">Отменить запись</button>
          {message && <p className="mt-3 text-sm">{message}</p>}{restrictionLinks.map(r=><p key={r.id} className="mt-2 text-sm text-amber-200">{r.reason} · <Link className="text-cyan-300 underline" href={r.appealUrl}>{locale==="ru"?"Обжаловать":locale==="kk"?"Шағымдану":"Даттануу"}</Link></p>)}
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

      {/* Заявки */}
      {(event.show_registrations || isAdmin || isOrganizer) && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-4">Заявки</h2>
          {confirmed.map((r) => (
            <div key={r.id} className="bg-gray-800 p-3 rounded mb-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 overflow-hidden rounded-lg bg-slate-700">
                    {r.team_avatar_url ? <Image src={r.team_avatar_url} alt="" width={40} height={40} unoptimized className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center font-bold">{(r.team_name_override || r.team_name)?.[0]?.toUpperCase()}</div>}
                  </div>
                  <div>
                  <button onClick={() => setSelectedRegistrationId(selectedRegistrationId === r.id ? null : r.id)} className="text-blue-400 hover:underline">
                    {r.team_name_override || r.team_name}
                  </button>
                  <p className="text-xs text-slate-400">Рейтинг {Number(r.team_rating ?? 1).toFixed(0)} · вероятность победы {Math.round((Number(r.team_rating ?? 1) / Math.max(1, confirmed.reduce((sum, item) => sum + Number(item.team_rating ?? 1), 0))) * 100)}%</p>
                  {r.is_winner && <span className="ml-2 text-yellow-400">🏆 Победитель</span>}
                  </div>
                </div>
                <span className="text-green-400">✓</span>
              </div>
              {selectedRegistrationId === r.id && (
                <div className="mt-2 text-sm text-gray-300">
                  {r.roster.length > 0 ? r.roster.map((userId: string) => {
                    const player = r.roster_players?.find((item) => item.id === userId);
                    return <div key={userId}>— {player?.nickname || userId}{player?.main_rating != null ? ` · рейтинг ${Number(player.main_rating).toFixed(0)}` : ""}</div>;
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
      {event.comments_enabled !== false && <CommentsSection eventId={id} sessionId={selectedSessionId||undefined} />}
    </div>
  );
}
