"use client";

import { useRef, useState } from "react";
import { authFetch } from "@/platform/browser-services";

type Mode = "mutual" | "decline" | "player_exit" | "organization" | "unpaid";
type Quote = { active: boolean; revision: number; isPlayer: boolean; canManage: boolean; playerExitAmount: number; organizationAmount: number; unpaidAmount: number; debt: number; overdueSevenDays: boolean;
  pending: null | { id: string; playerSigned: boolean; organizationSigned: boolean } };
const coins = (amount: number) => `${amount.toLocaleString("ru-RU")} OC`;

export default function ContractTermination({ contractId, onEnded }: { contractId: string; onEnded: () => void }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [quote, setQuote] = useState<Quote | null>(null);
  const [mode, setMode] = useState<Mode>("mutual"), [confirm, setConfirm] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [party, setParty] = useState<"player" | "organization">("player");
  const pending = useRef<{ fingerprint: string; requestId: string } | null>(null);
  async function load() {
    setBusy(true); setError(""); setConfirm(false);
    try {
      const response = await authFetch(`/api/contracts?${new URLSearchParams({ contractId, termination: "true" })}`), data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось проверить договор");
      setQuote(data); setOpen(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Ошибка загрузки"); }
    finally { setBusy(false); }
  }
  async function submit(actionMode = mode) {
    if (!quote) return;
    const expectedAmount = actionMode === "player_exit" ? quote.playerExitAmount : actionMode === "organization" ? quote.organizationAmount : null;
    const payload = { action: "terminate", contractId, revision: quote.revision, mode: actionMode, expectedAmount,
      party: actionMode === "mutual" ? (quote.isPlayer && quote.canManage ? party : quote.isPlayer ? "player" : "organization") : null };
    const fingerprint = JSON.stringify(payload);
    if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, requestId: crypto.randomUUID() };
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await authFetch("/api/contracts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, requestId: pending.current.requestId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось завершить договор");
      pending.current = null; setConfirm(false);
      if (data.ended) { setQuote({ ...quote, active: false }); setNotice(`Договор завершён. Компенсация: ${coins(data.amount)}. Начисленная задолженность сохраняется. Членство в составе не изменилось.`); onEnded(); }
      else { setNotice(data.pending ? "Ваше согласие сохранено. Договор действует до согласия второй стороны." : "Предложение расторжения отклонено."); await load(); }
    } catch (caught) { setError(caught instanceof TypeError ? "Нет связи с сервером. Повторите подтверждение: повторное списание защищено." : caught instanceof Error ? caught.message : "Ошибка расторжения"); }
    finally { setBusy(false); }
  }
  const amount = quote && (mode === "player_exit" ? quote.playerExitAmount : mode === "organization" ? quote.organizationAmount : mode === "unpaid" ? quote.unpaidAmount : 0);
  return <section className="space-y-3">
    <button type="button" className="secondary-button" disabled={busy} onClick={() => open ? setOpen(false) : void load()}>Расторжение договора</button>
    {notice && <p role="status" className="text-sm text-cyan-200">{notice}</p>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {open && quote && <div role="region" aria-label="Расторжение договора" className="space-y-3 rounded-lg border border-slate-600 p-4">
      {!quote.active ? <p>Действующего договора нет.</p> : <>
        <p>Подписанная редакция {quote.revision}. Непогашенные начисления: {coins(quote.debt)}.</p>
        {quote.pending && <p>Предложено расторжение по взаимному согласию. Согласие игрока: {quote.pending.playerSigned ? "есть" : "ожидается"}; организации: {quote.pending.organizationSigned ? "есть" : "ожидается"}.</p>}
        <label className="block">Основание расторжения<select className="mt-1 w-full rounded border border-slate-600 bg-slate-900 p-2" disabled={busy} value={mode} onChange={event => { setMode(event.target.value as Mode); setConfirm(false); }}>
          <option value="mutual">По взаимному согласию — без штрафа</option>
          {quote.isPlayer && <option value="player_exit">По инициативе игрока — с оплатой компенсации</option>}
          {quote.canManage && <option value="organization">По инициативе организации — с выплатой игроку</option>}
          {quote.isPlayer && quote.overdueSevenDays && <option value="unpaid">Из-за задолженности более семи суток</option>}
        </select></label>
        {mode === "mutual" && quote.isPlayer && quote.canManage && <label className="block">Подтверждаю как<select className="mt-1 w-full rounded border border-slate-600 bg-slate-900 p-2" disabled={busy} value={party} onChange={event => { setParty(event.target.value as "player" | "organization"); setConfirm(false); }}><option value="player">Игрок</option><option value="organization">Представитель организации</option></select></label>}
        <p>{mode === "player_exit" ? `Со свободного личного баланса игрока на счёт организации будет переведено ${coins(amount ?? 0)}. При нехватке монет договор продолжит действовать.` : mode === "organization" ? `Игроку причитается ${coins(amount ?? 0)} со счёта организации. Неоплаченный остаток сохраняется как долг.` : mode === "unpaid" ? `Штраф за выход не применяется. Сохраняются заработанное и долг, дополнительно начисляется компенсация по договору (сейчас ${coins(amount ?? 0)}).` : "Обе стороны подтверждают расторжение. До второго согласия договор продолжает действовать."}</p>
        <p className="text-sm text-slate-300">Зарплата начисляется до момента завершения. Заработанные выплаты сохраняются; договор автоматически не возобновляется. Участник остаётся в составе.</p>
        {!confirm ? <button type="button" className="primary-button" disabled={busy} onClick={() => setConfirm(true)}>Проверить и подтвердить расторжение</button> : <div className="flex flex-wrap gap-3">
          <button type="button" className="primary-button" disabled={busy} onClick={() => void submit()}>Подтвердить выбранное расторжение</button>
          <button type="button" className="secondary-button" disabled={busy} onClick={() => setConfirm(false)}>Назад</button>
        </div>}
        {quote.pending && <button type="button" className="secondary-button" disabled={busy} onClick={() => void submit("decline")}>Отклонить взаимное расторжение</button>}
        <button type="button" className="secondary-button" disabled={busy} onClick={() => void load()}>Обновить расчёт расторжения</button>
      </>}
    </div>}
  </section>;
}
