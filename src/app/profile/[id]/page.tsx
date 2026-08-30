"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ kills: 0, matches: 0, ratio: 0, cost: 0 });
  const [team, setTeam] = useState<any>(null);
  const [badges, setBadges] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Для админа
  const [isAdmin, setIsAdmin] = useState(false);
  const [warnings, setWarnings] = useState<any>({
    activeWarnings: [],
    warningCount: 0,
    history: [],
    activeBan: null,
  });

  useEffect(() => {
    const init = async () => {
      const { data: profiles } = await supabase.from("profiles").select("*").eq("id", id).single();
      const { data: { user } } = await supabase.auth.admin.getUserById(id);

      setProfile({
        nickname: profiles?.nickname || user?.user_metadata?.nickname || "—",
        game_id: user?.user_metadata?.game_id || "—",
        avatar_url: profiles?.avatar_url || "",
      });

      // Статистика
      const { data: statsData } = await supabase
        .from("player_stats")
        .select("kills, matches_played")
        .eq("user_id", id)
        .eq("status", "approved");

      const kills = statsData?.reduce((sum, s) => sum + (s.kills || 0), 0) || 0;
      const matches = statsData?.reduce((sum, s) => sum + (s.matches_played || 0), 0) || 0;
      const ratio = matches > 0 ? +(kills / matches).toFixed(2) : 0;
      const cost = Math.round(kills * 10 + matches * 5);
      setStats({ kills, matches, ratio, cost });

      // Команда игрока
      const { data: memberships } = await supabase
        .from("team_members")
        .select("team_id, role_in_team, teams(type, name)")
        .eq("user_id", id);

      const newBadges: string[] = [];
      if (memberships) {
        for (const m of memberships) {
          const teamType = (m.teams as any)?.type;
          const teamName = (m.teams as any)?.name || "";
          if (teamType === "guild") {
            if (m.role_in_team === "leader") newBadges.push(`Лидер гильдии ${teamName}`);
            else if (m.role_in_team === "senior_deputy") newBadges.push(`Старший зам гильдии ${teamName}`);
            else if (m.role_in_team === "deputy") newBadges.push(`Зам гильдии ${teamName}`);
            else if (m.role_in_team === "main") newBadges.push(`Участник гильдии ${teamName}`);
          } else if (teamType === "team") {
            if (m.role_in_team === "leader") newBadges.push(`Капитан команды ${teamName}`);
            else if (m.role_in_team === "senior_deputy") newBadges.push(`Старший зам команды ${teamName}`);
            else if (m.role_in_team === "deputy") newBadges.push(`Зам команды ${teamName}`);
            else if (m.role_in_team === "main") newBadges.push(`Игрок команды ${teamName}`);
            setTeam({ id: m.team_id, name: teamName, type: teamType });
          }
        }
      }

      // Админ
      const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", id).single();
      if (roleData) newBadges.push(roleData.role === "superadmin" ? "Админ" : "Модератор");

      // Блогер
      const { data: blogger } = await supabase.from("bloggers").select("id").eq("user_id", id).single();
      if (blogger) newBadges.push("Блогер");

      setBadges(newBadges);

      // Проверяем, является ли текущий пользователь админом, и если да, загружаем преды
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        const { data: currentRoleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", currentUser.id)
          .single();
        if (currentRoleData) {
          setIsAdmin(true);
          const res = await fetch(`/api/profile/warnings?userId=${id}`);
          const warnData = await res.json();
          setWarnings(warnData);
        }
      }

      setLoading(false);
    };
    init();
  }, [id]);

  const getBadgeColor = (badge: string) => {
    if (badge.startsWith("Лидер") || badge.startsWith("Капитан")) return "bg-yellow-600";
    if (badge.startsWith("Старший зам")) return "bg-orange-600";
    if (badge.startsWith("Зам")) return "bg-orange-700";
    if (badge.startsWith("Админ")) return "bg-red-600";
    if (badge.startsWith("Модератор")) return "bg-red-700";
    if (badge.startsWith("Блогер")) return "bg-purple-600";
    if (badge.startsWith("Игрок команды")) return "bg-blue-600";
    if (badge.startsWith("Участник гильдии")) return "bg-purple-700";
    return "bg-gray-600";
  };

  const unbanUser = async () => {
    if (!confirm("Разблокировать игрока?")) return;
    const res = await fetch("/api/admin/warnings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: "player", targetId: id }),
    });
    const data = await res.json();
    if (data.success) {
      setWarnings({ ...warnings, activeBan: null });
      alert("Бан снят");
    } else {
      alert("Ошибка: " + (data.error || "неизвестная ошибка"));
    }
  };

  if (loading) return <div className="min-h-screen p-6"><p>Загрузка...</p></div>;
  if (!profile) return <div className="min-h-screen p-6"><p>Игрок не найден.</p></div>;

  return (
    <div className="min-h-screen p-6">
      <Link href="/rating" className="text-blue-400 hover:underline">← К рейтингу</Link>

      <div className="mt-6 bg-gray-800 p-6 rounded">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-20 h-20 rounded-lg bg-gray-700 overflow-hidden flex-shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="Аватар" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl text-gray-400">
                {profile.nickname?.[0]?.toUpperCase() || "?"}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-blue-500">{profile.nickname}</h1>
              {badges.map(badge => (
                <span key={badge} className={`text-xs px-2 py-0.5 rounded ${getBadgeColor(badge)}`}>{badge}</span>
              ))}
            </div>
            <p className="text-gray-400 text-sm mt-1">ID: {profile.game_id}</p>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="bg-gray-700 p-3 rounded text-center">
            <p className="text-gray-400 text-sm">Киллы</p>
            <p className="text-xl font-bold">{stats.kills}</p>
          </div>
          <div className="bg-gray-700 p-3 rounded text-center">
            <p className="text-gray-400 text-sm">Матчи</p>
            <p className="text-xl font-bold">{stats.matches}</p>
          </div>
          <div className="bg-gray-700 p-3 rounded text-center">
            <p className="text-gray-400 text-sm">У/С</p>
            <p className="text-xl font-bold">{stats.ratio}</p>
          </div>
          <div className="bg-gray-700 p-3 rounded text-center">
            <p className="text-gray-400 text-sm">Стоимость</p>
            <p className="text-xl font-bold text-yellow-400">{stats.cost} ₽</p>
          </div>
        </div>

        {team && (
          <div className="mt-4">
            <span className="text-gray-400">Команда: </span>
            <Link href={`/teams/${team.id}`} className="text-blue-400 hover:underline">{team.name}</Link>
            <span className="text-gray-400 text-sm ml-2">({team.type === "guild" ? "Гильдия" : "Команда"})</span>
          </div>
        )}
      </div>

      {/* Блок для админа: предупреждения и бан */}
      {isAdmin && (
        <div className="mt-6 bg-gray-800 p-4 rounded">
          <h2 className="text-xl font-semibold mb-3">Предупреждения и блокировки</h2>
          <p className="text-gray-400">Активных предупреждений: {warnings.warningCount}</p>

          {warnings.activeBan && (
            <div className="bg-red-900 p-3 rounded my-3">
              <p className="font-bold text-red-200">Заблокирован: {warnings.activeBan.reason}</p>
              <p className="text-xs text-red-400">
                С {new Date(warnings.activeBan.created_at).toLocaleString("ru")}
              </p>
              <button
                onClick={unbanUser}
                className="mt-2 px-4 py-2 bg-green-600 rounded text-sm hover:bg-green-700"
              >
                Разблокировать
              </button>
            </div>
          )}

          {warnings.activeWarnings.length > 0 && (
            <div className="space-y-2 mt-3">
              {warnings.activeWarnings.map((w: any) => (
                <div key={w.id} className="bg-gray-700 p-3 rounded">
                  <p>
                    Уровень {w.level}{" "}
                    {w.expires_at ? `(до ${new Date(w.expires_at).toLocaleDateString("ru")})` : "(навсегда)"}
                  </p>
                  <p className="text-gray-400 text-sm">{w.reason}</p>
                  <p className="text-xs text-gray-500">{new Date(w.created_at).toLocaleString("ru")}</p>
                </div>
              ))}
            </div>
          )}

          <details className="mt-4">
            <summary className="text-blue-400 cursor-pointer">История предупреждений</summary>
            <div className="mt-2 space-y-2">
              {warnings.history.map((h: any) => (
                <div key={h.id} className="bg-gray-700 p-2 rounded text-sm">
                  <p>{new Date(h.created_at).toLocaleString("ru")} — Уровень {h.level}</p>
                  <p className="text-gray-400">{h.reason}</p>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}