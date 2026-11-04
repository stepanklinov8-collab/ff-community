"use client";

import { formatCoins } from "@/lib/economy/currency";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { authFetch } from "@/utils/api/auth-fetch";
import TranslatedText from "@/components/TranslatedText";
import CommentsSection from "@/components/CommentsSection";
import SessionControls from "@/components/SessionControls";
import RegistrationRestrictions from "@/components/RegistrationRestrictions";
import {getBrowserUser} from "@/utils/supabase/browser-identity";
import { useParams, useSearchParams } from "next/navigation";
import {useLanguage} from "@/components/LanguageProvider";
import Link from "next/link";
import Image from "next/image";
import type { User } from "@supabase/supabase-js";
import { mapTitle } from "@/lib/competition/map-catalog";
import { sessionHasEnded } from "@/lib/competition/training-schedule";

interface Event {
  id: string;
  title: string;
  type: string;
  cost: number;
  organizer: string;
  organizer_user_id: string | null;
  description: string;
  rules_text: string;
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
  max_teams: number | null;
  room_code?: string;
  room_password?: string;
  room_note?: string;
  can_edit_room?: boolean;
  responsible_user_id: string | null;
}

interface Registration {
  queue_position?: number | null;
  is_own?: boolean;
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

interface RegistrationCount {
  waiting?: number;
  session_id: string;
  registered: number;
  capacity: number | null;
}

interface EventGame { id: string; session_id: string; game_number: number; map_name: string }

interface TeamMember {
  isGuest?: boolean;
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
  const {locale, formatNumber} = useLanguage();
  const [clockNow,setClockNow] = useState(() => Date.now());
  useEffect(() => {const timer=setInterval(()=>setClockNow(Date.now()),30000);return()=>clearInterval(timer);}, []);
  const { id } = useParams<{ id: string }>();
  const searchParams=useSearchParams(),requestedSession=searchParams.get("sessionId");
  const [pageError,setPageError]=useState(""),[accountError,setAccountError]=useState(""),[reload,setReload]=useState(0);
  const [registrationLoading,setRegistrationLoading]=useState(true),[registrationError,setRegistrationError]=useState("");
  const registrationSequence=useRef(0),organizationSequence=useRef(0),preferredOrganization=useRef("");
  const invalidateRegistrations=useCallback(()=>{registrationSequence.current++;},[]),invalidateOrganizations=useCallback(()=>{organizationSequence.current++;},[]);
  const [accountReady,setAccountReady]=useState(false);
  const supabase = useMemo(() => createClient(), []);
  const [event, setEvent] = useState<Event | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [prizePlans,setPrizePlans]=useState<Record<string,number[]>>({});
  useEffect(()=>{let active=true;void fetch(`/api/events/${id}/prizes`).then(async r=>{if(!r.ok)return;const d=await r.json();if(active)setPrizePlans(Object.fromEntries((d.funds??[]).map((f:{sessionId:string;plan:number[]})=>[f.sessionId,f.plan])));}).catch(()=>undefined);return()=>{active=false;};},[id]);
  const [showPastSessions, setShowPastSessions] = useState(false);
  const [pastLimit, setPastLimit] = useState(10);
  const [showFutureSessions, setShowFutureSessions] = useState(false);
  const [futureLimit, setFutureLimit] = useState(10);
  const [games, setGames] = useState<EventGame[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [registrationCounts, setRegistrationCounts] = useState<Record<string, RegistrationCount>>({});
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
  const [guestMembers, setGuestMembers] = useState<{ teamId: string; sessionId: string; members: TeamMember[]; error: string } | null>(null);
  const rosterMembers = useMemo(() => {
    const guests = guestMembers?.teamId === myTeam?.id && guestMembers?.sessionId === selectedSessionId ? guestMembers.members : [];
    const known = new Set(myMembers.map(member => member.user_id));
    return [...myMembers, ...guests.filter(member => !known.has(member.user_id))];
  }, [guestMembers, myMembers, myTeam?.id, selectedSessionId]);
  useEffect(() => {
    if (!myTeam?.id || !selectedSessionId || !currentUser || !canManageTeam) return;
    let cancelled = false; const teamId = myTeam.id, sessionId = selectedSessionId;
    void Promise.resolve(supabase.rpc("contract_available_guests", { p_team: teamId, p_session: sessionId })).then(({ data, error }) => {
      if (!cancelled) setGuestMembers({ teamId, sessionId, members: error ? [] : (Array.isArray(data) ? data : []).map((player: { id: string; nickname: string }) => ({ user_id: player.id, nickname: player.nickname, role_in_team: "guest", position: "reserve", isGuest: true })), error: error ? "Не удалось загрузить согласованных гостей. Обновите страницу перед выбором гостевого состава." : "" });
    }).catch(() => { if (!cancelled) setGuestMembers({ teamId, sessionId, members: [], error: "Не удалось загрузить согласованных гостей. Проверьте соединение и обновите страницу." }); });
    return () => { cancelled = true; };
  }, [myTeam?.id, selectedSessionId, currentUser, canManageTeam, supabase]);
  const [selectedRoster, setSelectedRoster] = useState<string[]>([]);
  const [showRosterForm, setShowRosterForm] = useState(false);
  const [rosterSaving, setRosterSaving] = useState(false);


  const [selectedRegistrationId, setSelectedRegistrationId] = useState<string | null>(null);

  const [showResponsible, setShowResponsible] = useState(false);
  const [responsibleUserId, setResponsibleUserId] = useState("");

  const loadRegistrations = useCallback(async (authenticated: boolean) => {
    if(!selectedSessionId)return [] as Registration[];
    const sequence=++registrationSequence.current;
    setRegistrationLoading(true);setRegistrationError("");
    try {
      const endpoint=`/api/events/${id}/registrations?sessionId=${selectedSessionId}`;
      const response=await (authenticated?authFetch:fetch)(endpoint,{signal:AbortSignal.timeout(20000)});
      const payload=await response.json();
      if(!response.ok)throw Error(payload.error??"Не удалось загрузить заявки");
      if(sequence!==registrationSequence.current)return [] as Registration[];
      const rows:Registration[]=payload.registrations??[];
      setRegistrations(rows);
      setRegistrationCounts(Object.fromEntries((payload.registrationCounts??[]).map((count:RegistrationCount)=>[count.session_id,count])));
      return rows;
    }catch(caught){if(sequence===registrationSequence.current)setRegistrationError(caught instanceof Error?caught.message:"Не удалось загрузить заявки");return [] as Registration[];}
    finally{if(sequence===registrationSequence.current)setRegistrationLoading(false);}
  },[id,selectedSessionId]);
  useEffect(()=>{
    if(!accountReady||!selectedSessionId)return;
    const timer=setTimeout(()=>void loadRegistrations(Boolean(currentUser)),0);
    return()=>{clearTimeout(timer);invalidateRegistrations();};
  },[accountReady,selectedSessionId,currentUser,loadRegistrations,invalidateRegistrations]);

  const loadOrganizationMembers = useCallback(async (team: ManagedOrganization) => {
    const sequence=++organizationSequence.current;
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
    if(sequence!==organizationSequence.current)return;
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
    let alive=true;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
    const init=async()=>{
      setLoading(true);setPageError("");setAccountError("");setAccountReady(false);
      setEvent(null);setSessions([]);setSelectedSessionId("");setCurrentUser(null);
      setManagedOrganizations([]);setMyTeam(null);setCanManageTeam(false);setIsAdmin(false);setIsOrganizer(false);setRegistrations([]);
      preferredOrganization.current="";
      const identity=getBrowserUser().catch(()=>({data:{user:null},error:new Error("Не удалось проверить вход")}));
      try{
        const [eventResponse,publicSessions]=await Promise.all([
          supabase.from("events").select("id,title,type,cost,organizer,organizer_user_id,description,rules_text,image_url,stream_url,is_published,max_teams,show_registrations,roster_lock_minutes,min_players,comments_enabled,payment_url,allow_individual_registration").eq("id",id).abortSignal(controller.signal).single(),
          supabase.from("event_sessions_public").select("*").eq("event_id",id).order("start_time").abortSignal(controller.signal),
        ]);
        if(eventResponse.error||!eventResponse.data)throw Error("Не удалось загрузить мероприятие. Проверьте соединение или доступ к странице.");
        let sess=publicSessions.data;
        if(publicSessions.error){const fallback=await supabase.from("event_sessions").select("id,start_time,end_time,registration_open_time,registration_close_time,max_teams,responsible_user_id").eq("event_id",id).order("start_time").abortSignal(controller.signal);if(fallback.error)throw fallback.error;sess=fallback.data;}
        if(!alive)return;
        const ev=eventResponse.data;
        setEvent(ev);setSessions(sess??[]);
        const requested=(sess??[]).find(row=>row.id===new URLSearchParams(window.location.search).get("sessionId"));
        setSelectedSessionId(requested?.id??(sess??[]).find(row=>!sessionHasEnded(row,Date.now()))?.id??sess?.at(-1)?.id??"");
        setLoading(false);
        const {data:{user},error:identityError}=await identity;
        if(!alive)return;
        if(identityError)throw Error("Не удалось проверить вход. Повторите загрузку для управления заявками.");
        setCurrentUser(user);
        if(!user){setAccountReady(true);return;}
        setIsOrganizer(ev.organizer_user_id===user.id);
        const [capabilities,{data:memberships,error:membershipsError},{data:ownedTeams,error:ownedError}]=await Promise.all([
          authFetch("/api/admin/capabilities"),
          supabase.from("team_members").select("team_id,role_in_team").eq("user_id",user.id).abortSignal(controller.signal),
          supabase.from("teams").select("id,name,type,verified,ultimate_owner_user_id,dissolved_at").eq("ultimate_owner_user_id",user.id).is("dissolved_at",null).abortSignal(controller.signal),
        ]);
        if(!capabilities.ok||membershipsError||ownedError)throw Error("Не удалось загрузить права и организации. Повторите загрузку.");
        const rights=await capabilities.json();if(!alive)return;
        setIsAdmin(Boolean(rights.canOpenAdmin));setAccountReady(true);
        const membershipRows=memberships??[],organizationIds=[...new Set([...membershipRows.map(row=>row.team_id),...(ownedTeams??[]).map(row=>row.id)])];
        if(!organizationIds.length)return;
        const {data:teams,error:teamsError}=await supabase.from("teams").select("id,name,type,verified,ultimate_owner_user_id,dissolved_at").in("id",organizationIds).abortSignal(controller.signal);
        if(teamsError)throw teamsError;if(!alive)return;
        const manageableIds=new Set(membershipRows.filter(row=>["leader","senior_deputy","deputy"].includes(row.role_in_team)).map(row=>row.team_id).concat((ownedTeams??[]).map(row=>row.id)));
        const manageable=(teams??[]).filter((team):team is typeof team&{type:"team"|"guild"}=>(team.type==="team"||team.type==="guild")&&team.verified&&!team.dissolved_at&&manageableIds.has(team.id)).map(({id,name,type})=>({id,name,type}));
        setManagedOrganizations(manageable);
        if(manageable[0])await loadOrganizationMembers(manageable[0]);
      }catch(caught){if(alive){const text=caught instanceof Error?caught.message:"Не удалось загрузить страницу";setAccountError(text);setPageError(text);setAccountReady(true);}}
      finally{if(alive)setLoading(false);}
    };
    void init();
    return()=>{alive=false;clearTimeout(timeout);controller.abort();invalidateRegistrations();invalidateOrganizations();};
  },[id,reload,loadOrganizationMembers,supabase,invalidateRegistrations,invalidateOrganizations]);

  useEffect(()=>{
    const requested=sessions.find(row=>row.id===requestedSession);if(!requested)return;
    const timer=setTimeout(()=>{
    setSelectedSessionId(requested.id);
    const upcoming=sessions.filter(row=>!sessionHasEnded(row,Date.now())),futureIndex=upcoming.findIndex(row=>row.id===requested.id);
    if(futureIndex>0){setShowFutureSessions(true);setFutureLimit(n=>Math.max(n,futureIndex));}
    if(sessionHasEnded(requested,Date.now())){setShowPastSessions(true);const past=sessions.filter(row=>sessionHasEnded(row,Date.now())).reverse();setPastLimit(n=>Math.max(n,past.findIndex(row=>row.id===requested.id)+1));}
    },0);return()=>clearTimeout(timer);
  },[requestedSession,sessions]);
  useEffect(()=>{
    if(registrationLoading||!managedOrganizations.length||!selectedSessionId)return;
    const key=`${id}:${selectedSessionId}`;if(preferredOrganization.current===key)return;
    preferredOrganization.current=key;
    const registered=registrations.find(row=>row.status!=="cancelled"&&row.session_id===selectedSessionId&&managedOrganizations.some(team=>team.id===row.team_id));
    const organization=managedOrganizations.find(team=>team.id===registered?.team_id);
    if(organization&&organization.id!==myTeam?.id){const timer=setTimeout(()=>void loadOrganizationMembers(organization),0);return()=>clearTimeout(timer);}
  },[id,selectedSessionId,registrations,registrationLoading,managedOrganizations,myTeam?.id,loadOrganizationMembers]);

  const [gamesError,setGamesError]=useState(""),[gamesRetry,setGamesRetry]=useState(0);
  const gameCache=useRef<{eventId:string;rows:Map<string,EventGame[]>}>({eventId:id,rows:new Map()});
  const visibleSessionIds=useMemo(()=>{
    const upcoming=sessions.filter(row=>!sessionHasEnded(row,clockNow));
    const visible=isAdmin?upcoming.slice(0,1).concat(showFutureSessions?upcoming.slice(1,futureLimit+1):[]):upcoming;
    if(showPastSessions)visible.push(...sessions.filter(row=>sessionHasEnded(row,clockNow)).reverse().slice(0,pastLimit));
    return visible.map(row=>row.id).sort().join(",");
  },[sessions,clockNow,isAdmin,showFutureSessions,futureLimit,showPastSessions,pastLimit]);
  useEffect(()=>{
    if(!accountReady||!visibleSessionIds)return;
    let alive=true;const controller=new AbortController();
    if(gameCache.current.eventId!==id)gameCache.current={eventId:id,rows:new Map()};
    const cache=gameCache.current,missing=visibleSessionIds.split(",").filter(key=>!cache.rows.has(key));
    void (async()=>{try{
      for(let start=0;start<missing.length;start+=100){const ids=missing.slice(start,start+100),rows:EventGame[]=[];
        for(let offset=0;;offset+=500){const {data,error}=await supabase.from("event_games").select("id,session_id,game_number,map_name").in("session_id",ids).neq("status","cancelled").order("game_number").order("id").range(offset,offset+499).abortSignal(controller.signal);if(error)throw error;rows.push(...data??[]);if((data?.length??0)<500)break;}
        if(!alive)return;for(const key of ids)cache.rows.set(key,rows.filter(row=>row.session_id===key));
      }
      if(alive){setGames([...cache.rows.values()].flat());setGamesError("");}
    }catch{if(alive)setGamesError("Не удалось загрузить карты сессий");}})();
    return()=>{alive=false;controller.abort();};
  },[id,visibleSessionIds,accountReady,supabase,gamesRetry]);

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

    setMessage("Регистрация...");
    const { data, error } = await supabase.rpc("register_team_for_session", {
      p_session_id: selectedSessionId,
      p_team_id: myTeam.id,
      p_roster: selectedRoster,
    });

    if (error) {
      setMessage("Ошибка: " + registrationErrorMessage(error.message));
    } else {
      const status = data?.[0]?.registration_status ?? "confirmed";
      setMessage(status === "confirmed" ? "✅ Вы в основном составе!" : "⏳ Вы в листе ожидания.");
      setShowRosterForm(false);
      void refreshRegistrations();
    }
  };

