"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/utils/api/auth-fetch";

interface User {
  id: string;
  email: string;
  nickname: string;
  game_id: string;
  created_at: string;
  roles: string[];
  badges: string[];
  isOwner: boolean;
  profile: { profile_level: number; reputation_score: number; main_rating: number } | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [canDeleteUsers, setCanDeleteUsers] = useState(false);
  const [canManageAdmins, setCanManageAdmins] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editNickname, setEditNickname] = useState("");
  const [editGameId, setEditGameId] = useState("");

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalType, setModalType] = useState<"message" | "warning" | "ban" | "roles" | "delete" | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [roleAction, setRoleAction] = useState<string | null>(null);

  const [msgSubject, setMsgSubject] = useState("");
  const [msgBody, setMsgBody] = useState("");

  const [warnLevel, setWarnLevel] = useState(1);
  const [warnReason, setWarnReason] = useState("");
  const [warnExpires, setWarnExpires] = useState<"week" | "forever">("week");
  const [warnEventId, setWarnEventId] = useState("");

  const [eventsList, setEventsList] = useState<EventOption[]>([]);

  const [banReason, setBanReason] = useState("");

  const availableRoles = ["blogger", "moderator", "admin"];

  const fetchUsers = useCallback(async () => {
    try {
      const res = await authFetch("/api/admin/users");
      const data = await res.json();
      if (data.users) {
        setUsers((data.users as AuthUserPayload[]).map((u) => ({
          id: u.id,
          email: u.email ?? "—",
          nickname: u.user_metadata?.nickname || "—",
          game_id: u.user_metadata?.game_id || "—",
          created_at: u.created_at,
          roles: u.roles ?? [],
          badges: u.badges ?? [],
          isOwner: Boolean(u.isOwner),
          profile: u.profile ?? null,
        })));
      }
      setCanDeleteUsers(Boolean(data.canDeleteUsers));
      setCanManageAdmins(Boolean(data.canManageAdmins));
    } catch (err) {
      console.error("Ошибка загрузки пользователей:", err);
      setMessage("Ошибка загрузки пользователей");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    const response = await authFetch("/api/admin/events");
    const payload = await response.json() as { events?: EventOption[] };
    if (response.ok) setEventsList((payload.events ?? []).map(({ id, title }) => ({ id, title })));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchUsers();
      void fetchEvents();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchEvents, fetchUsers]);

  const startEdit = (user: User) => {
    setEditUserId(user.id);
    setEditNickname(user.nickname);
    setEditGameId(user.game_id);
  };

  const saveEdit = async (userId: string) => {
    const res = await authFetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, nickname: editNickname, gameId: editGameId }),
    });
    const data = await res.json();
    if (data.success) {
      setUsers(users.map(u => u.id === userId ? { ...u, nickname: editNickname, game_id: editGameId } : u));
      setEditUserId(null);
      setMessage("Изменения сохранены!");
    } else {
      setMessage("Ошибка: " + (data.error || "неизвестная ошибка"));
    }
  };

  const openModal = (user: User, type: "message" | "warning" | "ban" | "roles" | "delete") => {
    setSelectedUser(user);
    setModalType(type);
    setMsgSubject("");
    setMsgBody("");
    setWarnLevel(1);
    setWarnReason("");
    setWarnExpires("week");
    setWarnEventId("");
    setBanReason("");
    setDeleteConfirmation("");
  };

  const deleteUser = async () => {
    if (!selectedUser || deleteConfirmation !== "УДАЛИТЬ") return;
    setDeleting(true);
    try {
      const response = await authFetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id, confirmation: deleteConfirmation }),
      });
      const payload = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) throw new Error(payload.error || "Не удалось удалить игрока");
      setUsers((current) => current.filter((user) => user.id !== selectedUser.id));
      setModalType(null);
      setSelectedUser(null);
      setMessage("Профиль игрока удалён");
    } catch (deleteError) {
      setMessage(deleteError instanceof Error ? `Ошибка: ${deleteError.message}` : "Ошибка удаления игрока");
    } finally {
      setDeleting(false);
    }
  };

  const sendMessage = async () => {
    if (!selectedUser || !msgSubject || !msgBody) {
      setMessage("Заполните тему и текст сообщения");
      return;
    }
    const res = await authFetch("/api/admin/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUserId: selectedUser.id, subject: msgSubject, body: msgBody }),
    });
    const data = await res.json();
    if (data.success) {
      setMessage("Сообщение отправлено");
      setModalType(null);
    } else {
      setMessage("Ошибка: " + (data.error || "неизвестная ошибка"));
    }
  };

  const giveWarning = async () => {
    if (!selectedUser) return;
    const expiresAt = warnExpires === "week" ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null;
    const res = await authFetch("/api/admin/warnings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetType: "player",
        targetId: selectedUser.id,
        level: warnLevel,
        reason: warnReason,
        expiresAt,
        isBan: false,
        eventId: warnEventId || null,
      }),
    });
    const data = await res.json();
    if (data.success) {
      setMessage("Предупреждение выдано");
      setModalType(null);
    } else {
      setMessage("Ошибка: " + (data.error || "неизвестная ошибка"));
    }
  };

  const banUser = async () => {
    if (!selectedUser) return;
    const res = await authFetch("/api/admin/warnings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetType: "player",
        targetId: selectedUser.id,
        reason: banReason || "Блокировка",
        isBan: true,
      }),
    });
    const data = await res.json();
    if (data.success) {
      setMessage("Пользователь заблокирован");
      setModalType(null);
    } else {
      setMessage("Ошибка: " + (data.error || "неизвестная ошибка"));
    }
  };

  const toggleRole = async (userId: string, role: string, action: "add" | "remove") => {
    const actionKey = `${userId}:${role}`;
    setRoleAction(actionKey);
    try {
      const res = await authFetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role, action }),
      });
      const data = await res.json() as { success?: boolean; error?: string; roles?: string[]; badges?: string[] };
      if (!res.ok || !data.success) throw new Error(data.error || "неизвестная ошибка");
      const updateUser = (user: User) => user.id === userId
        ? { ...user, roles: data.roles ?? user.roles, badges: data.badges ?? user.badges }
        : user;
      setUsers((current) => current.map(updateUser));
      setSelectedUser((current) => current ? updateUser(current) : null);
      const label = role === "blogger" ? "Плашка «Блогер»" : role === "admin" ? "Роль администратора" : "Роль модератора";
      setMessage(`${label} ${action === "add" ? "назначена" : "снята"}.`);
    } catch (roleError) {
      setMessage(`Ошибка: ${roleError instanceof Error ? roleError.message : "неизвестная ошибка"}`);
    } finally {
      setRoleAction(null);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-6 text-red-500">Пользователи</h1>
      {message && <div className="mb-4 p-3 bg-gray-800 rounded">{message}</div>}

      {loading ? <p>Загрузка...</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left bg-gray-800 rounded">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="p-3">Никнейм</th>
                <th className="p-3">Email</th>
                <th className="p-3">ID в игре</th>
                <th className="p-3">Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b border-gray-700">
                  <td className="p-3">
                    {editUserId === user.id ? (
                      <input
                        className="p-1 text-black rounded w-full"
                        value={editNickname}
                        onChange={(e) => setEditNickname(e.target.value)}
                      />
                    ) : (
                      <>
                        <Link href={`/profile/${user.id}`} className="text-blue-400 hover:underline">
                          {user.nickname}
                        </Link>
                        {user.isOwner && <span className="ml-2 rounded bg-amber-500 px-2 py-0.5 text-xs font-bold text-black">Владелец</span>}
                        {!user.isOwner && user.roles.includes("admin") && <span className="ml-2 rounded bg-purple-700 px-2 py-0.5 text-xs">Администратор</span>}
                        {user.badges.includes("blogger") && <span className="ml-2 rounded bg-pink-700 px-2 py-0.5 text-xs">Блогер</span>}
                        <div className="mt-1 text-xs text-slate-500">Ур. {user.profile?.profile_level ?? 1} · Репутация {Number(user.profile?.reputation_score ?? 50).toFixed(0)} · Рейтинг {Number(user.profile?.main_rating ?? 1).toFixed(0)}</div>
                      </>
                    )}
                  </td>
                  <td className="p-3 text-gray-400">{user.email}</td>
                  <td className="p-3">
                    {editUserId === user.id ? (
                      <input
                        className="p-1 text-black rounded w-full"
                        value={editGameId}
                        onChange={(e) => setEditGameId(e.target.value)}
                      />
                    ) : (
                      user.game_id
                    )}
                  </td>
                  <td className="p-3">
                    {editUserId === user.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(user.id)}
                          className="px-3 py-1 bg-green-600 rounded text-sm"
                        >
                          Подтвердить
                        </button>
                        <button
                          onClick={() => setEditUserId(null)}
                          className="px-3 py-1 bg-gray-600 rounded text-sm"
                        >
                          Отмена
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1 flex-wrap">
                        {!user.isOwner && (canManageAdmins || !user.roles.some((role) => role === "admin" || role === "superadmin")) && <button onClick={() => startEdit(user)} className="px-2 py-1 bg-blue-500 rounded text-xs">Ред.</button>}
                        <button onClick={() => openModal(user, "message")} className="px-2 py-1 bg-green-500 rounded text-xs">Написать</button>
                        {!user.isOwner && (canManageAdmins || !user.roles.some((role) => role === "admin" || role === "superadmin")) && <button onClick={() => openModal(user, "warning")} className="px-2 py-1 bg-yellow-600 rounded text-xs">Пред</button>}
                        {!user.isOwner && (canManageAdmins || !user.roles.some((role) => role === "admin" || role === "superadmin")) && <button onClick={() => openModal(user, "ban")} className="px-2 py-1 bg-red-600 rounded text-xs">Бан</button>}
                        {!user.isOwner && (canManageAdmins || !user.roles.some((role) => role === "admin" || role === "superadmin")) && <button onClick={() => openModal(user, "roles")} className="px-2 py-1 bg-purple-600 rounded text-xs">Роли и плашки</button>}
                        {canDeleteUsers && !user.isOwner && <button onClick={() => openModal(user, "delete")} className="rounded bg-red-950 px-2 py-1 text-xs text-red-200 ring-1 ring-red-700">Удалить</button>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalType && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded max-w-md w-full">
            <button onClick={() => setModalType(null)} className="float-right text-gray-400">✕</button>

            {modalType === "message" && (
              <>
                <h2 className="text-xl font-bold mb-4">Сообщение для {selectedUser.nickname}</h2>
                <input className="w-full p-2 text-black rounded mb-2" placeholder="Тема" value={msgSubject} onChange={(e) => setMsgSubject(e.target.value)} />
                <textarea className="w-full p-2 text-black rounded mb-4" placeholder="Текст сообщения" rows={4} value={msgBody} onChange={(e) => setMsgBody(e.target.value)} />
                <button onClick={sendMessage} className="w-full p-2 bg-blue-500 rounded">Отправить</button>
              </>
            )}

            {modalType === "warning" && (
              <>
                <h2 className="text-xl font-bold mb-4">Предупреждение для {selectedUser.nickname}</h2>
                <label className="block text-sm mb-1">Уровень</label>
                <select className="w-full p-2 text-black rounded mb-2" value={warnLevel} onChange={(e) => setWarnLevel(Number(e.target.value))}>
                  <option value={1}>1 - на конкретное мероприятие</option>
                  <option value={2}>2 - на все мероприятия</option>
                </select>

                {warnLevel === 1 && (
                  <>
                    <label className="block text-sm mb-1">Мероприятие</label>
                    <select className="w-full p-2 text-black rounded mb-2" value={warnEventId} onChange={(e) => setWarnEventId(e.target.value)}>
                      <option value="">Выберите мероприятие</option>
                      {eventsList.map(ev => (
                        <option key={ev.id} value={ev.id}>{ev.title}</option>
                      ))}
                    </select>
                  </>
                )}

                <label className="block text-sm mb-1">Причина</label>
                <input className="w-full p-2 text-black rounded mb-2" value={warnReason} onChange={(e) => setWarnReason(e.target.value)} placeholder="Причина" />
                <label className="block text-sm mb-1">Срок</label>
                <select className="w-full p-2 text-black rounded mb-4" value={warnExpires} onChange={(e) => setWarnExpires(e.target.value as "week" | "forever")}>
                  <option value="week">Неделя</option>
                  <option value="forever">Навсегда</option>
                </select>
                <button onClick={giveWarning} className="w-full p-2 bg-yellow-600 rounded">Выдать пред</button>
              </>
            )}

            {modalType === "ban" && (
              <>
                <h2 className="text-xl font-bold mb-4">Блокировка {selectedUser.nickname}</h2>
                <input className="w-full p-2 text-black rounded mb-4" placeholder="Причина" value={banReason} onChange={(e) => setBanReason(e.target.value)} />
                <button onClick={banUser} className="w-full p-2 bg-red-600 rounded">Заблокировать</button>
              </>
            )}

            {modalType === "roles" && (
              <>
                <h2 className="text-xl font-bold mb-4">Роли и плашки для {selectedUser.nickname}</h2>
                <div className="space-y-2">
                  {availableRoles.filter((role) => role !== "admin" || canManageAdmins).map(role => {
                    const active = role === "blogger" ? selectedUser.badges.includes(role) : selectedUser.roles.includes(role);
                    const busy = roleAction === `${selectedUser.id}:${role}`;
                    return (
                    <div key={role} className="flex justify-between items-center gap-3">
                      <span>
                        {role === "blogger" ? "Плашка «Блогер»" : role === "moderator" ? "Роль модератора" : "Роль администратора"}
                        <small className={active ? "ml-2 text-emerald-300" : "ml-2 text-slate-500"}>{active ? "активна" : "не назначена"}</small>
                      </span>
                      <button
                        onClick={() => toggleRole(selectedUser.id, role, active ? "remove" : "add")}
                        disabled={busy}
                        className={`min-w-24 rounded px-3 py-1 text-xs disabled:opacity-50 ${active ? "bg-red-600" : "bg-green-600"}`}
                      >
                        {busy ? "Сохраняем…" : active ? "Снять" : "Назначить"}
                      </button>
                    </div>
                  )})}
                </div>
              </>
            )}

            {modalType === "delete" && (
              <>
                <h2 className="mb-3 text-xl font-bold text-red-400">Удалить профиль {selectedUser.nickname}?</h2>
                <p className="mb-4 text-sm text-slate-300">
                  Игрок потеряет доступ к аккаунту и исчезнет из рейтинга. Активные данные, аватар и участие в команде будут удалены. Журналы модерации сохранятся.
                </p>
                <label className="mb-1 block text-sm text-slate-400">Для подтверждения введите УДАЛИТЬ</label>
                <input
                  className="mb-4 w-full rounded p-2 text-black"
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                  autoComplete="off"
                />
                <button
                  onClick={deleteUser}
                  disabled={deleteConfirmation !== "УДАЛИТЬ" || deleting}
                  className="w-full rounded bg-red-700 p-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {deleting ? "Удаление…" : "Удалить профиль навсегда"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <Link href="/admin" className="block mt-6 text-blue-400 hover:underline">← Админ-панель</Link>
    </div>
  );
}

interface EventOption {
  id: string;
  title: string;
}

interface AuthUserPayload {
  id: string;
  email?: string;
  user_metadata?: { nickname?: string; game_id?: string };
  created_at: string;
  roles?: string[];
  badges?: string[];
  isOwner?: boolean;
  profile?: { profile_level: number; reputation_score: number; main_rating: number } | null;
}
