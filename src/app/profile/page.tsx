"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

interface Team {
  id: string;
  name: string;
  type: string;
  verified: boolean;
}

interface Registration {
  id: string;
  event_id: string;
  status: string;
  event_title: string;
}

export default function ProfilePage() {
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [badges, setBadges] = useState<string[]>([]);
  const [stats, setStats] = useState({ kills: 0, matches: 0, ratio: 0, cost: 0 });
  const [warnings, setWarnings] = useState<any>({
    activeWarnings: [],
    warningCount: 0,
    history: [],
    activeBan: null,
  });

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", user.id)
          .single();
        if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);

        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();
        if (roleData) setIsAdmin(true);

        const { data: teams } = await supabase
          .from("teams")
          .select("id, name, type, verified")
          .eq("leader_id", user.id);
        if (teams) setMyTeams(teams);

        // Статистика игрока
        const { data: statsData } = await supabase
          .from("player_stats")
          .select("kills, matches_played")
          .eq("user_id", user.id)
          .eq("status", "approved");

        const kills = statsData?.reduce((sum: number, s: any) => sum + (s.kills || 0), 0) || 0;
        const matches = statsData?.reduce((sum: number, s: any) => sum + (s.matches_played || 0), 0) || 0;
        const ratio = matches > 0 ? +(kills / matches).toFixed(2) : 0;
        const cost = Math.round(kills * 10 + matches * 5);
        setStats({ kills, matches, ratio, cost });

        // Загрузка предупреждений через API
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (token) {
          const res = await fetch("/api/profile/warnings", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const warnData = await res.json();
          setWarnings(warnData);
        }

        // Записи на мероприятия
        const { data: member } = await supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", user.id)
          .single();

        if (member) {
          const { data: regs } = await supabase
            .from("event_registrations")
            .select("id, event_id, status")
            .eq("team_id", member.team_id);

          if (regs) {
            const enriched = await Promise.all(
              regs.map(async (r) => {
                const { data: ev } = await supabase
                  .from("events")
                  .select("title")
                  .eq("id", r.event_id)
                  .single();
                return { ...r, event_title: ev?.title || "—" };
              })
            );
            setMyRegistrations(enriched);
          }
        }

        // Плашки
        const newBadges: string[] = [];

        const { data: memberships } = await supabase
          .from("team_members")
          .select("team_id, role_in_team, teams(type, name)")
          .eq("user_id", user.id);

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
            }
          }
        }

        if (roleData) {
          newBadges.push(roleData.role === "superadmin" ? "Админ" : "Модератор");
        }

        const { data: blogger } = await supabase
          .from("bloggers")
          .select("id")
          .eq("user_id", user.id)
          .single();
        if (blogger) newBadges.push("Блогер");

        setBadges(newBadges);
      }
      setLoading(false);
    };
    init();
  }, []);

  const uploadAvatar = async () => {
    if (!avatarFile || !user) return;
    setUploading(true);
    const fileName = `user_${user.id}_${Date.now()}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(fileName, avatarFile);
    if (uploadError) { setMessage("Ошибка: " + uploadError.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName);
    await supabase.from("profiles").upsert({ id: user.id, avatar_url: urlData.publicUrl, nickname: user.user_metadata?.nickname || "" });
    setAvatarUrl(urlData.publicUrl);
    setAvatarFile(null);
    setUploading(false);
    setMessage("Аватар обновлён!");
  };

  if (!user) {
    return (
      <div className="min-h-screen p-6">
        <p>Пожалуйста, войдите.</p>
        <Link href="/auth" className="text-blue-400">← Войти</Link>
      </div>
    );
  }

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

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-6 text-blue-500">Мой профиль</h1>

      <div className="bg-gray-800 p-4 rounded mb-6 flex items-center gap-4">
        <div className="w-20 h-20 rounded-lg bg-gray-700 overflow-hidden flex-shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Аватар" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl text-gray-400">
              {user.user_metadata?.nickname?.[0]?.toUpperCase() || "?"}
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-lg font-semibold">{user.user_metadata?.nickname || "—"}</p>
            {badges.map(badge => (
              <span key={badge} className={`text-xs px-2 py-0.5 rounded ${getBadgeColor(badge)}`}>{badge}</span>
            ))}
          </div>
          {isAdmin && <p className="text-gray-400 text-sm">{user.email}</p>}
          <p className="text-gray-400 text-sm">ID: {user.user_metadata?.game_id || "—"}</p>
          <div className="flex gap-2 mt-2">
            <input className="text-sm text-white w-40" type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} />
            {avatarFile && (
              <button onClick={uploadAvatar} disabled={uploading} className="px-3 py-1 bg-blue-500 rounded text-sm hover:bg-blue-600 disabled:opacity-50">
                {uploading ? "..." : "Загрузить"}
              </button>
            )}
          </div>
        </div>
      </div>

      {message && <div className="mb-4 p-3 bg-gray-800 rounded">{message}</div>}

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Мои команды</h2>
        {loading ? <p>Загрузка...</p> : myTeams.length === 0 ? (
          <p className="text-gray-400 mb-4">Вы пока не создали ни одной команды.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {myTeams.map((team) => (
              <Link key={team.id} href={`/teams/${team.id}`} className="bg-gray-800 p-3 rounded flex justify-between items-center hover:bg-gray-700">
                <span>{team.name} ({team.type === "guild" ? "Гильдия" : "Команда"})</span>
                {team.verified ? <span className="text-green-400 text-sm">✓ Верифицирована</span> : <span className="text-yellow-400 text-sm">⏳ На модерации</span>}
              </Link>
            ))}
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <Link href="/stats/add" className="inline-block p-3 bg-green-500 rounded hover:bg-green-600">
            + Добавить статистику
          </Link>
          <Link href="/teams/create" className="inline-block p-3 bg-blue-500 rounded hover:bg-blue-600">+ Создать команду</Link>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Моя статистика</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
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
        <Link href="/stats/add" className="inline-block p-3 bg-blue-500 rounded hover:bg-blue-600">
          Добавить статистику
        </Link>
      </div>

      {/* Предупреждения */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Мои предупреждения ({warnings.warningCount})</h2>
        {warnings.activeBan && (
          <div className="bg-red-900 p-3 rounded mb-4">
            <p className="font-bold text-red-200">Вы заблокированы!</p>
            <p className="text-red-300 text-sm">{warnings.activeBan.reason}</p>
            <p className="text-xs text-red-400">{new Date(warnings.activeBan.created_at).toLocaleString("ru")}</p>
          </div>
        )}
        {warnings.activeWarnings.length === 0 ? (
          <p className="text-gray-400">Нет активных предупреждений.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {warnings.activeWarnings.map((w: any) => (
              <div key={w.id} className="bg-gray-800 p-3 rounded">
                <p>Уровень: {w.level} {w.expires_at ? "(до " + new Date(w.expires_at).toLocaleDateString("ru") + ")" : "(навсегда)"}</p>
                <p className="text-gray-400 text-sm">{w.reason}</p>
              </div>
            ))}
          </div>
        )}
        <details>
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

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Мои записи на мероприятия</h2>
        {myRegistrations.length === 0 ? (
          <p className="text-gray-400">Нет активных записей.</p>
        ) : (
          <div className="space-y-2">
            {myRegistrations.map((reg) => (
              <Link key={reg.id} href={`/tournaments/${reg.event_id}`} className="bg-gray-800 p-3 rounded flex justify-between items-center hover:bg-gray-700">
                <span>{reg.event_title}</span>
                <span className={reg.status === "confirmed" ? "text-green-400" : reg.status === "waiting" ? "text-yellow-400" : "text-red-400"}>
                  {reg.status === "confirmed" ? "✓ В основе" : reg.status === "waiting" ? "⏳ В ожидании" : "✕ Отменена"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Link href="/" className="text-blue-400 hover:underline">← На главную</Link>
    </div>
  );
}