  const registerPlayer = async () => {
    if (!currentUser) { setMessage("Войдите, чтобы записаться."); return; }
    if (!selectedSessionId) { setMessage("Выберите время участия."); return; }

    setMessage("Регистрация...");
    const { data, error } = await supabase.rpc("register_player_for_session", {
      p_session_id: selectedSessionId,
    });

    if (error) {
      setMessage("Ошибка: " + registrationErrorMessage(error.message));
    } else {
      const status = data?.[0]?.registration_status ?? "confirmed";
      setMessage(status === "confirmed" ? "✅ Вы записаны!" : "⏳ Вы в листе ожидания.");
      void refreshRegistrations();
    }
  };

  const saveRoster = async (registrationId: string) => {
    const currentMemberIds = new Set(rosterMembers.map((member) => member.user_id));
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
    setRegistrations([]);
    const url=new URL(window.location.href);url.searchParams.set("sessionId",sessionId);window.history.replaceState(null,"",url);
    setSelectedRoster(current => current.filter(userId => myMembers.some(member => member.user_id === userId)));
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
    const currentMemberIds = new Set(rosterMembers.map((member) => member.user_id));
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

  if (loading) return <div className="min-h-screen p-6"><p role="status">Загрузка...</p></div>;
  if (!event) return <div className="min-h-screen p-6"><p role="alert">{pageError||"Мероприятие не найдено."}</p><button className="secondary-button mt-3" onClick={()=>setReload(n=>n+1)}>Повторить</button></div>;

  const sessionRegistrations = registrations.filter((registration) => registration.session_id === selectedSessionId);
  const upcomingSessions = sessions.filter(s => !sessionHasEnded(s, clockNow));
  const futureSessions = upcomingSessions.slice(1);
  const pastSessions = sessions.filter(s => sessionHasEnded(s, clockNow)).reverse();
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
  const selectedCount = registrationCounts[selectedSessionId];
  const registrationSummary = selectedSession && (
    <p className="mb-3 w-fit rounded-full border border-cyan-400/25 bg-cyan-950/40 px-3 py-1 text-sm font-semibold tabular-nums text-cyan-200" aria-live="polite">
      <span className="sr-only">Зарегистрировано / всего мест: </span>{selectedCount ? `${selectedCount.registered}/${selectedCount.capacity ?? "∞"}` : "…"}{!!selectedCount?.waiting&&<span className="ml-3 text-amber-200">Запас: {selectedCount.waiting}</span>}
    </p>
  );
  const renderSession = (s: Session) => {
          const isResponsible = s.responsible_user_id === currentUser?.id;
          const registrationCount = registrationCounts[s.id];
          return (
            <div key={s.id} data-session-id={s.id} className="bg-gray-800 p-4 rounded mb-2">
              <p><span className="text-gray-400">Начало:</span> {new Date(s.start_time).toLocaleString("ru-RU",{timeZone:"Europe/Moscow"}) + " МСК"}</p>
              {prizePlans[s.id]&&<p className="mt-2 text-amber-300">Призы: {prizePlans[s.id].map((sum,i)=>`${i+1}-е место — ${sum.toLocaleString("ru-RU")} 🪙`).join(" · ")}</p>}
              {s.end_time && <p><span className="text-gray-400">Конец:</span> {new Date(s.end_time).toLocaleString("ru-RU",{timeZone:"Europe/Moscow"}) + " МСК"}</p>}
              {registrationCount && <p className="mt-2 w-fit rounded-full border border-cyan-400/25 bg-cyan-950/40 px-3 py-1 text-sm font-semibold tabular-nums text-cyan-200"><span className="sr-only">Зарегистрировано / всего мест: </span>{registrationCount.registered}/{registrationCount.capacity ?? "∞"}</p>}
              {games.some((game) => game.session_id === s.id) && <div className="mt-3 flex flex-wrap gap-2">{games.filter((game) => game.session_id === s.id).map((game) => <span key={game.id} className="rounded bg-cyan-950 px-3 py-1 text-xs text-cyan-200">Игра {game.game_number}: {mapTitle(game.map_name)}</span>)}</div>}

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
  };
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

        <section className="mt-6 rounded-lg border border-white/10 bg-gray-900/50 p-4">
          <h2 className="text-xl font-semibold">Правила мероприятия</h2>
          {event.rules_text
            ? <TranslatedText sourceType="event" sourceId={event.id} sourceField="rules_text" original={event.rules_text} className="mt-3" textClassName="whitespace-pre-wrap text-gray-300" />
            : <p className="mt-3 text-gray-400">Правила пока не добавлены.</p>}
        </section>

        {event.stream_url && (
          <a href={event.stream_url} target="_blank" className="inline-block mt-3 px-4 py-2 bg-red-600 rounded hover:bg-red-700">
            ▶ Смотреть стрим
          </a>
        )}

        <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
          {event.cost > 0 && <div><span className="text-gray-400">Стоимость:</span> {formatCoins(event.cost, locale)}</div>}
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
        {gamesError&&<p role="alert">{gamesError}. <button className="secondary-button" onClick={()=>setGamesRetry(n=>n+1)}>Повторить загрузку карт</button></p>}
        {(isAdmin ? upcomingSessions.slice(0, 1) : upcomingSessions).map(renderSession)}
        {!upcomingSessions.length && <p className="mb-4 text-gray-400">Предстоящих сессий пока нет.</p>}
        {isAdmin && !!futureSessions.length && <>
          <button type="button" className="secondary-button mb-3" aria-expanded={showFutureSessions} aria-controls="future-sessions" onClick={() => setShowFutureSessions(value => !value)}>
            {showFutureSessions ? "▴" : "▾"} Будущие ({futureSessions.length})
          </button>
          {showFutureSessions && <div id="future-sessions">
            {futureSessions.slice(0, futureLimit).map(renderSession)}
            {futureLimit < futureSessions.length && <button type="button" className="secondary-button mb-3" onClick={() => setFutureLimit(value => value + 10)}>Показать ещё</button>}
          </div>}
        </>}
        {!!pastSessions.length && <>
          <button type="button" className="secondary-button mb-3" aria-expanded={showPastSessions} aria-controls="past-sessions" onClick={() => setShowPastSessions(value => !value)}>
            {showPastSessions ? "▴" : "▾"} Прошедшие ({pastSessions.length})
          </button>
          {showPastSessions && <div id="past-sessions">
            {pastSessions.slice(0, pastLimit).map(renderSession)}
            {pastLimit < pastSessions.length && <button type="button" className="secondary-button" onClick={() => setPastLimit(value => value + 10)}>Показать ещё</button>}
          </div>}
        </>}

      </div>

      {accountError&&<div role="alert" className="mt-4 rounded border border-amber-600 p-4">{accountError} <button className="secondary-button" onClick={()=>setReload(n=>n+1)}>Повторить</button></div>}
      {!accountReady&&<p role="status" className="mt-4">Загрузка ваших заявок и организаций…</p>}
      {registrationError&&<div role="alert" className="mt-4">{registrationError} <button className="secondary-button" onClick={()=>void refreshRegistrations()}>Повторить загрузку заявок</button></div>}
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
            {guestMembers?.teamId === myTeam?.id && guestMembers?.sessionId === selectedSessionId && guestMembers.error && <p role="alert" className="mt-2 text-sm text-amber-200">{guestMembers.error}</p>}
            {showRosterForm && (
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {rosterMembers.map((m) => (
                  <label key={m.user_id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedRoster.includes(m.user_id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedRoster([...selectedRoster, m.user_id]);
                        else setSelectedRoster(selectedRoster.filter(id => id !== m.user_id));
                      }}
                    />
                    {m.nickname} ({m.isGuest ? "Гость" : m.role_in_team === "leader" ? "Лидер" : m.role_in_team === "deputy" ? "Зам" : m.position === "main" ? "Основа" : "Запас"})
                  </label>
                ))}
              </div>
            )}
          </div>

          <p className={registrationIsOpen ? "mb-3 text-sm text-green-400" : "mb-3 text-sm text-yellow-300"}>{registrationHint}</p>
          {registrationSummary}
          <RegistrationRestrictions eventId={id} teamId={myTeam.id} roster={selectedRoster} refreshKey={message}/>
          <button onClick={registerTeam} disabled={!registrationIsOpen||registrationLoading||!!registrationError||!!accountError} className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600 disabled:opacity-50">
            {!registrationIsOpen ? "Регистрация недоступна" : `Записать ${myTeam.type === "guild" ? "гильдию" : "команду"}`}
          </button>
          {message && <p className="mt-3 text-sm">{message}</p>}
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
          {registrationSummary}
          <RegistrationRestrictions eventId={id} refreshKey={message}/>
          <button onClick={registerPlayer} disabled={!registrationIsOpen||registrationLoading||!!registrationError||!!accountError} className="px-4 py-2 bg-green-600 rounded hover:bg-green-700 disabled:opacity-50">
            {registrationIsOpen ? "Записаться лично" : "Регистрация недоступна"}
          </button>
          {message && <p className="mt-3 text-sm">{message}</p>}
        </div>
      )}

