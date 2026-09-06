"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { User } from "@supabase/supabase-js";
import { authFetch } from "@/utils/api/auth-fetch";

interface Team {
  id: string;
  name: string;
  description: string;
  type: string;
  social_link: string;
  leader_id: string;
  verified: boolean;
  created_at: string;
  avatar_url: string;
  main_rating: number;
  reputation_score: number;
  dissolved_at: string | null;
}

interface LeadershipTransfer {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: "pending";
}

interface HistoryItem {
  id: string;
  mode: "tournament" | "training" | "bo" | "kv";
  event_title: string;
  occurred_at: string;
  place: number | null;
  kills: number | null;
  points: number | null;
  score: string | null;
  result_status: string;
  roster_snapshot: { nickname?: string }[];
}

interface Member {
  id: string;
  user_id: string;
  role_in_team: string;
  position: string;
  nickname: string;
}

interface JoinRequest {
  id: string;
  user_id: string;
  nickname: string;
  status: string;
}

interface PlayerSearchResult {
  id: string;
  nickname: string;
  game_id: string | null;
}

interface WarningRow {
  id: string;
  level: number;
  reason: string;
  expires_at: string | null;
}

interface TeamWarnings {
  activeWarnings: WarningRow[];
  warningCount: number;
  activeBan: { reason: string } | null;
}

