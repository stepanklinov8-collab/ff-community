"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
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
}

export default function AdminPage() {
  const supabase = createClient();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (data) setIsAdmin(true);
    };

    const fetchTeams = async () => {
      const { data } = await supabase
        .from("teams")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setTeams(data);
      setLoading(false);
    };

    checkAdmin();
    fetchTeams();
  }, []);

  const verifyTeam = async (teamId: string) => {
    const { error } = await supabase
      .from("teams")
      .update({ verified: true })
      .eq("id", teamId);

    if (!error) {
      setTeams(teams.map(t => t.id === teamId ? { ...t, verified: true } : t));
      setMessage("Команда верифицирована!");
    } else {
      setMessage("Ошибка: " + error.message);
    }
  };

  const unverifyTeam = async (teamId: string) => {
    const { error } = await supabase
      .from("teams")
      .update({ verified: false })
      .eq("id", teamId);

    if (!error) {
      setTeams(teams.map(t => t.id === teamId ? { ...t, verified: false } : t));
      setMessage("Верификация отозвана.");
    } else {
      setMessage("Ошибка: " + error.message);
    }
  };

  const deleteTeam = async (teamId: string) => {
    if (!confirm("Удалить команду навсегда?")) return;
    const { error } = await supabase
      .from("teams")
      .delete()
      .eq("id", teamId);

    if (!error) {
      setTeams(teams.filter(t => t.id !== teamId));
      setSelectedTeam(null);
      setMessage("Команда удалена.");
    } else {
      setMessage("Ошибка: " + error.message);
    }
  };

  const makeSuperadmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("user_roles")
      .upsert({ user_id: user.id, role: "superadmin" });

    if (!error) {
      setIsAdmin(true);
      setMessage("Вы стали суперадмином!");
    } else {
      setMessage("Ошибка: " + error.message);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen p-6">
        <h1 className="text-3xl font-bold mb-6 text-red-500">Админ-панель</h1>
        <p className="text-gray-400 mb-4">У вас нет прав администратора.</p>
        <button
          onClick={makeSuperadmin}
          className="p-3 bg-red-600 rounded hover:bg-red-700"
        >
          Стать суперадмином (первый запуск)
        </button>
        {message && <p className="mt-4 p-3 bg-gray-800 rounded">{message}</p>}
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-6 text-red-500">Админ-панель</h1>

      {message && (
        <div className="mb-4 p-3 bg-gray-800 rounded">{message}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Список команд */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Команды ({teams.length})</h2>

          {loading ? (
            <p>Загрузка...</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {teams.map((team) => (
                <div
                  key={team.id}
                  onClick={() => setSelectedTeam(team)}
                  className={"bg-gray-800 p-3 rounded cursor-pointer hover:bg-gray-700 " + (selectedTeam?.id === team.id ? "ring-2 ring-blue-500" : "")}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">{team.name}</span>
                    <span className={team.verified ? "text-green-400 text-sm" : "text-yellow-400 text-sm"}>
                      {team.verified ? "✓" : "⏳"}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {team.type === "guild" ? "Гильдия" : "Команда"} · {new Date(team.created_at).toLocaleDateString("ru")}
                  </span>
                </div>
              ))}
              {teams.length === 0 && (
                <p className="text-gray-400">Нет команд.</p>
              )}
            </div>
          )}
        </div>

        {/* Детали команды */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Информация о команде</h2>

          {selectedTeam ? (
            <div className="bg-gray-800 p-4 rounded space-y-3">
              <div>
                <span className="text-gray-400">Название:</span>
                <p className="text-lg font-semibold">{selectedTeam.name}</p>
              </div>
              <div>
                <span className="text-gray-400">Тип:</span>
                <p>{selectedTeam.type === "guild" ? "Гильдия" : "Команда"}</p>
              </div>
              <div>
                <span className="text-gray-400">Описание:</span>
                <p>{selectedTeam.description || "Нет описания"}</p>
              </div>
              <div>
                <span className="text-gray-400">Соцсеть:</span>
                <p>{selectedTeam.social_link || "Не указана"}</p>
              </div>
              <div>
                <span className="text-gray-400">Статус:</span>
                <p className={selectedTeam.verified ? "text-green-400" : "text-yellow-400"}>
                  {selectedTeam.verified ? "Верифицирована" : "Не верифицирована"}
                </p>
              </div>
              <div>
                <span className="text-gray-400">Создана:</span>
                <p>{new Date(selectedTeam.created_at).toLocaleString("ru")}</p>
              </div>

              <div className="flex gap-2 pt-3">
                {!selectedTeam.verified ? (
                  <button
                    onClick={() => verifyTeam(selectedTeam.id)}
                    className="px-4 py-2 bg-green-600 rounded hover:bg-green-700"
                  >
                    Верифицировать
                  </button>
                ) : (
                  <button
                    onClick={() => unverifyTeam(selectedTeam.id)}
                    className="px-4 py-2 bg-yellow-600 rounded hover:bg-yellow-700"
                  >
                    Отозвать верификацию
                  </button>
                )}
                <button
                  onClick={() => deleteTeam(selectedTeam.id)}
                  className="px-4 py-2 bg-red-600 rounded hover:bg-red-700"
                >
                  Удалить
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-400">Выберите команду слева для просмотра.</p>
          )}
        </div>
      </div>

      {/* Мероприятия */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Мероприятия</h2>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/admin/events/create"
            className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600 inline-block"
          >
            + Новое мероприятие
          </Link>
          <Link
            href="/admin/events/manage"
            className="px-4 py-2 bg-yellow-600 rounded hover:bg-yellow-700 inline-block"
          >
            Управление мероприятиями
          </Link>
        </div>
      </div>

      {/* Предложенные мероприятия */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Предложенные мероприятия</h2>
        <Link
          href="/admin/events/proposals"
          className="px-4 py-2 bg-green-600 rounded hover:bg-green-700 inline-block"
        >
          Просмотр предложений
        </Link>
      </div>

      {/* Пользователи */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Пользователи</h2>
        <Link
          href="/admin/users"
          className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-700 inline-block"
        >
          Управление пользователями
        </Link>
      </div>

      {/* Модерация статистики */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Модерация статистики</h2>
        <Link
          href="/admin/stats"
          className="px-4 py-2 bg-orange-600 rounded hover:bg-orange-700 inline-block"
        >
          Проверить статистику
        </Link>
      </div>

      {/* Контакты */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Контакты</h2>
        <Link
          href="/admin/contacts"
          className="px-4 py-2 bg-teal-600 rounded hover:bg-teal-700 inline-block"
        >
          Управление контактами
        </Link>
      </div>

      {/* Блогеры */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Блогеры</h2>
        <Link
          href="/admin/bloggers"
          className="px-4 py-2 bg-pink-600 rounded hover:bg-pink-700 inline-block"
        >
          Управление блогерами
        </Link>
      </div>
    </div>
  );
}