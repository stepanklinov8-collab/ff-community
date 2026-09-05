"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Check, Clock3, MessageCircle, Send, ShieldCheck, Swords, UsersRound, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "@/utils/api/auth-fetch";
import { createClient } from "@/utils/supabase/client";

interface Organization {
  id: string;
  name: string;
  type: "team" | "guild";
  avatar_url: string | null;
}

interface Member {
  team_id: string;
  user_id: string;
  role_in_team: string;
  position: string;
  profile: { id: string; nickname: string; game_id: string | null; avatar_url: string | null };
}

interface ManagedOrganization extends Organization { members: Member[] }

interface ClanWar {
  id: string;
  title: string;
  description: string | null;
  rules: string | null;
  format: 4 | 6;
  challenge_kind: "open" | "direct";
  status: "open" | "pending" | "agreed" | "completed" | "cancelled";
  scheduled_at: string | null;
  completed_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  creator_team: Organization;
  opponent_team: Organization | null;
}

interface ClanWarResponse {
  id: string;
  team_id: string;
  message: string | null;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
  created_at: string;
  team: Organization;
}

interface Roster {
  id: string;
  team_id: string;
  updated_at: string;
  team: Organization;
  players: { id: string; nickname: string; game_id: string | null; avatar_url: string | null }[];
}

interface Comment {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: { id: string; nickname: string; avatar_url: string | null };
}

interface DetailsPayload {
  clanWar: ClanWar;
  responses: ClanWarResponse[];
  rosters: Roster[];
  comments: Comment[];
  managedOrganizations: ManagedOrganization[];
  permissions: {
    canManageCreator: boolean;
    canManageOpponent: boolean;
    canRespond: boolean;
    canComment: boolean;
    canCancel: boolean;
    canComplete: boolean;
  };
}

const statusLabels: Record<ClanWar["status"], string> = {
  open: "Ищет соперника",
  pending: "Ожидает ответа",
  agreed: "Согласовано",
  completed: "Завершено",
  cancelled: "Отменено",
};

const responseLabels: Record<ClanWarResponse["status"], string> = {
  pending: "Ожидает решения",
  accepted: "Принят",
  rejected: "Отклонён",
  withdrawn: "Отозван",
};

