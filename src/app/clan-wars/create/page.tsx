"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Swords } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { authFetch } from "@/utils/api/auth-fetch";
import { useLanguage } from "@/components/LanguageProvider";

interface Organization {
  id: string;
  name: string;
  type: "team" | "guild";
  avatar_url: string | null;
}

export default function CreateClanWarPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [managedOrganizations, setManagedOrganizations] = useState<Organization[]>([]);
  const [creatorTeamId, setCreatorTeamId] = useState("");
  const [challengeKind, setChallengeKind] = useState<"open" | "direct">("open");
  const [opponentTeamId, setOpponentTeamId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [format, setFormat] = useState<4 | 6>(4);
  const [scheduledAt, setScheduledAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void authFetch("/api/clan-wars/organizations")
      .then(async (response) => {
        const payload = await response.json() as { organizations?: Organization[]; managedOrganizations?: Organization[]; error?: string };
        if (!response.ok) throw new Error(payload.error || t("clanWars.loadOrganizationsError"));
        setOrganizations(payload.organizations ?? []);
        setManagedOrganizations(payload.managedOrganizations ?? []);
        setCreatorTeamId(payload.managedOrganizations?.[0]?.id ?? "");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : t("clanWars.loadOrganizationsError")))
      .finally(() => setLoading(false));
  }, [t]);

  const creator = managedOrganizations.find((organization) => organization.id === creatorTeamId);
  const opponents = useMemo(() => organizations.filter((organization) =>
    organization.id !== creatorTeamId && organization.type === creator?.type,
  ), [creator?.type, creatorTeamId, organizations]);

  const effectiveOpponentTeamId = opponents.some((organization) => organization.id === opponentTeamId) ? opponentTeamId : "";

  async function createClanWar() {
    if (!creatorTeamId) { setMessage(t("clanWars.needManage")); return; }
    if (title.trim().length < 2) { setMessage(t("clanWars.enterTitle")); return; }
    if (challengeKind === "direct" && !effectiveOpponentTeamId) { setMessage(t("clanWars.chooseOpponent")); return; }
    setBusy(true);
    setMessage(t("clanWars.creating"));
    try {
      const response = await authFetch("/api/clan-wars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorTeamId,
          opponentTeamId: challengeKind === "direct" ? effectiveOpponentTeamId : null,
          title: title.trim(),
          description: description.trim(),
          rules: rules.trim(),
          format,
          challengeKind,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        }),
      });
      const payload = await response.json() as { clanWarId?: string; error?: string };
      if (!response.ok || !payload.clanWarId) throw new Error(payload.error || t("clanWars.createError"));
      router.push(`/clan-wars/${payload.clanWarId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("clanWars.createError"));
      setBusy(false);
    }
  }

  if (loading) return <div className="page-shell"><div className="panel h-72 animate-pulse bg-white/[.03]" /></div>;

  return (
    <div className="page-shell max-w-4xl">
      <Link href="/clan-wars" className="text-cyan-300 hover:underline">{t("clanWars.back")}</Link>
      <section className="panel mt-4 p-6 sm:p-8">
        <div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-xl bg-red-950/60 text-red-300"><Swords /></span><div><p className="eyebrow">{t("clanWars.newEyebrow")}</p><h1 className="text-3xl font-black">{t("clanWars.create")}</h1></div></div>
        <p className="mt-4 text-slate-400">{t("clanWars.publishNote")}</p>

        {managedOrganizations.length === 0 ? (
          <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-950/25 p-5"><h2 className="font-bold text-amber-200">{t("clanWars.noOrganization")}</h2><p className="mt-2 text-sm text-slate-300">{t("clanWars.noOrganizationText")}</p><Link href="/teams/create" className="btn-primary mt-4 inline-flex">{t("clanWars.createOrganization")}</Link></div>
        ) : (
          <div className="mt-7 space-y-6">
            <label className="field-label">{t("clanWars.creator")}
              <select className="field mt-2" value={creatorTeamId} onChange={(event) => { setCreatorTeamId(event.target.value); setOpponentTeamId(""); }}>
                {managedOrganizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name} · {organization.type === "guild" ? t("common.guild") : t("common.team")}</option>)}
              </select>
            </label>

            <div>
              <span className="field-label">{t("clanWars.challengeType")}</span>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => setChallengeKind("open")} className={challengeKind === "open" ? "rounded-xl border border-cyan-400 bg-cyan-950/40 p-4 text-left" : "rounded-xl border border-white/10 bg-white/[.025] p-4 text-left"}><strong className="block">{t("clanWars.openSearch")}</strong><span className="mt-1 block text-sm text-slate-400">{t("clanWars.openSearchText")}</span></button>
                <button type="button" onClick={() => setChallengeKind("direct")} className={challengeKind === "direct" ? "rounded-xl border border-cyan-400 bg-cyan-950/40 p-4 text-left" : "rounded-xl border border-white/10 bg-white/[.025] p-4 text-left"}><strong className="block">{t("clanWars.direct")}</strong><span className="mt-1 block text-sm text-slate-400">{t("clanWars.directText")}</span></button>
              </div>
            </div>

            {challengeKind === "direct" && (
              <label className="field-label">{t("clanWars.opponent")}
                <select className="field mt-2" value={effectiveOpponentTeamId} onChange={(event) => setOpponentTeamId(event.target.value)}>
                  <option value="">{creator?.type === "guild" ? t("clanWars.chooseGuild") : t("clanWars.chooseTeam")}</option>
                  {opponents.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
                </select>
              </label>
            )}

            <label className="field-label">{t("clanWars.challengeTitle")}<input className="field mt-2" maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("clanWars.challengePlaceholder")} /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="field-label">{t("clanWars.format")}
                <select className="field mt-2" value={format} onChange={(event) => setFormat(Number(event.target.value) as 4 | 6)}><option value={4}>4 × 4</option><option value={6}>6 × 6</option></select>
              </label>
              <label className="field-label">{t("clanWars.proposedTime")}<input className="field mt-2" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label>
            </div>
            <label className="field-label">{t("clanWars.descriptionLabel")}<textarea className="field mt-2 min-h-28" maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("clanWars.descriptionPlaceholder")} /></label>
            <label className="field-label">{t("clanWars.rules")}<textarea className="field mt-2 min-h-28" maxLength={5000} value={rules} onChange={(event) => setRules(event.target.value)} placeholder={t("clanWars.rulesPlaceholder")} /></label>

            {message && <p className="rounded-xl border border-cyan-800/40 bg-cyan-950/25 p-3 text-sm text-cyan-100">{message}</p>}
            <button type="button" onClick={createClanWar} disabled={busy} className="btn-primary w-full justify-center disabled:opacity-50"><ShieldCheck size={18} />{busy ? t("clanWars.publishing") : t("clanWars.publish")}</button>
          </div>
        )}
      </section>
    </div>
  );
}