      {currentUser && allowsCollectiveRegistration && !allowsIndividualRegistration && !alreadyRegistered && (!myTeam || !canManageTeam) && (
        <div className="mt-6 bg-gray-800 p-4 rounded">
          <h2 className="text-lg font-semibold">Командная регистрация</h2>
          {registrationSummary}
          <p className="mt-1 text-sm text-gray-300">
            На это мероприятие заявку подаёт руководитель верифицированной команды или гильдии.
          </p>
          <Link href="/teams" className="mt-3 inline-block text-blue-400 hover:underline">Перейти к командам и гильдиям</Link>
        </div>
      )}

      {!currentUser && (
        <div className="mt-6 bg-gray-800 p-4 rounded">
          {registrationSummary}
          <p className="text-sm text-gray-300">{registrationHint}</p>
          <p className="mt-2 text-sm text-gray-300">
            {allowsIndividualRegistration
              ? "Доступна личная заявка без команды или гильдии."
              : "Для участия потребуется верифицированная команда или гильдия."}
          </p>
          <Link href="/auth" className="mt-3 inline-block px-4 py-2 bg-blue-500 rounded hover:bg-blue-600">Войти для участия</Link>
        </div>
      )}

      {waiting.filter(row=>row.is_own&&!((canManageTeam||row.participant_user_id===currentUser?.id)&&row.id===selectedRegistration?.id)).map(row=><p key={`own-reserve:${row.id}`} className="my-4 rounded-lg border border-amber-400/30 p-4" role="status">{row.team_name}: запас №{row.queue_position??"—"}. При освобождении места до закрытия регистрации заявка автоматически попадёт в основной состав.</p>)}
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
          {registrationSummary}
          <p className="mb-2">
            {selectedRegistration?.participant_user_id ? "Личная заявка: " : "Заявка команды: "}
            {registrationStatus === "confirmed" ? "✅ участие подтверждено" : `⏳ Запас №${selectedRegistration?.queue_position??"—"}`}
          </p>

