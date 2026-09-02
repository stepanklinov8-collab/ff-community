"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
  leader_nickname?: string;
}

export default function AdminPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  // Для предупреждений команде
  const [showTeamWarning, setShowTeamWarning] = useState(false);
  const [teamWarnLevel, setTeamWarnLevel] = useState(1);
  const [teamWarnReason, setTeamWarnReason] = useState("");
  const [teamWarnExpires, setTeamWarnExpires] = useState<"week" | "forever">("week");

  const fetchTeams = useCallback(async () => {
    const response = await authFetch("/api/admin/teams");
    const payload = await response.json() as { teams?: Team[] };
    setIsAdmin(response.ok);
    if (response.ok) setTeams(payload.teams ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchTeams(); }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchTeams]);

  const verifyTeam = async (teamId: string) => {
    const response = await authFetch("/api/admin/teams", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, verified: true }),
    });

    if (response.ok) {
      setTeams(teams.map(t => t.id === teamId ? { ...t, verified: true } : t));
      setMessage("Команда верифицирована!");
    } else {
      const payload = await response.json();
      setMessage("Ошибка: " + (payload.error ?? "не удалось изменить статус"));
    }
  };

  const unverifyTeam = async (teamId: string) => {
    const response = await authFetch("/api/admin/teams", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, verified: false }),
    });

    if (response.ok) {
      setTeams(teams.map(t => t.id === teamId ? { ...t, verified: false } : t));
      setMessage("Верификация отозвана.");
    } else {
      const payload = await response.json();
      setMessage("Ошибка: " + (payload.error ?? "не удалось изменить статус"));
    }
  };

  const deleteTeam = async (teamId: string) => {
    if (!confirm("Удалить команду навсегда?")) return;
    const response = await authFetch(`/api/admin/teams?teamId=${encodeURIComponent(teamId)}`, { method: "DELETE" });

    if (response.ok) {
      setTeams(teams.filter(t => t.id !== teamId));
      setSelectedTeam(null);
      setMessage("Команда удалена.");
    } else {
      const payload = await response.json();
      setMessage("Ошибка: " + (payload.error ?? "удаление недоступно"));
    }
  };

  // Выдать предупреждение команде
  const giveTeamWarning = async () => {
    if (!selectedTeam) return;
    const expiresAt = teamWarnExpires === "week" ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null;
    const res = await authFetch("/api/admin/warnings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetType: "team",
        targetId: selectedTeam.id,
        level: teamWarnLevel,
        reason: teamWarnReason,
        expiresAt,
        isBan: false,
      }),
    });
    const data = await res.json();
    if (data.success) {
      setMessage("Предупреждение команде выдано");
      setShowTeamWarning(false);
      setTeamWarnReason("");
    } else {
      setMessage("Ошибка: " + (data.error || "неизвестная ошибка"));
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen p-6">
        <h1 className="text-3xl font-bold mb-6 text-red-500">Админ-панель</h1>
        <p className="text-gray-400 mb-4">У вас нет прав администратора.</p>
        <Link href="/" className="inline-flex p-3 bg-gray-700 rounded hover:bg-gray-600">
          Вернуться на главную
        </Link>
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
                <span className="text-gray-400">Лидер (подал заявку):</span>
                <p>
                  {selectedTeam.leader_id ? (
                    <Link href={`/profile/${selectedTeam.leader_id}`} className="text-blue-400 hover:underline">
                      {selectedTeam.leader_nickname || selectedTeam.leader_id}
                    </Link>
                  ) : "—"}
                </p>
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

              <div className="flex gap-2 pt-3 flex-wrap">
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
                  onClick={() => {
                    setShowTeamWarning(true);
                    setTeamWarnReason("");
                    setTeamWarnLevel(1);
                    setTeamWarnExpires("week");
                  }}
                  className="px-4 py-2 bg-orange-600 rounded hover:bg-orange-700"
                >
                  Предупредить
                </button>
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

      {/* Модалка предупреждения команде */}
      {showTeamWarning && selectedTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded max-w-md w-full">
            <button onClick={() => setShowTeamWarning(false)} className="float-right text-gray-400">✕</button>
            <h2 className="text-xl font-bold mb-4">Предупреждение для {selectedTeam.name}</h2>
            <label className="block text-sm mb-1">Уровень</label>
            <select className="w-full p-2 text-black rounded mb-2" value={teamWarnLevel} onChange={(e) => setTeamWarnLevel(Number(e.target.value))}>
              <option value={1}>1 - на конкретное мероприятие</option>
              <option value={2}>2 - на все мероприятия</option>
            </select>
            <label className="block text-sm mb-1">Причина</label>
            <input className="w-full p-2 text-black rounded mb-2" value={teamWarnReason} onChange={(e) => setTeamWarnReason(e.target.value)} placeholder="Причина" />
            <label className="block text-sm mb-1">Срок</label>
            <select className="w-full p-2 text-black rounded mb-4" value={teamWarnExpires} onChange={(e) => setTeamWarnExpires(e.target.value as "week" | "forever")}>
              <option value="week">Неделя</option>
              <option value="forever">Навсегда</option>
            </select>
            <button onClick={giveTeamWarning} className="w-full p-2 bg-orange-600 rounded">Выдать пред</button>
          </div>
        </div>
      )}

      {/* Остальные секции админки */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Мероприятия</h2>
        <div className="flex gap-2 flex-wrap">
          <Link href="/admin/events/create" className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600 inline-block">+ Новое мероприятие</Link>
          <Link href="/admin/events/manage" className="px-4 py-2 bg-yellow-600 rounded hover:bg-yellow-700 inline-block">Управление мероприятиями</Link>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Предложенные мероприятия</h2>
        <Link href="/admin/events/proposals" className="px-4 py-2 bg-green-600 rounded hover:bg-green-700 inline-block">Просмотр предложений</Link>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Пользователи</h2>
        <Link href="/admin/users" className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-700 inline-block">Управление пользователями</Link>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Модерация статистики</h2>
        <Link href="/admin/stats" className="px-4 py-2 bg-orange-600 rounded hover:bg-orange-700 inline-block">Проверить статистику</Link>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Контакты</h2>
        <Link href="/admin/contacts" className="px-4 py-2 bg-teal-600 rounded hover:bg-teal-700 inline-block">Управление контактами</Link>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Блогеры</h2>
        <Link href="/admin/bloggers" className="px-4 py-2 bg-pink-600 rounded hover:bg-pink-700 inline-block">Управление блогерами</Link>
      </div>
    </div>
  );
}
