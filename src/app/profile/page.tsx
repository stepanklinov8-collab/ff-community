"use client";

import { formatCoins } from "@/lib/economy/currency";
import Image from "next/image";
import Link from "next/link";
import {getPublicStatistics, type PublicStatistics} from "@/lib/competition/public-statistics";
import CompetitionStatistics from "@/components/CompetitionStatistics";
import PublicWarningHistory from "@/components/PublicWarningHistory";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { authFetch } from "@/utils/api/auth-fetch";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";
import { playerRoles, type PlayerRoleId } from "@/lib/profile/roles";
import { normalizeContactSocialUrl } from "@/lib/profile/contact-social";
import ProfileContactButton from "@/components/ProfileContactButton";

interface Team {
  id: string;
  name: string;
  type: "team" | "guild";
  verified: boolean;
  role: string;
}

interface MembershipTeam {
  id: string;
  name: string;
  type: "team" | "guild";
  verified: boolean;
}

interface MembershipRow {
  role_in_team: string;
  teams: MembershipTeam | MembershipTeam[] | null;
}

interface RegistrationRow {
  id: string;
  event_id: string;
  status: string;
}

interface Registration extends RegistrationRow {
  event_title: string;
}

interface WarningRow {
  id: string;
  level: number;
  reason: string;
  created_at: string;
  expires_at: string | null;
}

interface WarningsPayload {
  activeWarnings: WarningRow[];
  warningCount: number;
  history: WarningRow[];
  activeBan: { reason: string; created_at: string } | null;
}

interface EditableProfile {
  nickname: string;
  gameId: string;
  bio: string;
  phone: string;
  contactSocialUrl: string;
  playerRoles: PlayerRoleId[];
  locale: "ru" | "kk" | "ky";
}

const allowedAvatarTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function normalizeTeam(value: MembershipRow["teams"]) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function roleLabel(role: string, type: Team["type"]) {
  const suffix = type === "guild" ? "гильдии" : "команды";
  const labels: Record<string, string> = {
    leader: type === "guild" ? "Лидер" : "Капитан",
    senior_deputy: "Старший заместитель",
    deputy: "Заместитель",
    main: type === "guild" ? "Участник" : "Основной состав",
    substitute: type === "guild" ? "Участник" : "Запасной",
  };
  return `${labels[role] ?? "Игрок"} ${suffix}`;
}

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const { locale, setLocale } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [statistics, setStatistics] = useState<PublicStatistics>();
  const [savedContactSocialUrl, setSavedContactSocialUrl] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [needsContact, setNeedsContact] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<EditableProfile>({ nickname: "", gameId: "", bio: "", phone: "", contactSocialUrl: "", playerRoles: [], locale: "ru" });
  const [badges, setBadges] = useState<string[]>([]);
  const [stats, setStats] = useState({ kills: 0, matches: 0, ratio: 0, cost: 0 });
  const [profileMeta, setProfileMeta] = useState<{level:number;reputation:number;reputationEvents:number;rating:number|null;balance:number}>({ level: 1, reputation: 50, reputationEvents: 0, rating: null, balance: 0 });
  const [warnings, setWarnings] = useState<WarningsPayload>({
    activeWarnings: [], warningCount: 0, history: [], activeBan: null,
  });

  useEffect(() => {
    let active = true;
    const init = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!active) return;
      const currentUser = authData.user;
      setUser(currentUser);

      if (!currentUser) {
        setLoading(false);
        return;
      }

      const profileResponse = await authFetch("/api/profile");
      const profilePayload = await profileResponse.json();
      if (!profileResponse.ok || !profilePayload.profile) throw new Error(profilePayload.error || "Не удалось загрузить профиль. Повторите попытку.");
      if (!active) return;
      const profile = profilePayload.profile;
      setProfileForm({ nickname: profile.nickname, gameId: profile.gameId, bio: profile.bio, phone: profile.phone,
        contactSocialUrl: profile.contactSocialUrl, playerRoles: profile.playerRoles ?? [], locale: profile.locale });
      setProfileLoaded(true);
      setSavedContactSocialUrl(profile.contactSocialUrl);
      const missingContact = !normalizeContactSocialUrl(profile.contactSocialUrl ?? "");
      setNeedsContact(missingContact);
      if (missingContact) setEditingProfile(true);
      setLocale(profile.locale, false);
      setProfileMeta({ level: profile.level, reputation: profile.reputation, reputationEvents: profile.reputationEvents, rating: profile.rating, balance: profile.balance });
      if (profile.avatarUrl) setAvatarUrl(profile.avatarUrl);

      const [profileResult, roleResult, statsResult, membershipsResult, bloggerResult] = await Promise.all([
        supabase.from("profiles").select("avatar_url").eq("id", currentUser.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", currentUser.id).maybeSingle(),
        getPublicStatistics(currentUser.id).catch(() => null),
        supabase.from("team_members").select("role_in_team, teams(id, name, type, verified)").eq("user_id", currentUser.id),
        supabase.from("profile_badges").select("badge").eq("user_id", currentUser.id).eq("badge", "blogger").maybeSingle(),
      ]);
      if (!active) return;

      if (profileResult.data?.avatar_url) setAvatarUrl(profileResult.data.avatar_url);
      const mainStats = statsResult?.summaries.find(row => row.mode === "main");
      setStatistics(statsResult ?? undefined);
      const kills = mainStats?.kills ?? 0, matches = mainStats?.games ?? 0;
      setStats({ kills, matches, ratio: matches > 0 ? Number((kills / matches).toFixed(2)) : 0, cost: Number(mainStats?.cost ?? 0) });

      const memberships = (membershipsResult.data ?? []) as unknown as MembershipRow[];
      const currentTeams = memberships.flatMap((membership) => {
        const team = normalizeTeam(membership.teams);
        return team ? [{ ...team, role: membership.role_in_team }] : [];
      });
      setTeams(currentTeams);

      const nextBadges = currentTeams.map((team) => `${roleLabel(team.role, team.type)} ${team.name}`);
      if (roleResult.data?.role) nextBadges.push(roleResult.data.role === "superadmin" ? "Владелец" : roleResult.data.role === "admin" ? "Администратор" : "Модератор");
      if (bloggerResult.data) nextBadges.push("Блогер");
      setBadges(nextBadges);

      const teamIds = currentTeams.filter((team) => team.type === "team").map((team) => team.id);
      if (teamIds.length > 0) {
        const { data: registrationRows } = await supabase
          .from("event_registrations")
          .select("id, event_id, status")
          .in("team_id", teamIds)
          .neq("status", "cancelled");
        const rows = (registrationRows ?? []) as RegistrationRow[];
        const eventIds = [...new Set(rows.map((row) => row.event_id))];
        const { data: eventRows } = eventIds.length
          ? await supabase.from("events").select("id, title").in("id", eventIds)
          : { data: [] as { id: string; title: string }[] };
        const titleById = new Map((eventRows ?? []).map((event) => [event.id, event.title]));
        setRegistrations(rows.map((row) => ({ ...row, event_title: titleById.get(row.event_id) ?? "Мероприятие" })));
      }

      try {
        const response = await authFetch("/api/profile/warnings");
        if (response.ok) setWarnings((await response.json()) as WarningsPayload);
      } catch {
        // Профиль остаётся доступен, если блок предупреждений временно недоступен.
      }
      setLoading(false);
    };
    void init().catch((error: unknown) => {
      if (active) setMessage(error instanceof Error ? error.message : "Не удалось загрузить профиль. Повторите попытку.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [setLocale, supabase, loadAttempt]);

  const saveProfile = async () => {
    if (!profileLoaded || savingProfile) return;
    if (!normalizeContactSocialUrl(profileForm.contactSocialUrl)) {
      setMessage("Укажите ссылку на Telegram, VK, MAX или Instagram для связи.");
      return;
    }
    setSavingProfile(true);
    setMessage("");
    try {
      const response = await authFetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });
      const payload = await response.json();
      if (!response.ok || !payload.profile) throw new Error(payload.error || "Сервер не подтвердил сохранение профиля. Повторите попытку.");
      const saved = payload.profile as EditableProfile;
      setProfileForm(saved);
      setSavedContactSocialUrl(saved.contactSocialUrl);
      setUser((current) => current ? {
        ...current,
        user_metadata: { ...current.user_metadata, nickname: saved.nickname, game_id: saved.gameId, locale: saved.locale },
      } : current);
      setLocale(saved.locale, false);
      window.dispatchEvent(new CustomEvent("omcite-profile-updated", { detail: { nickname: saved.nickname } }));
      setNeedsContact(false);
      setEditingProfile(false);
      setMessage("Профиль сохранён.");
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "Не удалось сохранить профиль");
    } finally {
      setSavingProfile(false);
    }
  };

  const uploadAvatar = async () => {
    if (!avatarFile || !user) return;
    if (!allowedAvatarTypes.has(avatarFile.type) || avatarFile.size > 5 * 1024 * 1024) {
      setMessage("Аватар должен быть JPEG, PNG, WebP или GIF размером до 5 МБ.");
      return;
    }

    setUploading(true);
    setMessage("");
    try {
      const formData = new FormData();
      formData.set("avatar", avatarFile);
      const response = await authFetch("/api/profile/avatar", { method: "POST", body: formData });
      const payload = await response.json() as { avatarUrl?: string; error?: string };
      if (!response.ok || !payload.avatarUrl) throw new Error(payload.error || "Не удалось загрузить аватар");
      setAvatarUrl(payload.avatarUrl);
      setAvatarFile(null);
      setMessage("Аватар обновлён.");
    } catch (uploadError) {
      setMessage(uploadError instanceof Error ? uploadError.message : "Не удалось загрузить аватар");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="page-shell"><p className="text-slate-400">Загрузка профиля…</p></div>;

  if (!user) {
    return (
      <div className="page-shell">
        <div className="panel mx-auto max-w-xl p-8 text-center">
          <h1 className="mb-3 text-2xl font-bold">Войдите в аккаунт</h1>
          <p className="mb-6 text-slate-400">Профиль, команды и заявки доступны после авторизации.</p>
          <Link href="/auth" className="btn-primary">Войти или зарегистрироваться</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell space-y-6">
      <section className="panel overflow-hidden">
        <div className="h-24 bg-[radial-gradient(circle_at_30%_0%,rgba(0,174,255,.35),transparent_55%),linear-gradient(120deg,#08111f,#03070d)]" />
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:p-7">
          <div className="-mt-16 h-28 w-28 shrink-0 overflow-hidden rounded-2xl border-4 border-[#07101b] bg-slate-800 shadow-xl">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="Аватар" width={112} height={112} unoptimized className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-4xl font-black text-cyan-300">{user.user_metadata?.nickname?.[0]?.toUpperCase() || "?"}</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black sm:text-3xl">{profileForm.nickname || user.user_metadata?.nickname || "Игрок"}</h1>
              {badges.map((badge) => <span key={badge} className="badge badge-blue">{badge}</span>)}
            </div>
            <p className="mt-1 text-sm text-slate-400">Игровой ID: {profileForm.gameId || user.user_metadata?.game_id || "не указан"}</p>
            <ProfileContactButton url={savedContactSocialUrl} />
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <button type="button" disabled={!profileLoaded || savingProfile} onClick={() => setEditingProfile((current) => !current)} className="btn-secondary text-sm disabled:opacity-50">{editingProfile ? "Закрыть редактор" : "Редактировать профиль"}</button>
            <label className="btn-secondary cursor-pointer text-sm">
              Выбрать аватар
              <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setAvatarFile(event.target.files?.[0] || null)} />
            </label>
            <p className="max-w-xs text-right text-xs text-slate-500">JPEG, PNG или WebP, до 5 МБ</p>
            {avatarFile && <button type="button" onClick={uploadAvatar} disabled={uploading} className="btn-secondary text-sm">{uploading ? "Загрузка…" : "Обновить аватар"}</button>}
          </div>
        </div>
      </section>

      {message && <div className="panel p-4 text-sm text-cyan-100" role="status">{message}</div>}
      {!profileLoaded && <button type="button" className="btn-secondary" onClick={() => { setLoading(true); setMessage(""); setLoadAttempt(value => value + 1); }}>Повторить загрузку профиля</button>}

      {needsContact && <div className="panel border border-cyan-400/45 bg-cyan-950/35 p-4 text-sm text-cyan-100" role="status">
        Укажите в профиле ссылку на Telegram, VK, MAX или Instagram, чтобы другие зарегистрированные пользователи могли связаться с вами.
        {!editingProfile && <button type="button" className="ml-3 font-bold text-cyan-300 underline" onClick={() => setEditingProfile(true)}>Заполнить</button>}
      </div>}

      {editingProfile && profileLoaded && (
        <form onSubmit={event => { event.preventDefault(); void saveProfile(); }}>
        <fieldset disabled={savingProfile} className="panel grid min-w-0 gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <div className="sm:col-span-2"><p className="eyebrow">Настройки аккаунта</p><h2 className="section-title mt-2">Редактирование профиля</h2></div>
          <label className="field-label">Игровой ник<input className="field mt-2" required maxLength={20} value={profileForm.nickname} onChange={(event) => setProfileForm((current) => ({ ...current, nickname: event.target.value }))} /></label>
          <label className="field-label">Free Fire ID<input className="field mt-2" required inputMode="numeric" pattern="[0-9]+" value={profileForm.gameId} onChange={(event) => setProfileForm((current) => ({ ...current, gameId: event.target.value }))} /></label>
          <label className="field-label">Телефон или контакт<input className="field mt-2" maxLength={32} placeholder="Необязательно" value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} /></label>
          <label className="field-label">Ссылка для связи · Telegram, VK, MAX или Instagram<input className="field mt-2" type="url" maxLength={300} required placeholder="https://t.me/username" value={profileForm.contactSocialUrl} onChange={(event) => setProfileForm((current) => ({ ...current, contactSocialUrl: event.target.value }))} /><span className="mt-1 block text-xs text-slate-500">Обязательно. Видна зарегистрированным пользователям. TikTok и YouTube не принимаются.</span></label>
          <label className="field-label">Язык<select className="field mt-2" value={profileForm.locale} onChange={(event) => setProfileForm((current) => ({ ...current, locale: event.target.value as EditableProfile["locale"] }))}><option value="ru">Русский</option><option value="kk">Қазақша</option><option value="ky">Кыргызча</option></select></label>
          <fieldset className="field-label sm:col-span-2"><legend>Игровые роли</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{playerRoles.map(role => <label key={role.id} className="flex items-center gap-2 rounded border border-white/10 p-2 text-sm"><input type="checkbox" checked={profileForm.playerRoles.includes(role.id)} onChange={event => setProfileForm(current => ({ ...current, playerRoles: event.target.checked ? [...current.playerRoles, role.id] : current.playerRoles.filter(item => item !== role.id) }))} />{role.label}</label>)}</div></fieldset>
          <label className="field-label sm:col-span-2">О себе<textarea className="field mt-2 min-h-28 resize-y" maxLength={500} value={profileForm.bio} onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))} /></label>
          <div className="sm:col-span-2"><button type="submit" disabled={savingProfile} className="btn-primary disabled:opacity-50">{savingProfile ? "Сохраняем…" : "Сохранить изменения"}</button></div>
        </fieldset>
        </form>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[["Уровень", profileMeta.level], ["Рейтинг", profileMeta.rating === null ? "—" : profileMeta.rating.toFixed(0)], ["Репутация", profileMeta.reputationEvents < 3 ? "Новый" : profileMeta.reputation.toFixed(0)], ["Стоимость", formatCoins(stats.cost, locale)], ["Баланс", formatCoins(profileMeta.balance, locale)], ["Киллы", stats.kills], ["Матчи", stats.matches], ["У/С", stats.ratio]].map(([label, value]) => (
          <div key={label} className="stat-card"><p className="text-xs uppercase tracking-[.18em] text-slate-500">{label}</p><p className="mt-2 text-3xl font-black text-white">{value}</p></div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="panel p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3"><h2 className="section-title">Команда и гильдия</h2>{teams.length < 2 && <Link href="/teams/create" className="btn-secondary text-sm">Создать</Link>}</div>
          {teams.length === 0 ? <p className="text-slate-400">Вы пока не состоите в команде или гильдии.</p> : (
            <div className="space-y-3">{teams.map((team) => (
              <Link key={team.id} href={`/teams/${team.id}`} className="card-link flex items-center justify-between gap-3 p-4">
                <div><p className="font-bold">{team.name}</p><p className="text-xs text-slate-400">{roleLabel(team.role, team.type)}</p></div>
                <span className={team.verified ? "badge badge-green" : "badge badge-yellow"}>{team.verified ? "Проверена" : "На проверке"}</span>
              </Link>
            ))}</div>
          )}
        </div>

        <div className="panel p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3"><h2 className="section-title">Мои мероприятия</h2><Link href="/tournaments" className="btn-secondary text-sm">Найти турнир</Link></div>
          {registrations.length === 0 ? <p className="text-slate-400">Активных заявок пока нет.</p> : (
            <div className="space-y-3">{registrations.map((registration) => (
              <Link key={registration.id} href={`/tournaments/${registration.event_id}`} className="card-link flex items-center justify-between gap-3 p-4">
                <span className="font-semibold">{registration.event_title}</span>
                <span className={registration.status === "confirmed" ? "badge badge-green" : "badge badge-yellow"}>{registration.status === "confirmed" ? "В основе" : "В резерве"}</span>
              </Link>
            ))}</div>
          )}
        </div>
      </section>

      <section className="panel p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="section-title">Статистика и модерация</h2><div className="flex gap-2"><Link href="/profile/stats" className="btn-secondary text-sm">История</Link><Link href="/tournaments" className="btn-primary text-sm">Внести результат</Link></div></div>
        <p className="text-sm text-slate-400">Результат вносится со страницы завершившейся сессии — так статистика всегда связана с конкретным мероприятием и составом.</p>
      </section>

      <div className="flex flex-wrap gap-3"><Link href="/organizer" className="btn-primary">Кабинет организатора</Link><Link href="/appeals" className="btn-secondary">Обжалования</Link></div>
      <CompetitionStatistics type="player" id={user.id} initialData={statistics}/>
      <PublicWarningHistory type="player" id={user.id}/>
      <section className="panel p-5 sm:p-6">
        <h2 className="section-title mb-4">Предупреждения <span className="text-slate-500">({warnings.warningCount})</span></h2>
        {warnings.activeBan && <div className="mb-4 rounded-xl border border-red-500/40 bg-red-950/40 p-4"><p className="font-bold text-red-200">Аккаунт заблокирован</p><p className="mt-1 text-sm text-red-300">{warnings.activeBan.reason}</p></div>}
        {warnings.activeWarnings.length === 0 ? <p className="text-slate-400">Активных предупреждений нет.</p> : (
          <div className="mb-4 space-y-2">{warnings.activeWarnings.map((warning) => <div key={warning.id} className="rounded-xl border border-amber-400/20 bg-amber-950/20 p-3"><p className="font-semibold text-amber-100">Уровень {warning.level}</p><p className="text-sm text-slate-400">{warning.reason}</p></div>)}</div>
        )}
        <details className="text-sm"><summary className="cursor-pointer text-cyan-300">Показать историю</summary><div className="mt-3 space-y-2">{warnings.history.length === 0 ? <p className="text-slate-500">История пуста.</p> : warnings.history.map((warning) => <div key={warning.id} className="rounded-lg bg-white/[.03] p-3"><p>{new Date(warning.created_at).toLocaleString("ru-RU")} · уровень {warning.level}</p><p className="text-slate-400">{warning.reason}</p></div>)}</div></details>
      </section>
    </div>
  );
}
