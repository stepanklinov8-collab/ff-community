"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/platform/browser-services";

type Fine = {
  id: string; revision: number; amount: number; paid: number; remaining: number; playerValue: number;
  eventId: string; eventTitle: string; sessionStart: string; cancelledAt: string | null;
  cancellationReason: string | null; refundAmount: number; refunded: number; refundDebt: number;
};
const coins = (value: number) => `${value.toLocaleString("ru-RU")} OC`;

export default function ContractFines({ contractId }: { contractId: string }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [canCancel, setCanCancel] = useState(false);
  const [rows, setRows] = useState<Fine[]>([]), [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<Fine | null>(null), [reason, setReason] = useState("");
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const pending = useRef<{ fingerprint: string; requestId: string } | null>(null);
  async function fetchRows(append: boolean) {
    const response = await authFetch(`/api/contracts?${new URLSearchParams({ contractId, fines: "true", offset: String(append ? rows.length : 0) })}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Не удалось загрузить штрафы");
    setRows(current => append ? [...current, ...data.fines] : data.fines);
    setHasMore(data.hasMore); setCanCancel(data.canCancel === true); setOpen(true);
  }
  async function load(append = false) {
    setBusy(true); setError("");
    try { await fetchRows(append); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось загрузить штрафы"); }
    finally { setBusy(false); }
  }
  async function cancelFine() {
    if (!selected || reason.trim().length < 3) return;
    const payload = { action: "cancel_fine", claimId: selected.id, reason: reason.trim() };
    const fingerprint = JSON.stringify(payload);
    if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, requestId: crypto.randomUUID() };
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await authFetch("/api/contracts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, requestId: pending.current.requestId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось отменить штраф");
      setRows(current => current.map(row => row.id === selected.id ? { ...row, remaining: 0, cancelledAt: new Date().toISOString(), cancellationReason: payload.reason, refundAmount: data.refundAmount, refunded: data.refunded, refundDebt: data.refundDebt } : row));
      pending.current = null; setSelected(null); setReason("");
      setNotice(`Штраф отменён. Возвращено ${coins(data.refunded)}. Организация ещё должна вернуть ${coins(data.refundDebt)}.`);
      try { await fetchRows(false); }
      catch { setError("Отмена подтверждена, но список не обновился. Нажмите «Обновить штрафы»."); }
    } catch (caught) { setError(caught instanceof TypeError ? "Нет связи. Повторите отмену: повторное действие защищено." : caught instanceof Error ? caught.message : "Ошибка отмены"); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 border-t border-slate-700 pt-3" aria-label="Штрафы по договору">
    <button type="button" className="secondary-button" disabled={busy} aria-expanded={open} onClick={() => { if (open) setOpen(false); else void load(); }}>{busy ? "Обработка…" : open ? "Скрыть штрафы" : "Штрафы за неявку"}</button>
    {open && <>
      <p className="text-sm text-slate-300">Штраф применяется только к заявленному игроку, который полностью пропустил сессию, если это условие есть в подписанном договоре. Свободные монеты погашают долг; целевые резервы сохраняются.</p>
      {!rows.length && <p>Штрафов пока нет.</p>}
      {rows.map(row => <div key={row.id} className="space-y-3 rounded border border-slate-700 p-3">
        <p className="font-semibold">Неявка · версия {row.revision} · <Link className="text-cyan-200 hover:underline" href={`/tournaments/${row.eventId}`}>{row.eventTitle}</Link></p>
        <p className="text-sm">Сессия: {new Date(row.sessionStart).toLocaleString("ru-RU")} · Стоимость в снимке сессии: {coins(row.playerValue)}</p>
        <dl className="grid grid-cols-3 gap-2 text-sm">{[["Штраф", row.amount], ["Оплачено", row.paid], ["Долг", row.remaining]].map(([label, value]) => <div key={label}><dt className="text-slate-400">{label}</dt><dd>{coins(Number(value))}</dd></div>)}</dl>
        {row.cancelledAt ? <div className="text-sm"><p>Штраф отменён: {row.cancellationReason}</p><p>Возвращено игроку: {coins(row.refunded)}. Осталось вернуть: {coins(row.refundDebt)}.</p>{row.refundDebt > 0 && <p>Возврат находится в разделе «Начисления и выплаты» и остаётся долгом организации.</p>}</div> : <p className="text-sm">{row.remaining ? "Остаток погашается из свободных поступлений. До погашения вывод недоступен." : "Штраф оплачен."}</p>}
        {canCancel && !row.cancelledAt && !selected && <button type="button" className="secondary-button" disabled={busy} onClick={() => { setSelected(row); setReason(""); setError(""); setNotice(""); }}>Отменить штраф</button>}
        {selected?.id === row.id && <div className="space-y-3 border-t border-slate-700 pt-3">
          <label className="block">Причина отмены штрафа<input className="mt-1 w-full rounded border border-slate-600 bg-slate-900 p-2" minLength={3} maxLength={1000} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} /></label>
          <p className="text-sm">Непогашенный долг отменится. Уже полученные монеты возвращаются игроку из свободного баланса организации; при нехватке сумма останется её долгом. История сохранится.</p>
          <div className="flex flex-wrap gap-2"><button type="button" className="primary-button" disabled={busy || reason.trim().length < 3} onClick={() => void cancelFine()}>Подтвердить отмену штрафа</button><button type="button" className="secondary-button" disabled={busy} onClick={() => setSelected(null)}>Вернуться</button></div>
        </div>}
      </div>)}
      <div className="flex flex-wrap gap-2">{hasMore && <button type="button" className="secondary-button" disabled={busy} onClick={() => void load(true)}>Ещё штрафы</button>}<button type="button" className="secondary-button" disabled={busy} onClick={() => void load()}>Обновить штрафы</button></div>
    </>}
    {notice && <p role="status" className="text-cyan-200">{notice}</p>}
    {error && <p role="alert" className="text-red-200">{error}</p>}
  </section>;
}
