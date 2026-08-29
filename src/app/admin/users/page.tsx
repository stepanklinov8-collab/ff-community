"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

interface User {
  id: string;
  email: string;
  nickname: string;
  game_id: string;
  created_at: string;
}

export default function AdminUsersPage() {
  const supabase = createClient();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editNickname, setEditNickname] = useState("");
  const [editGameId, setEditGameId] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

      if (authUsers?.users) {
        const enriched = await Promise.all(
          authUsers.users.map(async (u: any) => {
            const { data: profile } = await supabase
              .from("profiles")
              .select("nickname, avatar_url")
              .eq("id", u.id)
              .single();
            return {
              id: u.id,
              email: u.email,
              nickname: profile?.nickname || u.user_metadata?.nickname || "—",
              game_id: u.user_metadata?.game_id || "—",
              created_at: u.created_at,
            };
          })
        );
        setUsers(enriched);
      }
      setLoading(false);
    };
    fetchUsers();
  }, []);

  const startEdit = (user: User) => {
    setEditUserId(user.id);
    setEditNickname(user.nickname);
    setEditGameId(user.game_id);
  };

  const saveEdit = async (userId: string) => {
    await supabase.from("profiles").upsert({
      id: userId,
      nickname: editNickname,
    });

    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { game_id: editGameId, nickname: editNickname },
    });

    setUsers(users.map(u => u.id === userId ? { ...u, nickname: editNickname, game_id: editGameId } : u));
    setEditUserId(null);
    setMessage("Изменения сохранены!");
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
                      <input className="p-1 text-black rounded w-full" value={editNickname} onChange={(e) => setEditNickname(e.target.value)} />
                    ) : (
                      <Link href={`/profile/${user.id}`} className="text-blue-400 hover:underline">{user.nickname}</Link>
                    )}
                  </td>
                  <td className="p-3 text-gray-400">{user.email}</td>
                  <td className="p-3">
                    {editUserId === user.id ? (
                      <input className="p-1 text-black rounded w-full" value={editGameId} onChange={(e) => setEditGameId(e.target.value)} />
                    ) : (
                      user.game_id
                    )}
                  </td>
                  <td className="p-3">
                    {editUserId === user.id ? (
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(user.id)} className="px-3 py-1 bg-green-600 rounded text-sm">Подтвердить</button>
                        <button onClick={() => setEditUserId(null)} className="px-3 py-1 bg-gray-600 rounded text-sm">Отмена</button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(user)} className="px-3 py-1 bg-blue-500 rounded text-sm">Редактировать</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Link href="/admin" className="block mt-6 text-blue-400 hover:underline">← Админ-панель</Link>
    </div>
  );
}