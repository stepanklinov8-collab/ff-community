"use client";

import Link from "next/link";
import {maps as availableMaps} from "@/lib/competition/model";
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

export default function ClanWarEditor({warId}:{warId?:string}) {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const tr=(ru:string,kk:string,ky:string)=>locale==="kk"?kk:locale==="ky"?ky:ru;
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
  const [gameCount,setGameCount]=useState(1),[winsRequired,setWinsRequired]=useState(1),[gameMaps,setGameMaps]=useState<string[]>(["bermuda"]);
  const [revision,setRevision]=useState(0),[sidesLocked,setSidesLocked]=useState(false),[structureLocked,setStructureLocked]=useState(false),[cancelled,setCancelled]=useState(false);
  const [roomCode,setRoomCode]=useState(""),[roomPassword,setRoomPassword]=useState(""),[roomNote,setRoomNote]=useState(""),[commentsClosed,setCommentsClosed]=useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed,setLoadFailed]=useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active=true;
    const load=async()=>{try{
      const response=await authFetch("/api/clan-wars/organizations"),payload=await response.json();if(!response.ok)throw new Error(payload.error);
      if(!active)return;
      setOrganizations(payload.organizations??[]);setManagedOrganizations(payload.managedOrganizations??[]);setCreatorTeamId(payload.managedOrganizations?.[0]?.id??"");
      if(warId){const r=await authFetch(`/api/clan-wars/${warId}/configuration`),d=await r.json();if(!r.ok)throw new Error(d.error);if(!active)return;
        const c=d.config;setRevision(d.revision);setSidesLocked(d.sidesLocked);setStructureLocked(d.structureLocked);setCancelled(d.cancelled);
        setManagedOrganizations(previous=>[...previous,...d.teams.filter((team:Organization)=>!previous.some(p=>p.id===team.id))]);
        setOrganizations(previous=>[...previous,...d.teams.filter((team:Organization)=>!previous.some(p=>p.id===team.id))]);
        setCreatorTeamId(c.creatorTeamId);setOpponentTeamId(c.opponentTeamId??"");setChallengeKind(c.challengeKind);setTitle(c.title);setDescription(c.description);setRules(c.rules);setFormat(c.format);
        setGameCount(c.gameCount);setWinsRequired(c.winsRequired);setGameMaps(c.maps);setScheduledAt(c.scheduledAt?new Date(Date.parse(c.scheduledAt)+3*3600000).toISOString().slice(0,16):"");
        setRoomCode(c.roomCode);setRoomPassword(c.roomPassword);setRoomNote(c.roomNote);setCommentsClosed(c.commentsClosed);
      }
    }catch(error){if(active){setLoadFailed(true);setMessage(error instanceof Error?error.message:t("clanWars.loadOrganizationsError"));}}finally{if(active)setLoading(false);}};
    void load();return()=>{active=false;};
  }, [t,warId]);

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
      const configuration={
          creatorTeamId,
          opponentTeamId: sidesLocked ? opponentTeamId||null : challengeKind === "direct" ? effectiveOpponentTeamId : null,
          title: title.trim(),
          description: description.trim(),
          rules: rules.trim(),
          format,
          challengeKind,
          scheduledAt: scheduledAt ? new Date(`${scheduledAt}:00+03:00`).toISOString() : null,
          gameCount,winsRequired,maps:gameMaps,roomCode,roomPassword,roomNote,commentsClosed,
        };
      const response = await authFetch(warId?`/api/clan-wars/${warId}/configuration`:"/api/clan-wars", {
        method: warId?"PATCH":"POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(warId?{revision,config:configuration}:configuration),
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
  if(loadFailed)return <div className="page-shell"><Link href="/clan-wars" className="text-cyan-300">{t("clanWars.back")}</Link><p role="alert" className="mt-4 text-amber-200">{message}</p></div>;

  return (
    <div className="page-shell max-w-4xl">
      <Link href="/clan-wars" className="text-cyan-300 hover:underline">{t("clanWars.back")}</Link>
      <section className="panel mt-4 p-6 sm:p-8">
        <div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-xl bg-red-950/60 text-red-300"><Swords /></span><div><p className="eyebrow">{t("clanWars.newEyebrow")}</p><h1 className="text-3xl font-black">{warId?tr("Изменить КВ","КВ өзгерту","КВ өзгөртүү"):t("clanWars.create")}</h1></div></div>
        <p className="mt-4 text-slate-400">{warId?tr("При изменении формата, карт, правил или времени черновик результатов очищается, ставки возвращаются. Смена формата также очищает составы: стороны должны выбрать игроков заново. После подтверждения результатов эти условия закреплены.","Пішім, карта, ереже не уақыт өзгерсе, нәтиже жобасы тазартылып, ставкалар қайтарылады. Пішім өзгерсе, екі тарап ойыншыларды қайта таңдайды. Расталған нәтижелерден кейін шарттар бекітіледі.","Формат, карта, эреже же убакыт өзгөрсө, жыйынтык долбоору тазаланып, коюмдар кайтарылат. Формат өзгөрсө, эки тарап оюнчуларды кайра тандайт. Жыйынтык ырасталгандан кийин шарттар бекитилет."):t("clanWars.publishNote")}</p>

        {managedOrganizations.length === 0 ? (
          <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-950/25 p-5"><h2 className="font-bold text-amber-200">{t("clanWars.noOrganization")}</h2><p className="mt-2 text-sm text-slate-300">{t("clanWars.noOrganizationText")}</p><Link href="/teams/create" className="btn-primary mt-4 inline-flex">{t("clanWars.createOrganization")}</Link></div>
        ) : (
          <fieldset disabled={busy||cancelled} className="mt-7 space-y-6">
            <label className="field-label">{t("clanWars.creator")}
              <select className="field mt-2" disabled={sidesLocked} value={creatorTeamId} onChange={(event) => { setCreatorTeamId(event.target.value); setOpponentTeamId(""); }}>
                {managedOrganizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name} · {organization.type === "guild" ? t("common.guild") : t("common.team")}</option>)}
              </select>
            </label>

            <div>
              <span className="field-label">{t("clanWars.challengeType")}</span>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <button type="button" disabled={sidesLocked} onClick={() => setChallengeKind("open")} className={challengeKind === "open" ? "rounded-xl border border-cyan-400 bg-cyan-950/40 p-4 text-left" : "rounded-xl border border-white/10 bg-white/[.025] p-4 text-left"}><strong className="block">{t("clanWars.openSearch")}</strong><span className="mt-1 block text-sm text-slate-400">{t("clanWars.openSearchText")}</span></button>
                <button type="button" disabled={sidesLocked} onClick={() => setChallengeKind("direct")} className={challengeKind === "direct" ? "rounded-xl border border-cyan-400 bg-cyan-950/40 p-4 text-left" : "rounded-xl border border-white/10 bg-white/[.025] p-4 text-left"}><strong className="block">{t("clanWars.direct")}</strong><span className="mt-1 block text-sm text-slate-400">{t("clanWars.directText")}</span></button>
              </div>
            </div>

            {challengeKind === "direct" && (
              <label className="field-label">{t("clanWars.opponent")}
                <select className="field mt-2" disabled={sidesLocked} value={effectiveOpponentTeamId} onChange={(event) => setOpponentTeamId(event.target.value)}>
                  <option value="">{creator?.type === "guild" ? t("clanWars.chooseGuild") : t("clanWars.chooseTeam")}</option>
                  {opponents.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
                </select>
              </label>
            )}

            <label className="field-label">{t("clanWars.challengeTitle")}<input className="field mt-2" maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("clanWars.challengePlaceholder")} /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="field-label">{t("clanWars.format")}
                <select className="field mt-2" disabled={structureLocked} value={format} onChange={(event) => setFormat(Number(event.target.value) as 4 | 6)}><option value={4}>4 × 4</option><option value={6}>6 × 6</option></select>
              </label>
              <label className="field-label">{tr("Побед в серии","Сериядағы жеңістер","Сериядагы жеңиштер")}<input type="number" disabled={structureLocked} min={1} max={5000} value={winsRequired} onChange={e=>{const value=Math.max(1,Number(e.target.value));setWinsRequired(value);if(gameCount<2*value-1){setGameCount(2*value-1);setGameMaps(m=>Array.from({length:2*value-1},(_,i)=>m[i]??"bermuda"));}}}/></label>
              <label className="field-label">{tr("Количество игр","Ойын саны","Оюндардын саны")}<input type="number" disabled={structureLocked} min={2*winsRequired-1} max={10000} value={gameCount} onChange={e=>{const value=Math.max(1,Number(e.target.value));setGameCount(value);setGameMaps(m=>Array.from({length:value},(_,i)=>m[i]??"bermuda"));}}/></label>
              <div className="space-y-2">{gameMaps.map((map,i)=><label className="block" key={i}>{tr("Игра","Ойын","Оюн")} {i+1}<select disabled={structureLocked} value={map} onChange={e=>setGameMaps(m=>m.map((v,n)=>n===i?e.target.value:v))}>{availableMaps.map(m=><option key={m} value={m}>{m}</option>)}</select></label>)}</div>
              <label className="field-label">{t("clanWars.proposedTime")} (МСК)<input className="field mt-2" disabled={structureLocked} type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label>
            </div>
            <label className="field-label">{t("clanWars.descriptionLabel")}<textarea className="field mt-2 min-h-28" maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("clanWars.descriptionPlaceholder")} /></label>
            <label className="field-label">{t("clanWars.rules")}<textarea className="field mt-2 min-h-28" disabled={structureLocked} maxLength={5000} value={rules} onChange={(event) => setRules(event.target.value)} placeholder={t("clanWars.rulesPlaceholder")} /></label>

            <div className="grid gap-4 sm:grid-cols-2"><label>{tr("Комната","Бөлме","Бөлмө")}<input className="field" value={roomCode} onChange={e=>setRoomCode(e.target.value)}/></label><label>{tr("Пароль комнаты","Бөлме құпиясөзі","Бөлмөнүн сырсөзү")}<input className="field" value={roomPassword} onChange={e=>setRoomPassword(e.target.value)}/></label></div>
            <label className="block">{tr("Примечание комнаты","Бөлме ескертпесі","Бөлмөнүн эскертүүсү")}<textarea className="field" value={roomNote} onChange={e=>setRoomNote(e.target.value)}/></label>
            <label className="block"><input type="checkbox" checked={commentsClosed} onChange={e=>setCommentsClosed(e.target.checked)}/> {tr("Закрыть обсуждение","Талқылауды жабу","Талкууну жабуу")}</label>
            {message && <p className="rounded-xl border border-cyan-800/40 bg-cyan-950/25 p-3 text-sm text-cyan-100">{message}</p>}
            <button type="button" onClick={createClanWar} disabled={busy} className="btn-primary w-full justify-center disabled:opacity-50"><ShieldCheck size={18} />{busy ? t("clanWars.publishing") : warId?tr("Сохранить изменения","Өзгерістерді сақтау","Өзгөртүүлөрдү сактоо"):t("clanWars.publish")}</button>
          </fieldset>
        )}
      </section>
    </div>
  );
}
