"use client";

import { useRef, useState } from "react";
import { authFetch } from "@/platform/browser-services";

type Obligation = {
  id: string; revision: number; kind: string; amount: number; paid: number; held: number;
  dueAt: string; remaining: number; debt: boolean; overdueSevenDays: boolean;
  cancelledAt?: string | null; cancellationReason?: string | null; returned?: number; recoveryDebt?: number;
  scope?: "tournament" | null;
  guestShares?: number; playerPaid?: number;
};
const names: Record<string, string> = { signing: "Первоначальный бонус", salary: "Зарплата", appearance: "Участие", kill: "Киллы", mvp: "MVP", ranking: "Рейтинг", termination: "Компенсация", fine_refund: "Возврат отменённого штрафа", prize: "Доля призовых" };
const coins = (value: number) => `${value.toLocaleString("ru-RU")} OC`;

export default function ContractPayments({ contractId }: { contractId: string }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Obligation[]>([]), [hasMore, setHasMore] = useState(false), [canPay, setCanPay] = useState(false);
  const [canCancel, setCanCancel] = useState(false), [cancelling, setCancelling] = useState<Obligation | null>(null), [reason, setReason] = useState("");
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Obligation | null>(null), [amount, setAmount] = useState("");
  const pending = useRef<{ fingerprint: string; requestId: string } | null>(null);
  async function fetchRows(append: boolean) {
    const response = await authFetch(`/api/contracts?${new URLSearchParams({ contractId, payments: "true", offset: String(append ? rows.length : 0) })}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Не удалось загрузить начисления");
    setRows(current => append ? [...current, ...data.obligations] : data.obligations);
    setHasMore(data.hasMore); setCanPay(data.canPay); setCanCancel(data.canCancel === true); setOpen(true);
  }
  async function load(append = false) {
    setBusy(true); setError("");
    try { await fetchRows(append); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось загрузить начисления"); }
    finally { setBusy(false); }
  }
  async function pay() {
    if (!selected) return;
    const sum = Number(amount);
    if (!Number.isSafeInteger(sum) || sum < 1 || sum > selected.remaining) { setError("Укажите целое число монет в пределах остатка долга"); return; }
    const payload = { action: "pay", obligationId: selected.id, amount: sum };
    const fingerprint = JSON.stringify(payload);
    if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, requestId: crypto.randomUUID() };
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await authFetch("/api/contracts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, requestId: pending.current.requestId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось выполнить выплату");
      setRows(current => current.map(row => row.id === selected.id ? {
        ...row, remaining: data.remaining, paid: row.amount - data.remaining,
        held: Math.max(0, row.held - sum), debt: data.remaining > 0 && row.debt,
        overdueSevenDays: data.remaining > 0 && row.overdueSevenDays,
      } : row));
      pending.current = null; setSelected(null); setAmount(""); setNotice(`Выплачено ${coins(sum)}. Остаток по начислению: ${coins(data.remaining)}.`);
      // A subsequent list failure must not be presented as a failed transfer.
      try { await fetchRows(false); }
      catch { setError("Выплата подтверждена, но список не обновился. Нажмите «Обновить начисления»."); }
    } catch (e) { setError(e instanceof TypeError ? "Нет связи с сервером. Повторите тот же платёж: повторное списание защищено." : e instanceof Error ? e.message : "Ошибка выплаты"); }
    finally { setBusy(false); }
  }
  async function cancelPayment() {
    if (!cancelling || reason.trim().length < 3) return;
    const payload = { action: "cancel_payment", obligationId: cancelling.id, reason: reason.trim() };
    const fingerprint = JSON.stringify(payload);
    if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, requestId: crypto.randomUUID() };
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await authFetch("/api/contracts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, requestId: pending.current.requestId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось отменить начисление");
      setRows(current => current.map(row => row.id === cancelling.id ? { ...row, cancelledAt: new Date().toISOString(), cancellationReason: payload.reason, held: 0, remaining: 0, debt: false, overdueSevenDays: false, returned: data.returned, recoveryDebt: data.recoveryDebt } : row));
      setNotice(`Начисление отменено. Возвращено ${coins(data.returned)}. Остаток к возврату: ${coins(data.recoveryDebt)}.`);
      pending.current = null; setCancelling(null); setReason("");
      try { await fetchRows(false); } catch { setError("Отмена подтверждена, но список не обновился. Нажмите «Обновить начисления»."); }
    } catch (e) { setError(e instanceof TypeError ? "Нет связи. Повторите отмену: повторное списание защищено." : e instanceof Error ? e.message : "Ошибка отмены"); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 border-t border-slate-700 pt-3" aria-label="Начисления по договору">
    <button type="button" className="secondary-button" disabled={busy} aria-expanded={open} onClick={() => { if (open) setOpen(false); else void load(); }}>{busy ? "Обработка…" : open ? "Скрыть начисления" : "Начисления и выплаты"}</button>
    {open && <>
      <p className="text-sm text-slate-300">Начисленное обязательство и поступление монет — разные записи. Погашение долга выбирает владелец или руководитель организации. Обычное предложение договора ещё не создаёт начислений.</p>
      {!rows.length && <p>Начислений пока нет.</p>}
      <div className="space-y-3">{rows.map(row => <div key={row.id} className="space-y-2 rounded border border-slate-700 p-3">
        <p className="font-semibold">{row.scope === "tournament" ? "Участие в целом турнире" : names[row.kind] ?? "Выплата"} · версия {row.revision}</p>
        <p className="text-sm">Срок выплаты: {new Date(row.dueAt).toLocaleString("ru-RU")}</p>
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {[["Начислено", row.amount], ["Выплачено", row.paid], ["В резерве", row.held], ["Остаток", row.remaining]].map(([label, value]) => <div key={label}><dt className="text-slate-400">{label}</dt><dd>{coins(Number(value))}</dd></div>)}
        </dl>
        {!!row.guestShares && <p className="text-sm text-slate-300">Из выплаченного: основным организациям за гостевое выступление — {coins(row.guestShares)}, игроку — {coins(row.playerPaid ?? row.paid - row.guestShares)}.</p>}
        <p className={row.overdueSevenDays ? "text-red-200" : "text-slate-300"}>{row.cancelledAt ? "Начисление отменено" : row.remaining === 0 ? "Выплачено полностью" : row.overdueSevenDays ? "Не оплачено более семи суток после срока выплаты" : row.debt ? "Ожидает оплаты" : "Срок выплаты ещё не наступил"}</p>
        {row.cancelledAt && <div className="text-sm"><p>Причина: {row.cancellationReason}</p><p>Возвращено организации: {coins(row.returned ?? 0)}. Долг игрока по возврату: {coins(row.recoveryDebt ?? 0)}.</p>{!!row.recoveryDebt && <p>Свободные поступления направляются на погашение. Зарезервированные монеты не списываются; вывод до погашения недоступен.</p>}</div>}
        {canPay && row.debt && !row.cancelledAt && !selected && !cancelling && <button type="button" className="secondary-button" disabled={busy} onClick={() => { setSelected(row); setAmount(String(row.remaining)); setError(""); setNotice(""); }}>Оплатить начисление</button>}
        {canCancel && row.kind !== "fine_refund" && !row.cancelledAt && !selected && !cancelling && <button type="button" className="secondary-button" disabled={busy} onClick={() => { setCancelling(row); setReason(""); setError(""); setNotice(""); }}>Отменить начисление</button>}
        {cancelling?.id === row.id && <div className="space-y-3 border-t border-slate-700 pt-3">
          <label className="block">Причина отмены<input className="mt-1 w-full rounded border border-slate-600 bg-slate-900 p-2" minLength={3} maxLength={1000} disabled={busy} value={reason} onChange={e => setReason(e.target.value)} /></label>
          <p className="text-sm">Неоплаченный остаток отменится, резерв освободится. Из выплаченного вернутся только свободные монеты игрока; остаток станет долгом с погашением из новых поступлений. История сохранится.</p>
          <button type="button" className="primary-button" disabled={busy || reason.trim().length < 3} onClick={() => void cancelPayment()}>Подтвердить отмену начисления</button>
          <button type="button" className="secondary-button" disabled={busy} onClick={() => setCancelling(null)}>Вернуться</button>
        </div>}
        {selected?.id === row.id && <div className="space-y-3 border-t border-slate-700 pt-3">
          <label className="block">Сумма выплаты, OC<input className="mt-1 w-full rounded border border-slate-600 bg-slate-900 p-2" type="number" min="1" max={row.remaining} step="1" disabled={busy} value={amount} onChange={e => setAmount(e.target.value)} /></label>
          <p className="text-sm">Монеты будут списаны с баланса организации и перечислены игроку по этому договору.</p>
          <div className="flex flex-wrap gap-2"><button type="button" className="primary-button" disabled={busy} onClick={() => void pay()}>Подтвердить выплату</button><button type="button" className="secondary-button" disabled={busy} onClick={() => setSelected(null)}>Отмена</button></div>
        </div>}
      </div>)}</div>
      {hasMore && <button type="button" className="secondary-button" disabled={busy} onClick={() => void load(true)}>Ещё начисления</button>}
      <button type="button" className="secondary-button" disabled={busy} onClick={() => void load()}>Обновить начисления</button>
    </>}
    {notice && <p role="status" className="text-cyan-200">{notice}</p>}
    {error && <p role="alert" className="text-red-200">{error}</p>}
  </section>;
}
