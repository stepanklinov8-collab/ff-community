"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/platform/browser-services";
import type { Compensation } from "../model";

const fee = (rule: Compensation) => rule.kind === "none" ? "Без компенсации" : rule.kind === "fixed" ? `${rule.amount.toLocaleString("ru-RU")} OC со счёта принимающей организации` : `${rule.basisPoints / 100}% фактических выплат гостю`;
type Requirement = { organizationName: string; policy: string; compensation: Compensation; approved: boolean };
export function GuestRequirements({ contractId, onReady }: { contractId: string; onReady: (ready: boolean) => void }) {
  const [data, setData] = useState<{ captured: boolean; requirements: Requirement[] } | null>(null), [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void authFetch(`/api/contracts?${new URLSearchParams({ contractId, guest: "true" })}`).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Не удалось загрузить согласования");
      if (!cancelled) { setData(data); onReady(data.captured && data.requirements.every((row: Requirement) => row.approved)); }
    }).catch(caught => { if (!cancelled) { setError(caught instanceof Error ? caught.message : "Ошибка загрузки"); onReady(false); } });
    return () => { cancelled = true; };
  }, [contractId, onReady]);
  return <section aria-label="Требования основных организаций" className="space-y-2 rounded border border-slate-600 p-3">
    <p className="font-semibold">Согласования и компенсации гостевого выступления</p>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {!data && !error && <p>Загружаем требования…</p>}
    {data && !data.captured && <p>Для этих условий ещё не зафиксированы согласования. Организация должна направить новую редакцию.</p>}
    {data?.captured && !data.requirements.length && <p>Действующих основных договоров с другими организациями для этого выступления нет.</p>}
    {data?.requirements.map(row => <div key={row.organizationName}><strong>{row.organizationName}</strong>: {fee(row.compensation)}. {row.approved ? "Согласовано" : row.policy === "forbidden" ? "Нужно отдельное разрешение вопреки запрету основного договора" : "Ожидается согласие"}.</div>)}
    <p className="text-sm text-slate-300">Фиксированная компенсация резервируется при подписании и перечисляется после подтверждённого участия. Процент распределяется из фактической выплаты. Постоянный состав не меняется.</p>
  </section>;
}

type Session = { id: string; startsAt: string; endsAt: string };
const latestEnd = (sessions: Session[]) => new Date(sessions.reduce((last, s) => Math.max(last, Date.parse(s.endsAt)), -Infinity)).toISOString();
export function GuestScopeEditor({ eventId, sessionId, disabled, onScope }: { eventId: string; sessionId: string | null; disabled: boolean; onScope: (id: string | null, endsAt: string) => void }) {
  const [data, setData] = useState<{ eventType: string; sessions: Session[] } | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true); setError("");
    try {
      const response = await authFetch(`/api/contracts?${new URLSearchParams({ guestSessionsEventId: eventId })}`), payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Не удалось загрузить расписание");
      setData(payload);
      if (payload.eventType === "tournament" && sessionId === null && payload.sessions.length) onScope(null, latestEnd(payload.sessions));
      else if (sessionId) { const selected = payload.sessions.find((s: Session) => s.id === sessionId); if (selected) onScope(sessionId, selected.endsAt); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Ошибка расписания"); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2">
    <button type="button" className="secondary-button" disabled={busy} onClick={() => void load()}>Загрузить сессии гостевого выступления</button>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {data && <label className="block">Выступление гостя<select disabled={disabled} className="w-full rounded border border-slate-600 bg-slate-900 p-2" value={sessionId ?? ""} onChange={event => {
      const selected = data.sessions.find(s => s.id === event.target.value);
      if (selected) onScope(selected.id, selected.endsAt);
      else if (data.eventType === "tournament" && data.sessions.length) onScope(null, latestEnd(data.sessions));
    }}><option value="">{data.eventType === "tournament" ? "Весь турнир" : "Выберите конкретную сессию"}</option>{data.sessions.map(s => <option key={s.id} value={s.id}>{new Date(s.startsAt).toLocaleString("ru-RU")}</option>)}</select></label>}
    <p className="text-sm text-slate-300">Для тренировки выберите одну сессию. Окончание договора заполняется по расписанию; подписать его нужно заранее.</p>
  </div>;
}

type Consent = { contractId: string; revision: number; homeContractId: string; organizationId: string; homeName: string; hostName: string; playerName: string; eventTitle: string; policy: string; compensation: Compensation; startsAt: string; endsAt: string };
export default function GuestApprovals() {
  const [rows, setRows] = useState<Consent[]>([]), [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const pending = useRef<{ fingerprint: string; requestId: string } | null>(null);
  async function load() {
    setBusy(true); setError("");
    try { const response = await authFetch("/api/contracts?guest=true"), data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Не удалось загрузить согласования"); setRows(data.items); setOpen(true); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Ошибка загрузки"); }
    finally { setBusy(false); }
  }
  async function decide(row: Consent, approve: boolean) {
    const payload = { action: "guest_consent", contractId: row.contractId, revision: row.revision, homeContractId: row.homeContractId, approve };
    const fingerprint = JSON.stringify(payload); if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, requestId: crypto.randomUUID() };
    setBusy(true); setError("");
    try {
      const response = await authFetch("/api/contracts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, requestId: pending.current.requestId }) }), data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось сохранить решение");
      pending.current = null; setNotice(approve ? "Выступление согласовано. Для начала действия игрок должен подписать гостевой договор." : "Выступление отклонено."); await load();
    } catch (caught) { setError(caught instanceof TypeError ? "Нет связи. Повторите то же решение: повторный запрос защищён." : caught instanceof Error ? caught.message : "Ошибка решения"); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3"><button type="button" disabled={busy} className="secondary-button" onClick={() => open ? setOpen(false) : void load()}>Гостевые согласования</button>
    {error && <p role="alert" className="text-red-300">{error}</p>}{notice && <p role="status" className="text-cyan-200">{notice}</p>}
    {open && <div role="region" aria-label="Гостевые согласования" className="space-y-3">{!rows.length && <p>Ожидающих согласования выступлений нет.</p>}{rows.map(row => <article key={`${row.contractId}:${row.homeContractId}`} className="cyber-card space-y-2 p-4">
      <h3 className="font-semibold">{row.playerName} → {row.hostName}</h3><p>{row.eventTitle} · {new Date(row.startsAt).toLocaleString("ru-RU")}. Решение от имени «{row.homeName}».</p>
      <p>{fee(row.compensation)}. {row.policy === "forbidden" && "Это отдельное разрешение для выступления при запрете в основном договоре; основной договор не меняется."}</p>
      <Link className="text-cyan-300 underline" href={`/teams/${row.organizationId}`}>Основная организация</Link>
      <div className="flex flex-wrap gap-3"><button type="button" className="primary-button" disabled={busy} onClick={() => void decide(row, true)}>Разрешить выступление</button><button type="button" className="secondary-button" disabled={busy} onClick={() => void decide(row, false)}>Отклонить выступление</button></div>
    </article>)}</div>}
  </section>;
}
