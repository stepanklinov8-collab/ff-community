"use client";
import { cancellationReasons, cancellationReasonLabels, cancellationPaymentKinds, cancellationPaymentLabels, emptyTransferCancellation, type TransferCancellation } from "../transfer-cancellation";
import { describeOrdinaryCompensation } from "../ordinary-compensation";
import OrdinaryCompensationField from "./OrdinaryCompensationField";

export function TransferCancellationSummary({ value }: { value?: TransferCancellation }) {
  if (!value) return <p>Возврат выплат при отмене перехода не согласован в этой редакции. Автоматические условия задним числом не добавляются.</p>;
  return <div className="space-y-2"><p className="font-semibold">Выплаты при отмене завершённого перехода</p>
    {cancellationReasons.map(reason => {
      const returned = cancellationPaymentKinds.filter(kind => value[reason][kind].kind !== "none");
      return <div key={reason}><p className="font-semibold">{cancellationReasonLabels[reason]}</p>
        {returned.length ? <><ul className="list-disc space-y-1 pl-5">{returned.map(kind => <li key={kind}>{cancellationPaymentLabels[kind]}: возврат — {describeOrdinaryCompensation(value[reason][kind], "от фактически полученной суммы этого вида")}</li>)}</ul>
          {returned.length < cancellationPaymentKinds.length && <p>Остальные виды выплат остаются игроку.</p>}</> : <p>Все виды полученных выплат остаются игроку.</p>}
      </div>;
    })}
    <p>Возвращается не больше фактически полученного по этому договору, с учётом прежних возвратов. Процент считается отдельно по каждому виду, с округлением вниз. Цена перехода возвращается отдельно; прежний договор не восстанавливается.</p>
  </div>;
}

export default function TransferCancellationEditor({ value, onChange }: { value?: TransferCancellation; onChange: (value: TransferCancellation | undefined) => void }) {
  return <fieldset className="space-y-3"><legend className="font-semibold">Последствия отмены перехода</legend>
    <label className="flex items-start gap-2"><input type="checkbox" checked={!!value} onChange={event => onChange(event.target.checked ? emptyTransferCancellation() : undefined)} />Указать возврат выплат по причинам отмены</label>
    <p className="text-sm text-slate-300">Условия согласуются до подписания. При споре причину устанавливает администратор, при обоюдной отмене её подтверждают стороны. Возвраты не заменяют отдельно согласованные штрафы и компенсации.</p>
    {value && cancellationReasons.map(reason => <details key={reason} className="rounded border border-slate-700 p-3">
      <summary className="cursor-pointer font-semibold">{cancellationReasonLabels[reason]}</summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">{cancellationPaymentKinds.map(kind => <OrdinaryCompensationField key={kind} label={cancellationPaymentLabels[kind]} value={value[reason][kind]}
        basis="от полученной суммы этого вида" noneLabel="Оставить игроку" onChange={rule => onChange({ ...value, [reason]: { ...value[reason], [kind]: rule } })} />)}</div>
    </details>)}
    {value && <p className="text-sm text-slate-300">Ноль или «Оставить игроку» означает отсутствие возврата. Фиксированная сумма и выбранное большее/меньшее значение ограничены фактически полученным по этому виду выплат. Старый договор при отмене перехода не возобновляется.</p>}
  </fieldset>;
}
