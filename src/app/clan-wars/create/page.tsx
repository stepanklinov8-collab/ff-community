"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Swords } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { authFetch } from "@/utils/api/auth-fetch";

interface Organization {
  id: string;
  name: string;
  type: "team" | "guild";
  avatar_url: string | null;
}

export default function CreateClanWarPage() {
  const router = useRouter();
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
        if (!response.ok) throw new Error(payload.error || "Не удалось загрузить организации");
        setOrganizations(payload.organizations ?? []);
        setManagedOrganizations(payload.managedOrganizations ?? []);
        setCreatorTeamId(payload.managedOrganizations?.[0]?.id ?? "");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Не удалось загрузить организации"))
      .finally(() => setLoading(false));
  }, []);

  const creator = managedOrganizations.find((organization) => organization.id === creatorTeamId);
  const opponents = useMemo(() => organizations.filter((organization) =>
    organization.id !== creatorTeamId && organization.type === creator?.type,
  ), [creator?.type, creatorTeamId, organizations]);

  const effectiveOpponentTeamId = opponents.some((organization) => organization.id === opponentTeamId) ? opponentTeamId : "";

  async function createClanWar() {
    if (!creatorTeamId) { setMessage("Для создания КВ нужно руководить командой или гильдией"); return; }
    if (title.trim().length < 2) { setMessage("Введите название вызова"); return; }
    if (challengeKind === "direct" && !effectiveOpponentTeamId) { setMessage("Выберите соперника"); return; }
    setBusy(true);
    setMessage("Создаём вызов...");
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
      if (!response.ok || !payload.clanWarId) throw new Error(payload.error || "Не удалось создать КВ");
      router.push(`/clan-wars/${payload.clanWarId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось создать КВ");
      setBusy(false);
    }
  }

  if (loading) return <div className="page-shell"><div className="panel h-72 animate-pulse bg-white/[.03]" /></div>;

  return (
    <div className="page-shell max-w-4xl">
      <Link href="/clan-wars" className="text-cyan-300 hover:underline">← К списку КВ</Link>
      <section className="panel mt-4 p-6 sm:p-8">
        <div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-xl bg-red-950/60 text-red-300"><Swords /></span><div><p className="eyebrow">Новый вызов</p><h1 className="text-3xl font-black">Создать КВ</h1></div></div>
        <p className="mt-4 text-slate-400">Вызов публикуется сразу, без проверки администратором. Составы можно выбрать на странице КВ после создания.</p>

        {managedOrganizations.length === 0 ? (
          <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-950/25 p-5"><h2 className="font-bold text-amber-200">Нет доступной организации</h2><p className="mt-2 text-sm text-slate-300">Создавать КВ могут лидер, старший заместитель или заместитель команды/гильдии.</p><Link href="/teams/create" className="btn-primary mt-4 inline-flex">Создать организацию</Link></div>
        ) : (
          <div className="mt-7 space-y-6">
            <label className="field-label">От чьего имени
              <select className="field mt-2" value={creatorTeamId} onChange={(event) => { setCreatorTeamId(event.target.value); setOpponentTeamId(""); }}>
                {managedOrganizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name} · {organization.type === "guild" ? "гильдия" : "команда"}</option>)}
              </select>
            </label>

            <div>
              <span className="field-label">Тип вызова</span>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => setChallengeKind("open")} className={challengeKind === "open" ? "rounded-xl border border-cyan-400 bg-cyan-950/40 p-4 text-left" : "rounded-xl border border-white/10 bg-white/[.025] p-4 text-left"}><strong className="block">Открытый поиск</strong><span className="mt-1 block text-sm text-slate-400">Подходящие коллективы смогут откликнуться.</span></button>
                <button type="button" onClick={() => setChallengeKind("direct")} className={challengeKind === "direct" ? "rounded-xl border border-cyan-400 bg-cyan-950/40 p-4 text-left" : "rounded-xl border border-white/10 bg-white/[.025] p-4 text-left"}><strong className="block">Адресный вызов</strong><span className="mt-1 block text-sm text-slate-400">Приглашение получит конкретный соперник.</span></button>
              </div>
            </div>

            {challengeKind === "direct" && (
              <label className="field-label">Соперник
                <select className="field mt-2" value={effectiveOpponentTeamId} onChange={(event) => setOpponentTeamId(event.target.value)}>
                  <option value="">Выберите {creator?.type === "guild" ? "гильдию" : "команду"}</option>
                  {opponents.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
                </select>
              </label>
            )}

            <label className="field-label">Название вызова<input className="field mt-2" maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например: Вечернее КВ без гранат" /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="field-label">Формат
                <select className="field mt-2" value={format} onChange={(event) => setFormat(Number(event.target.value) as 4 | 6)}><option value={4}>4 × 4</option><option value={6}>6 × 6</option></select>
              </label>
              <label className="field-label">Предлагаемое время<input className="field mt-2" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label>
            </div>
            <label className="field-label">Описание<textarea className="field mt-2 min-h-28" maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Карта, режим и дополнительные условия" /></label>
            <label className="field-label">Правила<textarea className="field mt-2 min-h-28" maxLength={5000} value={rules} onChange={(event) => setRules(event.target.value)} placeholder="Что разрешено, порядок комнат, количество раундов" /></label>

            {message && <p className="rounded-xl border border-cyan-800/40 bg-cyan-950/25 p-3 text-sm text-cyan-100">{message}</p>}
            <button type="button" onClick={createClanWar} disabled={busy} className="btn-primary w-full justify-center disabled:opacity-50"><ShieldCheck size={18} />{busy ? "Создаём..." : "Опубликовать вызов"}</button>
          </div>
        )}
      </section>
    </div>
  );
}
