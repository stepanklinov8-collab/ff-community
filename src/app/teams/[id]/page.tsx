"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useParams } from "next/navigation";
import Link from "next/link";

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

export default function TeamPage() {
  const { id } = useParams();
  const supabase = createClient();
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLeader, setIsLeader] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isMember, setIsMember] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

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

  // Предупреждения команды
  const [teamWarnings, setTeamWarnings] = useState<any>({
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
  }, [id]);

  const fetchMembers = useCallback(async () => {
    const { data } = await supabase.from("team_members")
      .select("id, user_id, role_in_team, position")
      .eq("team_id", id);
    if (data) {
      const enriched = await Promise.all(data.map(async (m) => {
        const { data: profile } = await supabase.from("profiles").select("nickname").eq("id", m.user_id).single();
        return { ...m, nickname: profile?.nickname || "—", position: m.position || "main" };
      }));
      setMembers(enriched);
    }
  }, [id]);

  const fetchJoinRequests = useCallback(async () => {
    const { data } = await supabase.from("join_requests")
      .select("id, user_id, status")
      .eq("team_id", id)
      .eq("status", "pending");
    if (data) {
      const enriched = await Promise.all(data.map(async (r) => {
        const { data: profile } = await supabase.from("profiles").select("nickname").eq("id", r.user_id).single();
        return { ...r, nickname: profile?.nickname || "—" };
      }));
      setJoinRequests(enriched);
    }
  }, [id]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const teamData = await fetchTeam();
      await fetchMembers();
      await fetchJoinRequests();

      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      if (user) {
        if (teamData?.leader_id === user.id) {
          setIsLeader(true);
          // Загружаем предупреждения команды
          const res = await fetch(`/api/team/warnings?teamId=${id}`);
          const data = await res.json();
          setTeamWarnings(data);
        }
        const isM = members.some(m => m.user_id === user.id);
        setIsMember(isM);
        if (!isM) {
          const { data: req } = await supabase.from("join_requests")
            .select("id").eq("team_id", id).eq("user_id", user.id).eq("status", "pending").single();
          if (req) setHasPendingRequest(true);
        }
      }
      setLoading(false);
    };
    init();
  }, [fetchTeam, fetchMembers, fetchJoinRequests]);

  const searchPlayers = async () => {
    if (!searchQuery.trim()) return;
    const { data } = await supabase.from("profiles")
      .select("id, nickname")
      .or(`nickname.ilike.%${searchQuery}%,id.ilike.%${searchQuery}%`)
      .limit(5);
    if (data) setSearchResults(data);
  };

  const addPlayer = async (userId: string, nickname: string) => {
    if (mainCount >= 4) {
      setInviteMessage("⚠️ Основа уже заполнена (макс 4). Назначьте игрока запасным.");
      return;
    }
    const { error } = await supabase.from("team_members").insert({
      team_id: id, user_id: userId, role_in_team: "main", position: "main",
    });
    if (error) setInviteMessage("Ошибка: " + error.message);
    else {
      setInviteMessage(`${nickname} добавлен!`);
      setSearchResults([]);
      setSearchQuery("");
      fetchMembers();
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
    const updates: any = { name: editName, description: editDesc, type: editType, social_link: editSocial };
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
    setUploadingAvatar(true);
    const fileName = `team_${team.id}_${Date.now()}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(fileName, avatarFile);
    if (uploadError) { setInviteMessage("Ошибка: " + uploadError.message); setUploadingAvatar(false); return; }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName);
    await supabase.from("teams").update({ avatar_url: urlData.publicUrl }).eq("id", team.id);
    setAvatarUrl(urlData.publicUrl);
    setAvatarFile(null);
    setUploadingAvatar(false);
    setInviteMessage("Аватар обновлён!");
  };

  const transferLeadership = async () => {
    if (!transferUserId || !currentUser) return;
    await supabase.from("leadership_transfers").insert({
      team_id: id, from_user_id: currentUser.id, to_user_id: transferUserId,
    });
    setInviteMessage("Запрос на передачу лидерства отправлен. Игрок должен подтвердить.");
    setShowTransfer(false);
  };

  const acceptLeadership = async () => {
    if (!currentUser) return;
    const { data: transfer } = await supabase.from("leadership_transfers")
      .select("id").eq("team_id", id).eq("to_user_id", currentUser.id).eq("status", "pending").single();
    if (!transfer) return;
    await supabase.from("leadership_transfers").update({ status: "accepted" }).eq("id", transfer.id);
    await supabase.from("teams").update({ leader_id: currentUser.id }).eq("id", id);
    await supabase.from("team_members").update({ role_in_team: "main" }).eq("team_id", id).eq("user_id", team?.leader_id);
    await supabase.from("team_members").upsert({ team_id: id, user_id: currentUser.id, role_in_team: "leader", position: "main" });
    fetchTeam();
    fetchMembers();
    setInviteMessage("Вы стали лидером!");
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

    await supabase.from("join_requests").insert({ team_id: id, user_id: currentUser.id });
    setHasPendingRequest(true);
    setInviteMessage("Заявка отправлена!");
  };

  const handleJoinRequest = async (requestId: string, approve: boolean) => {
    if (approve) {
      if (mainCount >= 4) { setInviteMessage("⚠️ Основа заполнена."); return; }
      const { data: req } = await supabase.from("join_requests").select("user_id").eq("id", requestId).single();
      if (req) {
        await supabase.from("team_members").insert({ team_id: id, user_id: req.user_id, role_in_team: "main", position: "main" });
      }
    }
    await supabase.from("join_requests").update({ status: approve ? "approved" : "rejected" }).eq("id", requestId);
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
                {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" /> :
                  <div className="w-full h-full flex items-center justify-center text-xl text-gray-400">{team.name?.[0]?.toUpperCase()}</div>}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-blue-500">{team.name}</h1>
                  <span className="text-xs uppercase bg-gray-700 px-2 py-1 rounded">{team.type === "guild" ? "Гильдия" : "Команда"}</span>
                  {team.verified && <span className="text-green-400 text-sm">✓</span>}
                </div>
                {isLeader && (
                  <div className="flex gap-2 mt-2">
                    <input className="text-sm text-white w-40" type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} />
                    {avatarFile && <button onClick={uploadAvatar} disabled={uploadingAvatar} className="px-3 py-1 bg-blue-500 rounded text-sm">{uploadingAvatar ? "..." : "Загрузить"}</button>}
                  </div>
                )}
              </div>
            </div>
            <p className="text-gray-300 mb-4">{team.description || "Нет описания"}</p>
            {team.social_link && <a href={team.social_link} target="_blank" className="text-blue-400 block mb-4">Сообщество →</a>}
            {isLeader && (
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setEditMode(true)} className="px-4 py-2 bg-blue-500 rounded">Редактировать</button>
                <button onClick={() => setShowTransfer(!showTransfer)} className="px-4 py-2 bg-yellow-600 rounded">Передать лидерство</button>
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
                <button onClick={transferLeadership} className="px-3 py-1 bg-green-600 rounded text-sm">Передать</button>
              </div>
            )}
            {isMember && !isLeader && (
              <button onClick={acceptLeadership} className="mt-2 px-4 py-2 bg-green-600 rounded">Принять лидерство (если предложено)</button>
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
          {teamWarnings.activeWarnings.map((w: any) => (
            <div key={w.id} className="bg-gray-700 p-2 rounded mb-2 text-sm">
              <p>Уровень {w.level} {w.expires_at ? `(до ${new Date(w.expires_at).toLocaleDateString("ru")})` : "(навсегда)"}</p>
              <p className="text-gray-400">{w.reason}</p>
            </div>
          ))}
        </div>
      )}

      {/* Поиск и добавление */}
      {isLeader && (
        <div className="mt-6 bg-gray-800 p-4 rounded">
          <h3 className="text-lg font-semibold mb-3">Добавить игрока</h3>
          <div className="flex gap-2 mb-3">
            <input className="flex-1 p-2 text-black rounded" placeholder="Ник или ID" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <button onClick={searchPlayers} className="px-4 py-2 bg-blue-500 rounded">Найти</button>
          </div>
          {searchResults.map(p => (
            <div key={p.id} className="flex justify-between items-center bg-gray-700 p-2 rounded mb-1">
              <span>{p.nickname}</span>
              <button onClick={() => addPlayer(p.id, p.nickname)} className="px-3 py-1 bg-green-600 rounded text-sm">Добавить</button>
            </div>
          ))}
        </div>
      )}

      {/* Заявки */}
      {isLeader && joinRequests.length > 0 && (
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