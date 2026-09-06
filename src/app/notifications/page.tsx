"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PushNotificationButton from "@/components/PushNotificationButton";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";
import TranslatedText from "@/components/TranslatedText";
import { isMessageKey } from "@/i18n/messages";

interface Notification {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  link: string | null;
  title_key: string | null;
  body_key: string | null;
  message_params: Record<string, string | number> | null;
}

interface TeamInvitation {
  id: string;
  team_id: string;
  expires_at: string;
  team_name: string;
  team_type: string;
}

export default function NotificationsPage() {
  const supabase = useMemo(() => createClient(), []);
  const { t, formatDate } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const [{ data: notificationRows }, { data: invitationRows }] = await Promise.all([
      supabase
        .from("notifications")
        .select("id, title, body, is_read, created_at, link, title_key, body_key, message_params")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("team_invitations")
        .select("id, team_id, expires_at")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }),
    ]);

    setNotifications(notificationRows ?? []);
    const teamIds = [...new Set((invitationRows ?? []).map((row) => row.team_id))];
    const { data: teams } = teamIds.length
      ? await supabase.from("teams").select("id, name, type").in("id", teamIds)
      : { data: [] };
    const teamById = new Map((teams ?? []).map((team) => [team.id, team]));
    setInvitations((invitationRows ?? []).map((row) => ({
      ...row,
      team_name: teamById.get(row.team_id)?.name ?? "Организация OMCITE",
      team_type: teamById.get(row.team_id)?.type ?? "team",
    })));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadNotifications(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadNotifications]);

  const respondToInvitation = async (invitationId: string, accept: boolean) => {
    setMessage(accept ? t("notifications.accepting") : t("notifications.rejecting"));
    const { data, error } = await supabase.rpc("respond_team_invitation", {
      p_invitation_id: invitationId,
      p_accept: accept,
    });
    if (error) {
      setMessage(t("notifications.error", { message: error.message }));
      return;
    }
    setMessage(data === "accepted" ? t("notifications.joined") : t("notifications.rejected"));
    await loadNotifications();
  };

  const markAsRead = async (notificationId: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId);
    setNotifications((current) => current.map((notification) =>
      notification.id === notificationId ? { ...notification, is_read: true } : notification,
    ));
  };

  if (loading) return <div className="min-h-screen p-6"><p>{t("common.loading")}</p></div>;

  return (
    <div className="min-h-screen p-4 md:p-7">
      <span className="section-kicker">{t("notifications.eyebrow")}</span>
      <h1 className="mb-6 text-3xl font-black text-white">{t("notifications")}</h1>
      <div className="mb-6"><PushNotificationButton /></div>

      {message && <p className="mb-4 rounded-lg border border-cyan-800/40 bg-cyan-950/30 p-3 text-cyan-100">{message}</p>}

      {invitations.length > 0 && (
        <section className="cyber-card mb-6 p-5">
          <h2 className="mb-3 text-lg font-bold">{t("notifications.invitations")}</h2>
          <div className="space-y-3">
            {invitations.map((invitation) => (
              <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-900/30 bg-slate-950/40 p-4">
                <div>
                  <p className="font-semibold">{invitation.team_name}</p>
                  <p className="text-sm text-slate-400">
                    {invitation.team_type === "guild" ? t("common.guild") : t("common.team")} · {t("notifications.until", { date: formatDate(invitation.expires_at, { dateStyle: "short", timeStyle: "short" }) })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => respondToInvitation(invitation.id, true)} className="primary-button">{t("notifications.accept")}</button>
                  <button type="button" onClick={() => respondToInvitation(invitation.id, false)} className="secondary-button">{t("notifications.reject")}</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {notifications.length === 0 ? (
        <p className="text-slate-400">{t("notifications.empty")}</p>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <article
              key={notification.id}
              onClick={() => markAsRead(notification.id)}
              className={`cyber-card cursor-pointer p-4 ${notification.is_read ? "opacity-75" : "ring-1 ring-cyan-500/50"}`}
            >
              {isMessageKey(notification.title_key)
                ? <p className="font-semibold">{t(notification.title_key, notification.message_params ?? undefined)}</p>
                : <TranslatedText sourceType="notification" sourceId={notification.id} sourceField="title" original={notification.title} textClassName="font-semibold" />}
              {isMessageKey(notification.body_key)
                ? <p className="text-sm text-slate-300">{t(notification.body_key, notification.message_params ?? undefined)}</p>
                : <TranslatedText sourceType="notification" sourceId={notification.id} sourceField="body" original={notification.body} textClassName="text-sm text-slate-300" />}
              <p className="mt-1 text-xs text-slate-500">{formatDate(notification.created_at, { dateStyle: "short", timeStyle: "medium" })}</p>
              {notification.link && <Link href={notification.link} className="mt-2 inline-block text-sm text-cyan-300">{t("notifications.open")}</Link>}
            </article>
          ))}
        </div>
      )}

      <Link href="/" className="mt-6 block text-cyan-300 hover:underline">{t("notifications.backHome")}</Link>
    </div>
  );
}
