"use client";

import { useState } from "react";
import Link from "next/link";
import { authFetch } from "@/platform/browser-services";
import { financialTermsSchema, type FinancialTerms, type EventOverride } from "../financial-terms";
import { describeTerminationCompensation, type TerminationCompensation } from "../termination-compensation";

const inputClass = "w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-white";
const money = (value: number) => `${value.toLocaleString("ru-RU")} OC`;
const rateLabels = { perGame: "За сыгранную игру", perSession: "За сыгранную сессию", perTournament: "За сыгранный турнир", perKill: "За личный килл", perMvp: "За MVP сессии" } as const;
const overrideLabels = { trainingShareBps: "Доля тренировок, %", tournamentShareBps: "Доля турнира, %", personalShareBps: "Доля личных наград, %", ...rateLabels };
const rankingLabels = { organizations: "Все организации", teams: "Команды", guilds: "Гильдии" };
const rankingModes = { at_end: "На конец периода", best: "Лучшее место за период", throughout: "Удержание весь период" };
function localDate(iso: string) {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function Amount({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="block text-sm">{label}, OC<input required className={inputClass} type="number" min="0" max="1000000000000" step="1" value={value} onChange={e => onChange(Number(e.target.value))} /></label>;
}

function OverdueEditor({ value, onChange }: { value: TerminationCompensation; onChange: (v: TerminationCompensation) => void }) {
  return <fieldset className="space-y-3"><legend className="mb-2 font-semibold">Компенсация игроку за просрочку</legend>
    <p className="text-sm text-slate-300">После семи суток неоплаты игрок может расторгнуть договор без штрафа. Долг и заработанное до расторжения сохраняются. Дополнительная компенсация задаётся ниже.</p>
    <label className="block">Способ компенсации<select className={inputClass} value={value.kind} onChange={e => {
      const kind = e.target.value;
      onChange(kind === "none" ? { kind: "none" } : kind === "fixed" ? { kind: "fixed", amount: 0 } : kind === "percent" ? { kind: "percent", basisPoints: 0, base: { kind: "contract_debt" } } : { kind: "combined", amount: 0, basisPoints: 0, base: { kind: "contract_debt" }, selection: "maximum" });
    }}><option value="none">Без дополнительной компенсации</option><option value="fixed">Фиксированная сумма</option><option value="percent">Процент</option><option value="combined">Сумма и процент: сравнить</option></select></label>
    <div className="grid gap-3 sm:grid-cols-2">
      {(value.kind === "fixed" || value.kind === "combined") && <Amount label="Фиксированная компенсация" value={value.amount} onChange={amount => onChange({ ...value, amount })} />}
      {(value.kind === "percent" || value.kind === "combined") && <>
        <label>Процент компенсации<input required className={inputClass} type="number" min="0" max="100" step="0.01" value={value.basisPoints / 100} onChange={e => onChange({ ...value, basisPoints: Math.round(Number(e.target.value) * 100) })} /></label>
        <label>База процента<select className={inputClass} value={value.base.kind} onChange={e => onChange({ ...value, base: e.target.value === "specified" ? { kind: "specified", amount: 0 } : { kind: e.target.value as "player_value" | "contract_debt" } })}><option value="contract_debt">Вся задолженность по договору</option><option value="player_value">Стоимость игрока при расторжении</option><option value="specified">Указанная в договоре сумма</option></select></label>
        {value.base.kind === "specified" && <Amount label="Сумма для расчёта процента" value={value.base.amount} onChange={amount => onChange({ ...value, base: { kind: "specified", amount } })} />}
      </>}
      {value.kind === "combined" && <label>Выбрать из суммы и процента<select className={inputClass} value={value.selection} onChange={e => onChange({ ...value, selection: e.target.value as "maximum" | "minimum" })}><option value="maximum">Большее значение</option><option value="minimum">Меньшее значение</option></select></label>}
    </div>
  </fieldset>;
}

export function FinancialTermsSummary({ value }: { value: FinancialTerms }) {
  const parsed = financialTermsSchema.safeParse(value);
  if (!parsed.success) return <p className="text-amber-200">Проверьте поля выплат: {parsed.error.issues[0].message}</p>;
  return <div className="space-y-3 text-sm">
    <p>При первом подписании: {money(value.signingAmount)}. Приветственный бонус и оплата выкупа не повторяются при продлении. {value.salary ? `Зарплата ${money(value.salary.amount)} каждые ${value.salary.periodDays} суток от начала договора, в конце периода. Неполный последний период — пропорционально времени, с округлением вниз.` : "Регулярная зарплата не предусмотрена."}</p>
    <p>{Object.entries(rateLabels).map(([key, label]) => `${label}: ${money(value.rates[key as keyof typeof rateLabels])}`).join(" · ")}</p>
    <p>{describeTerminationCompensation(value.overdueCompensation)}</p>
    <p>При первоначальном подписании резервируются разовая оплата и первый период зарплаты. Продление не резервирует первоначальный бонус или оплату выкупа повторно. При долге договор продолжает действовать; погашение выбирает руководитель или владелец. Вывод организации при долге запрещён.</p>
    {value.rankingBonuses.map(row => <p key={row.id}>Бонус {money(row.amount)}: «{rankingLabels[row.ranking]}», топ-{row.top}, {rankingModes[row.mode].toLowerCase()}, {new Date(row.startsAt).toLocaleString("ru-RU")} — {new Date(row.endsAt).toLocaleString("ru-RU")}.</p>)}
    {value.eventOverrides.map((row, index) => <p key={row.eventId}>Исключение {index + 1} · <Link className="text-cyan-300 underline" href={`/tournaments/${row.eventId}`}>Открыть мероприятие</Link>: {Object.entries(row.values).map(([key, amount]) => `${overrideLabels[key as keyof typeof overrideLabels]}: ${key.endsWith("Bps") ? `${amount! / 100}%` : money(amount!)}`).join("; ")}. Заменяет только указанные общие условия.</p>)}
  </div>;
}

export default function FinancialTermsEditor({ value, onChange, startsAt, endsAt, organizationId }: {
  value: FinancialTerms; onChange: (value: FinancialTerms) => void; startsAt: string; endsAt: string | null; organizationId: string;
}) {
  const [search, setSearch] = useState("");
  const [choices, setChoices] = useState<{ id: string; title: string }[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function searchEvents() {
    setBusy(true); setError(""); setChoices([]);
    try {
      const response = await authFetch(`/api/contracts?${new URLSearchParams({ organizationId, search, searchKind: "events" })}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось найти мероприятие");
      setChoices(data.items); if (!data.items.length) setError("Мероприятий не найдено");
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка поиска"); }
    finally { setBusy(false); }
  }
  function updateOverride(index: number, values: EventOverride["values"]) {
    onChange({ ...value, eventOverrides: value.eventOverrides.map((row, i) => i === index ? { ...row, values } : row) });
  }
  return <div className="space-y-6 border-t border-slate-700 pt-5">
    <h3 className="text-lg font-bold">Оплата и дополнительные бонусы</h3>
    <p className="text-sm text-slate-300">Суммы выплачивает организация сверх доли призовых. Ноль означает отсутствие выплаты. Сохранение предложения пока не резервирует и не переводит монеты.</p>
    <Amount label="Разовая оплата при первом подписании" value={value.signingAmount} onChange={signingAmount => onChange({ ...value, signingAmount })} />
    <p className="text-sm text-slate-300">Этот бонус относится к первоначальному заключению договора. Продление срока и изменение версии не создают его повторно и не повторяют оплату выкупа.</p>
    <fieldset className="space-y-3"><legend className="font-semibold">Регулярная зарплата</legend>
      <label className="flex items-center gap-2"><input type="checkbox" checked={!!value.salary} onChange={e => onChange({ ...value, salary: e.target.checked ? { amount: 0, periodDays: 7 } : null })} />Предусмотреть зарплату</label>
      {value.salary && <div className="grid gap-3 sm:grid-cols-2"><Amount label="Зарплата за период" value={value.salary.amount} onChange={amount => onChange({ ...value, salary: { ...value.salary!, amount } })} />
        <label>Период зарплаты, суток<input required className={inputClass} type="number" min="1" max="1000000" step="1" value={value.salary.periodDays} onChange={e => onChange({ ...value, salary: { ...value.salary!, periodDays: Number(e.target.value) } })} /></label></div>}
    </fieldset>
    <div className="grid gap-3 sm:grid-cols-2">{Object.entries(rateLabels).map(([key, label]) => <Amount key={key} label={label} value={value.rates[key as keyof typeof rateLabels]} onChange={amount => onChange({ ...value, rates: { ...value.rates, [key]: amount } })} />)}</div>
    <OverdueEditor value={value.overdueCompensation} onChange={overdueCompensation => onChange({ ...value, overdueCompensation })} />
    <fieldset className="space-y-3"><legend className="font-semibold">Бонусы за рейтинг своей организации</legend>
      {value.rankingBonuses.map((row, index) => {
        const patch = (fields: Partial<typeof row>) => onChange({ ...value, rankingBonuses: value.rankingBonuses.map((v, i) => i === index ? { ...v, ...fields } : v) });
        return <div className="space-y-3 rounded border border-slate-700 p-3" key={row.id}>
          <p className="font-semibold">Рейтинговый бонус {index + 1}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>Таблица рейтинга<select className={inputClass} value={row.ranking} onChange={e => patch({ ranking: e.target.value as typeof row.ranking })}>{Object.entries(rankingLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label>Проверка места<select className={inputClass} value={row.mode} onChange={e => patch({ mode: e.target.value as typeof row.mode })}>{Object.entries(rankingModes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label>Войти в топ<input required className={inputClass} type="number" min="1" max="1000000" value={row.top} onChange={e => patch({ top: Number(e.target.value) })} /></label>
            <Amount label="Сумма рейтингового бонуса" value={row.amount} onChange={amount => patch({ amount })} />
            <label>Начало периода рейтинга<input required className={inputClass} type="datetime-local" value={localDate(row.startsAt)} onChange={e => { if (e.target.value) patch({ startsAt: new Date(e.target.value).toISOString() }); }} /></label>
            <label>Конец периода рейтинга<input required className={inputClass} type="datetime-local" value={localDate(row.endsAt)} onChange={e => { if (e.target.value) patch({ endsAt: new Date(e.target.value).toISOString() }); }} /></label>
          </div>
          <button type="button" className="secondary-button" onClick={() => onChange({ ...value, rankingBonuses: value.rankingBonuses.filter((_, i) => i !== index) })}>Удалить рейтинговый бонус</button>
        </div>;
      })}
      <button type="button" disabled={value.rankingBonuses.length >= 20} className="secondary-button" onClick={() => onChange({ ...value, rankingBonuses: [...value.rankingBonuses, { id: crypto.randomUUID(), ranking: "organizations", mode: "at_end", top: 3, amount: 0, startsAt, endsAt: endsAt ?? new Date(Date.parse(startsAt) + 7 * 86400000).toISOString() }] })}>Добавить бонус за рейтинг</button>
    </fieldset>
    <fieldset className="space-y-3"><legend className="font-semibold">Исключения для мероприятий</legend>
      <p className="text-sm text-slate-300">Отметьте только заменяемые условия. Явный ноль отменяет соответствующую выплату для этого мероприятия. Остальные условия, включая зарплату, сохраняются.</p>
      {value.eventOverrides.map((row, index) => <div key={row.eventId} className="space-y-3 rounded border border-slate-700 p-3">
        <Link className="text-cyan-300 underline" href={`/tournaments/${row.eventId}`}>{names[row.eventId] ?? `Мероприятие ${index + 1}`}</Link>
        <div className="grid gap-3 sm:grid-cols-2">{Object.entries(overrideLabels).map(([key, label]) => {
          const typedKey = key as keyof EventOverride["values"], selected = row.values[typedKey] !== undefined, percent = key.endsWith("Bps");
          return <div key={key}><label className="flex items-start gap-2"><input type="checkbox" checked={selected} onChange={e => {
            const fields = { ...row.values }; if (e.target.checked) fields[typedKey] = 0; else delete fields[typedKey]; updateOverride(index, fields);
          }} />Заменить: {label}</label>{selected && <label className="block text-sm">{label} — исключение<input required className={inputClass} type="number" min="0" max={percent ? 100 : 1000000000000} step={percent ? 0.01 : 1} value={row.values[typedKey]! / (percent ? 100 : 1)} onChange={e => updateOverride(index, { ...row.values, [key]: percent ? Math.round(Number(e.target.value) * 100) : Number(e.target.value) })} /></label>}</div>;
        })}</div>
        <button type="button" className="secondary-button" onClick={() => onChange({ ...value, eventOverrides: value.eventOverrides.filter((_, i) => i !== index) })}>Удалить исключение</button>
      </div>)}
      <div className="flex flex-wrap gap-2"><input aria-label="Поиск мероприятия для исключения" className={`${inputClass} min-w-0 flex-1`} value={search} onChange={e => setSearch(e.target.value)} placeholder="Название мероприятия" /><button type="button" className="secondary-button" disabled={busy || search.trim().length < 2 || value.eventOverrides.length >= 20} onClick={() => void searchEvents()}>Найти мероприятие</button></div>
      {error && <p role="alert" className="text-amber-200">{error}</p>}
      <ul>{choices.map(choice => <li key={choice.id}><button type="button" className="secondary-button my-1" disabled={value.eventOverrides.some(row => row.eventId === choice.id) || value.eventOverrides.length >= 20} onClick={() => {
        setNames(current => ({ ...current, [choice.id]: choice.title }));
        onChange({ ...value, eventOverrides: [...value.eventOverrides, { eventId: choice.id, values: {} }] }); setChoices([]);
      }}>{choice.title}</button></li>)}</ul>
    </fieldset>
  </div>;
}