export default function ClanWarDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [details, setDetails] = useState<DetailsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [responseTeamId, setResponseTeamId] = useState("");
  const [responseMessage, setResponseMessage] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [rosterSelections, setRosterSelections] = useState<Record<string, string[]>>({});

  const loadDetails = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    setUser(data.user);
    const response = data.user ? await authFetch(`/api/clan-wars/${id}`) : await fetch(`/api/clan-wars/${id}`);
    const payload = await response.json() as DetailsPayload & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Не удалось загрузить КВ");
    setDetails(payload);
    setRosterSelections(Object.fromEntries(payload.managedOrganizations.map((organization) => [
      organization.id,
      payload.rosters.find((roster) => roster.team_id === organization.id)?.players.map((player) => player.id) ?? [],
    ])));
  }, [id, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDetails()
        .catch((error) => setMessage(error instanceof Error ? error.message : "Не удалось загрузить КВ"))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDetails]);

  const eligibleResponseOrganizations = useMemo(() => {
    if (!details) return [];
    return details.managedOrganizations.filter((organization) =>
      organization.type === details.clanWar.creator_team.type &&
      organization.id !== details.clanWar.creator_team.id &&
      !details.responses.some((response) => response.team_id === organization.id && ["pending", "accepted"].includes(response.status)),
    );
  }, [details]);

  const effectiveResponseTeamId = responseTeamId || eligibleResponseOrganizations[0]?.id || "";

  async function runAction(body: Record<string, unknown>, successMessage: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await authFetch(`/api/clan-wars/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Действие не выполнено");
      setMessage(successMessage);
      await loadDetails();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Действие не выполнено");
    } finally {
      setBusy(false);
    }
  }

  async function sendResponse() {
    if (!effectiveResponseTeamId) return;
    setBusy(true);
    try {
      const response = await authFetch(`/api/clan-wars/${id}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: effectiveResponseTeamId, message: responseMessage }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Не удалось отправить отклик");
      setResponseMessage("");
      setMessage("Отклик отправлен. Теперь можно обсудить условия ниже.");
      await loadDetails();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось отправить отклик");
    } finally {
      setBusy(false);
    }
  }

  async function sendComment() {
    if (!commentBody.trim()) return;
    setBusy(true);
    try {
      const response = await authFetch(`/api/clan-wars/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentBody.trim() }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Не удалось отправить комментарий");
      setCommentBody("");
      await loadDetails();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось отправить комментарий");
    } finally {
      setBusy(false);
    }
  }

  function toggleRosterPlayer(teamId: string, playerId: string) {
    if (!details) return;
    setRosterSelections((current) => {
      const selected = current[teamId] ?? [];
      if (selected.includes(playerId)) return { ...current, [teamId]: selected.filter((id) => id !== playerId) };
      if (selected.length >= details.clanWar.format) return current;
      return { ...current, [teamId]: [...selected, playerId] };
    });
  }

  if (loading) return <div className="page-shell"><div className="panel h-96 animate-pulse bg-white/[.03]" /></div>;
  if (!details) return <div className="page-shell"><div className="panel p-6 text-red-200">{message || "КВ не найдено"}</div></div>;

  const { clanWar, permissions } = details;
  const participantIds = [clanWar.creator_team.id, clanWar.opponent_team?.id].filter(Boolean);
  const editableRosterOrganizations = details.managedOrganizations.filter((organization) =>
    participantIds.includes(organization.id) || details.responses.some((response) => response.team_id === organization.id && ["pending", "accepted"].includes(response.status)),
  );

  return (
    <div className="page-shell max-w-6xl">
      <Link href="/clan-wars" className="text-cyan-300 hover:underline">← Ко всем КВ</Link>

      <section className="panel relative mt-4 overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,.14),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(0,174,255,.13),transparent_40%)]" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><span className="badge badge-blue">{statusLabels[clanWar.status]}</span><h1 className="mt-3 text-3xl font-black sm:text-5xl">{clanWar.title}</h1><p className="mt-2 text-sm text-slate-500">Создано {new Date(clanWar.created_at).toLocaleString("ru-RU")}</p></div>
          <span className="rounded-2xl border border-cyan-400/25 bg-cyan-950/40 px-5 py-3 text-2xl font-black text-cyan-100">{clanWar.format} × {clanWar.format}</span>
        </div>

        <div className="mt-7 grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/40 p-5">
          <OrganizationBlock organization={clanWar.creator_team} />
          <Swords className="text-red-300" size={28} />
          {clanWar.opponent_team ? <OrganizationBlock organization={clanWar.opponent_team} align="right" /> : <div className="text-right"><strong className="text-lg text-emerald-300">Соперник не выбран</strong><p className="text-sm text-slate-500">Открытый поиск</p></div>}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[.025] p-4"><p className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500"><Clock3 size={15} /> Время</p><p className="mt-2 font-semibold">{clanWar.scheduled_at ? new Date(clanWar.scheduled_at).toLocaleString("ru-RU") : "Согласовывается в комментариях"}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/[.025] p-4"><p className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500"><UsersRound size={15} /> Состав</p><p className="mt-2 font-semibold">По {clanWar.format} игроков с каждой стороны</p></div>
        </div>
        {clanWar.description && <div className="mt-6"><h2 className="font-bold">Описание</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{clanWar.description}</p></div>}
        {clanWar.rules && <div className="mt-6"><h2 className="font-bold">Правила</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{clanWar.rules}</p></div>}
        {clanWar.status === "cancelled" && <p className="mt-6 rounded-xl border border-red-500/30 bg-red-950/25 p-4 text-red-200">Причина отмены: {clanWar.cancellation_reason || "не указана"}</p>}

        {message && <p className="mt-5 rounded-xl border border-cyan-800/40 bg-cyan-950/25 p-3 text-sm text-cyan-100">{message}</p>}

        <div className="mt-6 flex flex-wrap gap-2">
          {clanWar.challenge_kind === "direct" && clanWar.status === "pending" && permissions.canManageOpponent && <><button type="button" disabled={busy} onClick={() => runAction({ action: "accept_direct" }, "Вызов принят")} className="btn-primary"><Check size={17} /> Принять вызов</button><button type="button" disabled={busy} onClick={() => runAction({ action: "decline_direct" }, "Вызов отклонён")} className="btn-secondary text-red-200"><X size={17} /> Отклонить</button></>}
          {permissions.canComplete && <button type="button" disabled={busy} onClick={() => runAction({ action: "complete" }, "КВ перенесено в историю")} className="btn-primary"><ShieldCheck size={17} /> Отметить завершённым</button>}
          {permissions.canCancel && <button type="button" disabled={busy} onClick={() => { const reason = window.prompt("Причина отмены (необязательно)") ?? undefined; if (reason !== undefined) void runAction({ action: "cancel", reason }, "КВ отменено"); }} className="btn-secondary text-red-200">Отменить КВ</button>}
        </div>
      </section>

      {clanWar.status === "open" && permissions.canRespond && eligibleResponseOrganizations.length > 0 && (
        <section className="panel mt-6 p-6">
          <p className="eyebrow">Открытый вызов</p><h2 className="mt-1 text-2xl font-black">Откликнуться</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
            <select className="field" value={effectiveResponseTeamId} onChange={(event) => setResponseTeamId(event.target.value)}>{eligibleResponseOrganizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select>
            <input className="field" maxLength={2000} value={responseMessage} onChange={(event) => setResponseMessage(event.target.value)} placeholder="Короткое сообщение сопернику" />
            <button type="button" disabled={busy} onClick={sendResponse} className="btn-primary">Отправить отклик</button>
          </div>
        </section>
      )}

      {details.responses.length > 0 && (
        <section className="panel mt-6 p-6">
          <p className="eyebrow">Кандидаты</p><h2 className="mt-1 text-2xl font-black">Отклики · {details.responses.length}</h2>
          <div className="mt-4 space-y-3">
            {details.responses.map((response) => {
              const canWithdraw = details.managedOrganizations.some((organization) => organization.id === response.team_id) && response.status === "pending";
              return (
                <article key={response.id} className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3"><div><Link href={`/teams/${response.team_id}`} className="font-bold text-cyan-200 hover:underline">{response.team?.name || "Организация"}</Link><p className="text-xs text-slate-500">{responseLabels[response.status]} · {new Date(response.created_at).toLocaleString("ru-RU")}</p></div><div className="flex gap-2">{permissions.canManageCreator && clanWar.status === "open" && response.status === "pending" && <><button type="button" disabled={busy} onClick={() => runAction({ action: "accept_response", responseId: response.id }, "Соперник выбран")} className="btn-primary text-sm">Принять</button><button type="button" disabled={busy} onClick={() => runAction({ action: "reject_response", responseId: response.id }, "Отклик отклонён")} className="btn-secondary text-sm">Отклонить</button></>}{canWithdraw && <button type="button" disabled={busy} onClick={() => runAction({ action: "withdraw_response", responseId: response.id }, "Отклик отозван")} className="btn-secondary text-sm">Отозвать</button>}</div></div>
                  {response.message && <p className="mt-3 text-sm text-slate-300">{response.message}</p>}
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="panel mt-6 p-6">
        <p className="eyebrow">Заявленные игроки</p><h2 className="mt-1 text-2xl font-black">Составы {clanWar.format}×{clanWar.format}</h2>
        {details.rosters.length === 0 ? <p className="mt-4 text-sm text-slate-500">Составы ещё не сохранены.</p> : <div className="mt-4 grid gap-4 md:grid-cols-2">{details.rosters.map((roster) => <article key={roster.id} className="rounded-xl border border-white/10 bg-slate-950/35 p-4"><Link href={`/teams/${roster.team_id}`} className="font-bold text-cyan-200 hover:underline">{roster.team?.name || "Организация"}</Link><div className="mt-3 space-y-2">{roster.players.map((player, index) => <div key={player.id} className="flex items-center justify-between rounded-lg bg-white/[.03] px-3 py-2 text-sm"><Link href={`/profile/${player.id}`} className="hover:text-cyan-300">{index + 1}. {player.nickname}</Link>{player.game_id && <span className="text-xs text-slate-500">ID {player.game_id}</span>}</div>)}</div></article>)}</div>}

        {editableRosterOrganizations.map((organization) => {
          const selected = rosterSelections[organization.id] ?? [];
          return (
            <div key={organization.id} className="mt-5 rounded-xl border border-cyan-900/30 bg-cyan-950/15 p-4">
              <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold">Состав: {organization.name}</h3><p className="text-xs text-slate-500">Выбрано {selected.length} из {clanWar.format}</p></div><button type="button" disabled={busy || selected.length !== clanWar.format} onClick={() => runAction({ action: "save_roster", teamId: organization.id, playerIds: selected }, "Состав сохранён")} className="btn-primary text-sm disabled:opacity-40">Сохранить состав</button></div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">{organization.members.map((member) => { const checked = selected.includes(member.user_id); return <label key={member.user_id} className={checked ? "flex cursor-pointer items-center gap-3 rounded-lg border border-cyan-400/40 bg-cyan-950/35 p-3" : "flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/[.02] p-3"}><input type="checkbox" checked={checked} onChange={() => toggleRosterPlayer(organization.id, member.user_id)} /><span><strong className="block text-sm">{member.profile.nickname}</strong><small className="text-slate-500">{member.position === "main" ? "Основа" : "Запас"}{member.profile.game_id ? ` · ID ${member.profile.game_id}` : ""}</small></span></label>; })}</div>
            </div>
          );
        })}
      </section>

      <section className="panel mt-6 p-6">
        <div className="flex items-center gap-3"><MessageCircle className="text-cyan-300" /><div><p className="eyebrow">Переговоры</p><h2 className="text-2xl font-black">Комментарии · {details.comments.length}</h2></div></div>
        {permissions.canComment && <div className="mt-5 flex items-end gap-2"><textarea className="field min-h-20" maxLength={2000} value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="Согласуйте время, правила, карты и другие условия" /><button type="button" disabled={busy || !commentBody.trim()} onClick={sendComment} className="btn-primary shrink-0" aria-label="Отправить"><Send size={18} /></button></div>}
        {!user && <p className="mt-4 text-sm text-slate-500">Войдите, чтобы участвовать в переговорах.</p>}
        {user && !permissions.canComment && <p className="mt-4 text-sm text-slate-500">Писать могут руководители сторон и коллективов, отправивших отклик.</p>}
        <div className="mt-5 space-y-3">{details.comments.length === 0 ? <p className="py-5 text-center text-sm text-slate-500">Переговоры ещё не начались.</p> : details.comments.map((comment) => <article key={comment.id} className="rounded-xl border border-white/10 bg-slate-950/35 p-4"><header className="flex items-center justify-between gap-3"><Link href={`/profile/${comment.author_id}`} className="font-bold text-cyan-200 hover:underline">{comment.author.nickname}</Link><time className="text-xs text-slate-500">{new Date(comment.created_at).toLocaleString("ru-RU")}</time></header><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">{comment.body}</p></article>)}</div>
      </section>
    </div>
  );
}

function OrganizationBlock({ organization, align = "left" }: { organization: Organization; align?: "left" | "right" }) {
  return <div className={align === "right" ? "min-w-0 text-right" : "min-w-0"}><Link href={`/teams/${organization.id}`} className="inline-flex items-center gap-2 text-lg font-black text-white hover:text-cyan-300">{organization.name}<ShieldCheck size={16} className="text-cyan-300" /></Link><p className="text-xs text-slate-500">{organization.type === "guild" ? "Гильдия" : "Команда"}</p></div>;
}