          {selectedRegistration?.team_id && canManageTeam && (
            <div className="mb-4 rounded bg-gray-700 p-3">
              <p className="text-sm font-semibold">
                Состав ({selectedRegistration.roster.length}/{event.min_players || 4})
              </p>
              <div className="mt-2 space-y-1 text-sm text-gray-300">
                {selectedRegistration.roster.length > 0 ? selectedRegistration.roster.map((userId) => (
                  <p key={userId}>— {rosterMembers.find((member) => member.user_id === userId)?.nickname || selectedRegistration.roster_players?.find((player) => player.id === userId)?.nickname || "Игрок"}</p>
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
                        {rosterMembers.map((member) => (
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
                            {member.nickname} ({member.isGuest ? "Гость" : member.role_in_team === "leader" ? "Лидер" : member.role_in_team === "senior_deputy" ? "Старший зам" : member.role_in_team === "deputy" ? "Зам" : member.position === "main" ? "Основа" : "Запас"})
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
          {message && <p className="mt-3 text-sm">{message}</p>}
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
          {registrationSummary}
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
                  <p className="text-xs text-slate-400">Рейтинг {formatNumber(Number(r.team_rating ?? 1), {minimumFractionDigits: 2, maximumFractionDigits: 2})} · вероятность победы {Math.round((Number(r.team_rating ?? 1) / Math.max(1, confirmed.reduce((sum, item) => sum + Number(item.team_rating ?? 1), 0))) * 100)}%</p>
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
              <span className="text-yellow-400">Запас №{r.queue_position??"—"}</span>
            </div>
          ))}
        </div>
      )}
      {event.comments_enabled !== false && <CommentsSection eventId={id} sessionId={selectedSessionId||undefined} />}
    </div>
  );
}