export default function TeamPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLeader, setIsLeader] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);

  const [inviteMessage, setInviteMessage] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editType, setEditType] = useState("team");
  const [editSocial, setEditSocial] = useState("");

  // Аватарка
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Передача лидерства
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferUserId, setTransferUserId] = useState("");
  const [pendingTransfer, setPendingTransfer] = useState<LeadershipTransfer | null>(null);
  const [organizationBusy, setOrganizationBusy] = useState(false);

  // Предупреждения команды
  const [teamWarnings, setTeamWarnings] = useState<TeamWarnings>({
    activeWarnings: [],
    warningCount: 0,
    activeBan: null,
  });

  const mainCount = members.filter(m => m.position === "main").length;

  const fetchTeam = useCallback(async () => {
    const { data } = await supabase.from("teams").select("*").eq("id", id).single();
    if (data) {
      setTeam(data);
      setEditName(data.name);
      setEditDesc(data.description || "");
      setEditType(data.type);
      setEditSocial(data.social_link || "");
      setAvatarUrl(data.avatar_url || "");
      return data;
    }
    return null;
  }, [id, supabase]);

  const fetchMembers = useCallback(async () => {
    const { data } = await supabase.from("team_members")
      .select("id, user_id, role_in_team, position")
      .eq("team_id", id);
    if (data) {
      const { data: profiles } = data.length
        ? await supabase.from("profiles").select("id,nickname").in("id", data.map((member) => member.user_id))
        : { data: [] as { id: string; nickname: string | null }[] };
      const nicknameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.nickname]));
      const enriched = data.map((member) => ({
        ...member,
        nickname: nicknameById.get(member.user_id) || "—",
        position: member.position || "main",
      }));
      setMembers(enriched);
      return enriched;
    }
    return [];
  }, [id, supabase]);

  const fetchJoinRequests = useCallback(async () => {
    const { data } = await supabase.from("team_join_requests")
      .select("id, user_id, status")
      .eq("team_id", id)
      .eq("status", "pending");
    if (data) {
      const { data: profiles } = data.length
        ? await supabase.from("profiles").select("id,nickname").in("id", data.map((request) => request.user_id))
        : { data: [] as { id: string; nickname: string | null }[] };
      const nicknameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.nickname]));
      const enriched = data.map((request) => ({ ...request, nickname: nicknameById.get(request.user_id) || "—" }));
      setJoinRequests(enriched);
    }
  }, [id, supabase]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const teamData = await fetchTeam();
      const loadedMembers = await fetchMembers();
      await fetchJoinRequests();
      const { data: historyRows } = await supabase.from("organization_participation_history")
        .select("id,mode,event_title,occurred_at,place,kills,points,score,result_status,roster_snapshot")
        .eq("organization_id", id).order("occurred_at", { ascending: false }).limit(100);
      setHistory((historyRows ?? []) as HistoryItem[]);

      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      if (user) {
        const membership = loadedMembers.find((member) => member.user_id === user.id);
        const organizationIsActive = !teamData?.dissolved_at;
        const leader = organizationIsActive && (teamData?.leader_id === user.id || membership?.role_in_team === "leader");
        const manager = organizationIsActive && ["leader", "senior_deputy", "deputy"].includes(membership?.role_in_team ?? "");
        setIsLeader(leader);
        setCanManage(manager);
        if (organizationIsActive) {
          const { data: transfer } = await supabase
            .from("leadership_transfers")
            .select("id, from_user_id, to_user_id, status")
            .eq("team_id", id)
            .eq("status", "pending")
            .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
            .maybeSingle();
          setPendingTransfer((transfer as LeadershipTransfer | null) ?? null);
        }
        if (manager) {
          const res = await authFetch(`/api/team/warnings?teamId=${id}`);
          const data = await res.json();
          setTeamWarnings(data);
        }
        const isM = Boolean(membership);
        setIsMember(isM);
        if (!isM) {
          const { data: req } = await supabase.from("team_join_requests")
            .select("id").eq("team_id", id).eq("user_id", user.id).eq("status", "pending").single();
          if (req) setHasPendingRequest(true);
        }
      }
      setLoading(false);
    };
    init();
  }, [fetchTeam, fetchMembers, fetchJoinRequests, id, supabase]);

  const searchPlayers = async () => {
    if (!searchQuery.trim()) return;
    const query = searchQuery.trim().replace(/[%,()]/g, "");
    const [{ data: byNickname }, { data: byGameId }] = await Promise.all([
      supabase.from("profiles").select("id, nickname, game_id").ilike("nickname", `%${query}%`).limit(5),
      supabase.from("profiles").select("id, nickname, game_id").eq("game_id", query).limit(1),
    ]);
    const unique = new Map<string, PlayerSearchResult>();
    for (const player of [...(byGameId ?? []), ...(byNickname ?? [])]) unique.set(player.id, player);
    setSearchResults([...unique.values()].filter((player) => player.id !== currentUser?.id).slice(0, 5));
  };

  const addPlayer = async (userId: string, nickname: string) => {
    const { error } = await supabase.rpc("send_team_invitation", {
      p_team_id: id,
      p_user_id: userId,
    });
    if (error) setInviteMessage("Ошибка: " + error.message);
    else {
      setInviteMessage(`Приглашение для ${nickname} отправлено и действует 7 дней.`);
      setSearchResults([]);
      setSearchQuery("");
    }
  };

  const changeRole = async (memberId: string, newRole: string) => {
    await supabase.from("team_members").update({ role_in_team: newRole }).eq("id", memberId);
    fetchMembers();
  };

  const changePosition = async (memberId: string, newPos: string) => {
    if (newPos === "main" && mainCount >= 4) {
      setInviteMessage("⚠️ В основе уже 4 игрока.");
      return;
    }
    await supabase.from("team_members").update({ position: newPos }).eq("id", memberId);
    fetchMembers();
  };

  const removeMember = async (memberId: string) => {
    if (!confirm("Удалить игрока из состава?")) return;
    await supabase.from("team_members").delete().eq("id", memberId);
    fetchMembers();
  };

  const saveProfile = async () => {
    const needsReverify = (editName !== team?.name) || (editType !== team?.type);
    const updates: {
      name: string;
      description: string;
      type: string;
      social_link: string;
      verified?: boolean;
    } = { name: editName, description: editDesc, type: editType, social_link: editSocial };
    if (needsReverify) updates.verified = false;
    const { error } = await supabase.from("teams").update(updates).eq("id", id);
    if (!error) {
      setEditMode(false);
      fetchTeam();
      setInviteMessage(needsReverify ? "Отправлено на повторную верификацию." : "Профиль обновлён!");
    }
  };

  const uploadAvatar = async () => {
    if (!avatarFile || !team) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(avatarFile.type) || avatarFile.size > 5 * 1024 * 1024) {
      setInviteMessage("Эмблема должна быть JPEG, PNG, WebP или GIF размером до 5 МБ.");
      return;
    }
    setUploadingAvatar(true);
    setInviteMessage("");
    try {
      const formData = new FormData();
      formData.set("avatar", avatarFile);
      const response = await authFetch(`/api/teams/${team.id}/avatar`, { method: "POST", body: formData });
      const payload = await response.json() as { avatarUrl?: string; error?: string };
      if (!response.ok || !payload.avatarUrl) throw new Error(payload.error || "Не удалось загрузить эмблему");
      setAvatarUrl(payload.avatarUrl);
      setAvatarFile(null);
      setInviteMessage("Эмблема обновлена!");
    } catch (uploadError) {
      setInviteMessage(uploadError instanceof Error ? uploadError.message : "Не удалось загрузить эмблему");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const transferLeadership = async () => {
    if (!transferUserId || !currentUser) return;
    setOrganizationBusy(true);
    const { data, error } = await supabase.rpc("request_team_leadership_transfer", {
      p_team_id: id,
      p_to_user_id: transferUserId,
    });
    setOrganizationBusy(false);
    if (error) {
      setInviteMessage("Не удалось передать лидерство: " + error.message);
      return;
    }
    setPendingTransfer({
      id: String(data),
      from_user_id: currentUser.id,
      to_user_id: transferUserId,
      status: "pending",
    });
    setInviteMessage("Запрос на передачу лидерства отправлен. Игрок должен подтвердить.");
    setShowTransfer(false);
    setTransferUserId("");
  };

  const respondLeadership = async (accept: boolean) => {
    if (!currentUser || !pendingTransfer || pendingTransfer.to_user_id !== currentUser.id) return;
    setOrganizationBusy(true);
    const { error } = await supabase.rpc("respond_team_leadership_transfer", {
      p_transfer_id: pendingTransfer.id,
      p_accept: accept,
    });
    setOrganizationBusy(false);
    if (error) {
      setInviteMessage("Не удалось обработать передачу лидерства: " + error.message);
      return;
    }
    setPendingTransfer(null);
    if (!accept) {
      setInviteMessage("Предложение лидерства отклонено.");
      return;
    }
    await Promise.all([fetchTeam(), fetchMembers()]);
    setIsLeader(true);
    setCanManage(true);
    setInviteMessage("Вы стали лидером!");
  };

  const dissolveOrganization = async () => {
    if (!team || !isLeader || organizationBusy) return;
    const kind = team.type === "guild" ? "гильдию" : "команду";
    if (!confirm(`Распустить ${kind} «${team.name}»? Все текущие заявки и незавершённые КВ будут отменены.`)) return;
    const confirmation = prompt(`Для подтверждения введите название: ${team.name}`);
    if (confirmation !== team.name) {
      setInviteMessage("Роспуск отменён: название введено неверно.");
      return;
    }

    setOrganizationBusy(true);
    const { error } = await supabase.rpc("dissolve_organization", { p_team_id: id });
    setOrganizationBusy(false);
    if (error) {
      setInviteMessage("Не удалось распустить организацию: " + error.message);
      return;
    }
    router.push("/teams");
    router.refresh();
  };

  const sendJoinRequest = async () => {
    if (!currentUser) return;

    // Проверка бана игрока
    const { data: playerBan } = await supabase
      .from("bans")
      .select("id")
      .eq("target_type", "player")
      .eq("target_id", currentUser.id)
      .eq("is_active", true)
      .maybeSingle();

    if (playerBan) {
      setInviteMessage("Вы заблокированы и не можете вступать в команды.");
      return;
    }

    const { error } = await supabase.rpc("create_team_join_request", {
      p_team_id: id,
      p_message: null,
    });
    if (error) {
      setInviteMessage("Ошибка: " + error.message);
      return;
    }
    setHasPendingRequest(true);
    setInviteMessage("Заявка отправлена!");
  };

  const handleJoinRequest = async (requestId: string, approve: boolean) => {
    const { error } = await supabase.rpc("review_team_join_request", {
      p_request_id: requestId,
      p_accept: approve,
    });
    if (error) {
      setInviteMessage("Ошибка: " + error.message);
      return;
    }
    fetchJoinRequests();
    fetchMembers();
  };

  const roleLabels: Record<string, string> = {
    leader: "Лидер",
    senior_deputy: "Старший зам",
    deputy: "Зам",
    main: "Игрок",
  };

  const roleBadgeColors: Record<string, string> = {
    leader: "bg-yellow-500 text-black",
    senior_deputy: "bg-orange-500 text-black",
    deputy: "bg-orange-600 text-white",
    main: "bg-gray-600 text-white",
  };

  if (loading) return <div className="min-h-screen p-6"><p>Загрузка...</p></div>;
  if (!team) return <div className="min-h-screen p-6"><p>Команда не найдена.</p></div>;

  return (
    <div className="min-h-screen p-6">
      <Link href="/teams" className="text-blue-400 hover:underline">← К списку команд</Link>
      {inviteMessage && <div className="mt-4 p-3 bg-gray-800 rounded">{inviteMessage}</div>}

      {/* Профиль */}
      <div className="mt-4 bg-gray-800 p-6 rounded">
        {team.dissolved_at && (
          <div className="mb-4 rounded border border-red-500/40 bg-red-950/50 p-3 text-red-100">
            Эта {team.type === "guild" ? "гильдия" : "команда"} распущена и больше не принимает участников.
          </div>
        )}
        {editMode ? (
          <div className="space-y-3">
            <input className="w-full p-2 text-black rounded" value={editName} onChange={(e) => setEditName(e.target.value)} />
            <textarea className="w-full p-2 text-black rounded" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} />
            <select className="w-full p-2 text-black rounded" value={editType} onChange={(e) => setEditType(e.target.value)}>
              <option value="team">Команда</option>
              <option value="guild">Гильдия</option>
            </select>
            <input className="w-full p-2 text-black rounded" value={editSocial} onChange={(e) => setEditSocial(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={saveProfile} className="px-4 py-2 bg-green-600 rounded">Сохранить</button>
              <button onClick={() => setEditMode(false)} className="px-4 py-2 bg-gray-600 rounded">Отмена</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-lg bg-gray-700 overflow-hidden flex-shrink-0">
                {avatarUrl ? <Image src={avatarUrl} alt={`Эмблема ${team.name}`} width={64} height={64} unoptimized className="w-full h-full object-cover" /> :
                  <div className="w-full h-full flex items-center justify-center text-xl text-gray-400">{team.name?.[0]?.toUpperCase()}</div>}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-blue-500">{team.name}</h1>
                  <span className="text-xs uppercase bg-gray-700 px-2 py-1 rounded">{team.type === "guild" ? "Гильдия" : "Команда"}</span>
                  {team.verified && <span className="text-green-400 text-sm">✓</span>}
                </div>
                {canManage && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600">
                      Выбрать эмблему
                      <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} />
                    </label>
                    {avatarFile && <button onClick={uploadAvatar} disabled={uploadingAvatar} className="rounded bg-blue-500 px-3 py-1 text-sm disabled:opacity-50">{uploadingAvatar ? "Загрузка…" : "Сохранить"}</button>}
                    <span className="text-xs text-slate-400">до 5 МБ</span>
                  </div>
                )}
              </div>
            </div>
            <p className="text-gray-300 mb-4">{team.description || "Нет описания"}</p>
            <div className="mb-4 flex flex-wrap gap-2 text-sm"><span className="rounded bg-cyan-950 px-3 py-1 text-cyan-200">Рейтинг {Number(team.main_rating ?? 1).toFixed(0)}</span><span className="rounded bg-emerald-950 px-3 py-1 text-emerald-200">Репутация {Number(team.reputation_score ?? 50).toFixed(0)}</span></div>
            {team.social_link && <a href={team.social_link} target="_blank" className="text-blue-400 block mb-4">Сообщество →</a>}
            {isLeader && (
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setEditMode(true)} className="px-4 py-2 bg-blue-500 rounded">Редактировать</button>
                <button onClick={() => setShowTransfer(!showTransfer)} disabled={organizationBusy} className="px-4 py-2 bg-yellow-600 rounded disabled:opacity-50">Передать лидерство</button>
                <button onClick={dissolveOrganization} disabled={organizationBusy} className="px-4 py-2 bg-red-700 rounded disabled:opacity-50">
                  {organizationBusy ? "Обработка…" : `Распустить ${team.type === "guild" ? "гильдию" : "команду"}`}
                </button>
              </div>
            )}
            {showTransfer && (
              <div className="mt-3 flex gap-2">
                <select className="p-2 text-black rounded flex-1" value={transferUserId} onChange={(e) => setTransferUserId(e.target.value)}>
                  <option value="">Выберите игрока</option>
                  {members.filter(m => m.user_id !== currentUser?.id).map(m => (
                    <option key={m.user_id} value={m.user_id}>{m.nickname}</option>
                  ))}
                </select>
                <button onClick={transferLeadership} disabled={!transferUserId || organizationBusy} className="px-3 py-1 bg-green-600 rounded text-sm disabled:opacity-50">Передать</button>
              </div>
            )}
            {pendingTransfer?.from_user_id === currentUser?.id && (
              <p className="mt-3 text-sm text-yellow-300">Ожидается подтверждение выбранного участника.</p>
            )}
            {isMember && !isLeader && pendingTransfer?.to_user_id === currentUser?.id && (
              <div className="mt-3 flex flex-wrap gap-2 rounded bg-yellow-950/40 p-3">
                <p className="w-full text-sm text-yellow-100">Вам предлагают стать новым лидером.</p>
                <button onClick={() => respondLeadership(true)} disabled={organizationBusy} className="px-4 py-2 bg-green-600 rounded disabled:opacity-50">Принять</button>
                <button onClick={() => respondLeadership(false)} disabled={organizationBusy} className="px-4 py-2 bg-gray-600 rounded disabled:opacity-50">Отклонить</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Состав */}
      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-2">Состав (основа: {mainCount}/4)</h2>
        <div className="space-y-2">
          {members.map(m => {
            const isCurrentLeader = m.role_in_team === "leader";
            const isSelf = m.user_id === currentUser?.id;
            return (
              <div key={m.id} className="bg-gray-800 p-3 rounded flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Link href={`/profile/${m.user_id}`} className="text-blue-400 hover:underline">
                    {m.nickname}
                  </Link>
                  <span className={`text-xs px-2 py-0.5 rounded ${roleBadgeColors[m.role_in_team] || "bg-gray-600 text-white"}`}>
                    {roleLabels[m.role_in_team] || m.role_in_team}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isLeader && !isCurrentLeader ? (
                    <>
                      <select value={m.role_in_team} onChange={(e) => changeRole(m.id, e.target.value)}
                        className="text-sm bg-gray-700 text-white rounded px-2 py-1">
                        <option value="senior_deputy">Старший зам</option>
                        <option value="deputy">Зам</option>
                        <option value="main">Игрок</option>
                      </select>
                      <select value={m.position} onChange={(e) => changePosition(m.id, e.target.value)}
                        className="text-sm bg-gray-700 text-white rounded px-2 py-1">
                        <option value="main">Основа</option>
                        <option value="substitute">Запасной</option>
                      </select>
                      <button onClick={() => removeMember(m.id)} className="text-red-400 text-sm">✕</button>
                    </>
                  ) : isCurrentLeader && isSelf ? (
                    <select value={m.position} onChange={(e) => changePosition(m.id, e.target.value)}
                      className="text-sm bg-gray-700 text-white rounded px-2 py-1">
                      <option value="main">Основа</option>
                      <option value="substitute">Запасной</option>
                    </select>
                  ) : (
                    <span className="text-sm text-gray-400">{m.position === "main" ? "Основа" : "Запасной"}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 text-xl font-semibold">История выступлений</h2>
        {history.length === 0 ? <p className="text-gray-400">Подтверждённых выступлений пока нет.</p> : <div className="space-y-2">{history.map((item) => <article key={item.id} className="rounded bg-gray-800 p-4">
          <div className="flex flex-wrap justify-between gap-2"><strong>{item.event_title}</strong><span className="text-xs uppercase text-cyan-300">{item.mode}</span></div>
          <p className="mt-1 text-sm text-gray-400">{new Date(item.occurred_at).toLocaleString("ru-RU")} · {item.result_status}</p>
          <p className="mt-2 text-sm">{item.place ? `Место: ${item.place} · ` : ""}{item.kills != null ? `Убийства: ${item.kills} · ` : ""}{item.score ? `Счёт: ${item.score}` : ""}</p>
          {item.roster_snapshot?.length > 0 && <p className="mt-2 text-xs text-gray-500">Состав: {item.roster_snapshot.map((player) => player.nickname || "Игрок").join(", ")}</p>}
        </article>)}</div>}
      </section>

      {/* Предупреждения команды (видны только лидеру) */}
      {isLeader && teamWarnings.warningCount > 0 && (
        <div className="mt-6 bg-gray-800 p-4 rounded border border-yellow-600">
          <h3 className="text-lg font-semibold mb-2">Предупреждения команды ({teamWarnings.warningCount})</h3>
          {teamWarnings.activeBan && (
            <div className="bg-red-900 p-3 rounded mb-3">
              <p className="font-bold text-red-200">Команда заблокирована!</p>
              <p className="text-red-300 text-sm">{teamWarnings.activeBan.reason}</p>
            </div>
          )}
          {teamWarnings.activeWarnings.map((w) => (
            <div key={w.id} className="bg-gray-700 p-2 rounded mb-2 text-sm">
              <p>Уровень {w.level} {w.expires_at ? `(до ${new Date(w.expires_at).toLocaleDateString("ru")})` : "(навсегда)"}</p>
              <p className="text-gray-400">{w.reason}</p>
            </div>
          ))}
        </div>
      )}

      {/* Поиск и добавление */}
      {canManage && (
        <div className="mt-6 bg-gray-800 p-4 rounded">
          <h3 className="text-lg font-semibold mb-3">Пригласить игрока</h3>
          <div className="flex gap-2 mb-3">
            <input className="flex-1 p-2 text-black rounded" placeholder="Ник или ID" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <button onClick={searchPlayers} className="px-4 py-2 bg-blue-500 rounded">Найти</button>
          </div>
          {searchResults.map(p => (
            <div key={p.id} className="flex justify-between items-center bg-gray-700 p-2 rounded mb-1">
              <span>{p.nickname}</span>
              <button onClick={() => addPlayer(p.id, p.nickname)} className="px-3 py-1 bg-green-600 rounded text-sm">Пригласить</button>
            </div>
          ))}
        </div>
      )}

      {/* Заявки */}
      {canManage && joinRequests.length > 0 && (
        <div className="mt-6 bg-gray-800 p-4 rounded">
          <h3 className="text-lg font-semibold mb-3">Заявки на вступление</h3>
          {joinRequests.map(r => (
            <div key={r.id} className="flex justify-between items-center bg-gray-700 p-2 rounded mb-1">
              <span>{r.nickname}</span>
              <div className="flex gap-2">
                <button onClick={() => handleJoinRequest(r.id, true)} className="px-3 py-1 bg-green-600 rounded text-sm">Принять</button>
                <button onClick={() => handleJoinRequest(r.id, false)} className="px-3 py-1 bg-red-600 rounded text-sm">Отклонить</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {currentUser && !isMember && !hasPendingRequest && (
        <div className="mt-6">
          <button onClick={sendJoinRequest} className="px-4 py-2 bg-green-500 rounded">Подать заявку</button>
        </div>
      )}
      {hasPendingRequest && <p className="mt-4 text-yellow-400">⏳ Заявка на рассмотрении.</p>}
    </div>
  );
}
