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
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editNickname, setEditNickname] = useState("");
  const [editGameId, setEditGameId] = useState("");

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalType, setModalType] = useState<"message" | "warning" | "ban" | "roles" | null>(null);

  const [msgSubject, setMsgSubject] = useState("");
  const [msgBody, setMsgBody] = useState("");

  const [warnLevel, setWarnLevel] = useState(1);
  const [warnReason, setWarnReason] = useState("");
  const [warnExpires, setWarnExpires] = useState<"week" | "forever">("week");
  const [warnEventId, setWarnEventId] = useState("");

  const [eventsList, setEventsList] = useState<EventOption[]>([]);

  const [banReason, setBanReason] = useState("");

  const availableRoles = ["blogger", "moderator", "superadmin"];

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
        })));
      }
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

  const openModal = (user: User, type: "message" | "warning" | "ban" | "roles") => {
    setSelectedUser(user);
    setModalType(type);
    setMsgSubject("");
    setMsgBody("");
    setWarnLevel(1);
    setWarnReason("");
    setWarnExpires("week");
    setWarnEventId("");
    setBanReason("");
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
    const res = await authFetch("/api/admin/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role, action }),
    });
    const data = await res.json();
    if (data.success) {
      setMessage("Плашка обновлена");
    } else {
      setMessage("Ошибка: " + (data.error || "неизвестная ошибка"));
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
                      <Link href={`/profile/${user.id}`} className="text-blue-400 hover:underline">
                        {user.nickname}
                      </Link>
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
                        <button onClick={() => startEdit(user)} className="px-2 py-1 bg-blue-500 rounded text-xs">Ред.</button>
                        <button onClick={() => openModal(user, "message")} className="px-2 py-1 bg-green-500 rounded text-xs">Написать</button>
                        <button onClick={() => openModal(user, "warning")} className="px-2 py-1 bg-yellow-600 rounded text-xs">Пред</button>
                        <button onClick={() => openModal(user, "ban")} className="px-2 py-1 bg-red-600 rounded text-xs">Бан</button>
                        <button onClick={() => openModal(user, "roles")} className="px-2 py-1 bg-purple-600 rounded text-xs">Плашки</button>
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
                <h2 className="text-xl font-bold mb-4">Плашки для {selectedUser.nickname}</h2>
                <div className="space-y-2">
                  {availableRoles.map(role => (
                    <div key={role} className="flex justify-between items-center">
                      <span>{role === "blogger" ? "Блогер" : role === "moderator" ? "Модератор" : "Админ"}</span>
                      <div className="flex gap-1">
                        <button onClick={() => toggleRole(selectedUser.id, role, "add")} className="px-2 py-1 bg-green-600 rounded text-xs">+</button>
                        <button onClick={() => toggleRole(selectedUser.id, role, "remove")} className="px-2 py-1 bg-red-600 rounded text-xs">−</button>
                      </div>
                    </div>
                  ))}
                </div>
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
}
