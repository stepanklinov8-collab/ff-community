"use client";
import type { Compensation } from "../ordinary-compensation";
import { describeOrdinaryCompensation } from "../ordinary-compensation";
const inputClass = "w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-white";
export default function OrdinaryCompensationField({ label, value, onChange, basis, allowCombined = true, noneLabel = "Без компенсации" }: {
  label: string; value: Compensation; onChange: (value: Compensation) => void; basis: string; allowCombined?: boolean; noneLabel?: string;
}) {
  return <fieldset className="space-y-2"><legend className="text-sm font-semibold">{label}</legend>
    <select aria-label={label} className={inputClass} value={value.kind} onChange={event => onChange(event.target.value === "none" ? { kind: "none" } : event.target.value === "fixed" ? { kind: "fixed", amount: 0 } : event.target.value === "combined" ? { kind: "combined", amount: 0, basisPoints: 0, selection: "maximum" } : { kind: "percent", basisPoints: 0 })}>
      <option value="none">{noneLabel}</option><option value="fixed">Фиксированная сумма</option><option value="percent">Процент {basis}</option>
      {allowCombined && <option value="combined">Выбор из суммы и процента</option>}
    </select>
    {(value.kind === "fixed" || value.kind === "combined") && <label className="block text-sm">Сумма, OC
      <input className={inputClass} type="number" min="0" max={1_000_000_000_000} step={1} value={value.amount} onChange={event => onChange({ ...value, amount: Number(event.target.value) })} />
    </label>}
    {(value.kind === "percent" || value.kind === "combined") && <label className="block text-sm">Процент
      <input className={inputClass} type="number" min="0" max={100} step={0.01} value={value.basisPoints / 100} onChange={event => onChange({ ...value, basisPoints: Math.round(Number(event.target.value) * 100) })} />
    </label>}
    {value.kind === "combined" && <><label className="block text-sm">Как выбрать компенсацию
      <select aria-label="Как выбрать компенсацию" className={inputClass} value={value.selection} onChange={event => onChange({ ...value, selection: event.target.value as "maximum" | "minimum" })}>
        <option value="maximum">Большее значение</option><option value="minimum">Меньшее значение</option>
      </select></label><p className="text-xs text-slate-300">{describeOrdinaryCompensation(value, basis)}.</p></>}
  </fieldset>;
}
