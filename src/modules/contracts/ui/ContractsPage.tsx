"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { authFetch } from "@/platform/browser-services";
import { contractTermsSchema, defaultTerms, defaultRentalTerms, toConstructorTerms, type ConstructorTerms, type Compensation, type ContractListItem, type ContractTerms, type ContractVersion } from "../model";
import FinancialTermsEditor, { FinancialTermsSummary } from "./FinancialTermsEditor";
import ContractPayments from "./ContractPayments";
import ContractFines from "./ContractFines";
import ContractTermination from "./ContractTermination";
import GuestApprovals, { GuestRequirements, GuestScopeEditor } from "./GuestContracts";
import {RentalConditionsEditor,RentalPayments,RentalIncoming} from "./RentalConditions";

type Organization = { id: string; name: string; type: string; canOffer: boolean };
type Choice = { id: string; nickname?: string; title?: string };
type Editor = { id: string; revision: number; organizationId: string; playerId: string; playerName: string; kind: "main" | "guest"; eventId: string | null; eventTitle: string; sessionId: string | null; terms: ConstructorTerms };
const inputClass = "w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-white";
const statusNames = { draft: "Черновик", offered: "Предложен игроку", signed: "Подписан", completed: "Завершён", rejected: "Отклонён", cancelled: "Отозван", superseded: "Заменён новой версией" };
const number = (value: number) => value.toLocaleString("ru-RU");
const percentage = (bps: number) => number(bps / 100) + "%";
const feeText = (fee: Compensation, basis: string) => fee.kind === "none" ? "Без компенсации" : fee.kind === "fixed" ? `${number(fee.amount)} OC` : `${percentage(fee.basisPoints)} ${basis}`;
function localDate(iso: string) {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function FeeInput({ label, value, onChange, basis }: { label: string; value: Compensation; onChange: (value: Compensation) => void; basis: string }) {
  return <fieldset className="space-y-2"><legend className="text-sm font-semibold">{label}</legend>
    <select aria-label={label} className={inputClass} value={value.kind} onChange={event => onChange(event.target.value === "none" ? { kind: "none" } : event.target.value === "fixed" ? { kind: "fixed", amount: 0 } : { kind: "percent", basisPoints: 0 })}>
      <option value="none">Без компенсации</option><option value="fixed">Фиксированная сумма</option><option value="percent">Процент {basis}</option>
    </select>
    {value.kind !== "none" && <label className="block text-sm">{value.kind === "fixed" ? "Сумма, OC" : "Процент"}
      <input className={inputClass} type="number" min="0" max={value.kind === "fixed" ? 1_000_000_000_000 : 100} step={value.kind === "fixed" ? 1 : 0.01}
        value={value.kind === "fixed" ? value.amount : value.basisPoints / 100}
        onChange={event => onChange(value.kind === "fixed" ? { kind: "fixed", amount: Number(event.target.value) } : { kind: "percent", basisPoints: Math.round(Number(event.target.value) * 100) })} />
    </label>}
  </fieldset>;
}
function TermsSummary({ terms }: { terms: ContractTerms }) {
  const tournamentLimit = terms.limit?.unit === "tournaments";
  return <dl className="grid gap-3 text-sm sm:grid-cols-2">
    <div><dt className="text-slate-400">Действует</dt><dd>{new Date(terms.startsAt).toLocaleString("ru-RU")} — {terms.endsAt ? new Date(terms.endsAt).toLocaleString("ru-RU") : "бессрочно"}</dd></div>
    <div><dt className="text-slate-400">Количество выступлений</dt><dd>{terms.limit ? <>{number(terms.limit.count)} · {{ sessions: "сессии", games: "игры", trainings: "тренировки", tournaments: "турниры" }[terms.limit.unit]}. {(terms.limit.completion ?? "contract") === "contract" ? (tournamentLimit ? "Договор заканчивается после завершения последнего турнира; зарплата начисляется до его окончания." : "Договор заканчивается после последней сессии; зарплата начисляется до её окончания.") : "После лимита оплата выступлений заканчивается; договор и зарплата действуют до указанного срока."} {tournamentLimit ? "Турнир засчитывается один раз после завершения всех этапов. Участие только в отборе считается, если выполнено правило участия договора. Полная неявка не расходует лимит." : "Неявка не расходует лимит, последняя сессия оплачивается полностью."} При продлении счёт начинается заново.</> : "Без ограничения"}</dd></div>
    <div><dt className="text-slate-400">Доля игрока</dt><dd>Тренировки {percentage(terms.trainingShareBps)} · Турниры {percentage(terms.tournamentShareBps)}</dd></div>
    <div><dt className="text-slate-400">Личные награды</dt><dd>Игроку {percentage(terms.personalShareBps)}, организации {percentage(10000 - terms.personalShareBps)}</dd></div>
    <div><dt className="text-slate-400">Участие</dt><dd>{terms.participation.mode === "any" ? "Полная доля при любом участии" : terms.participation.mode === "proportional" ? "Пропорционально сыгранным играм" : `Минимум ${terms.participation.games} игр. При меньшем участии нет доли призовых, оплаты игр/сессии и бонусов за киллы/MVP этой сессии.`}</dd></div>
    <div><dt className="text-slate-400">Переход в другой состав</dt><dd>{feeText(terms.transfer, "от цены перехода")}. {terms.transferRequiresConsent ? "Нужно согласие организации" : "Согласие при выполнении условий не требуется"}</dd></div>
    <div><dt className="text-slate-400">Выход по инициативе игрока</dt><dd>{feeText(terms.playerExit, "от стоимости игрока на момент оплаты")}</dd></div>
    <div><dt className="text-slate-400">Расторжение организацией</dt><dd>{feeText(terms.organizationTermination, "от стоимости игрока на момент оплаты")} игроку. По обоюдному согласию — без штрафа.</dd></div>
    <div><dt className="text-slate-400">Гостевые выступления</dt><dd>{{ forbidden: "Запрещены", allowed: "Разрешены", consent: "С согласия организации" }[terms.guestPolicy]} · {feeText(terms.guestCompensation, "от выплаты игроку")}</dd></div>
    {"note" in terms && terms.note && <div className="sm:col-span-2"><dt className="text-slate-400">Историческое пояснение — не переносится в новые условия</dt><dd className="whitespace-pre-wrap break-words">{terms.note}</dd></div>}
    {"financial" in terms && <div className="sm:col-span-2"><dt className="mb-2 font-semibold">Оплата и бонусы</dt><dd><FinancialTermsSummary value={terms.financial} /></dd></div>}
  </dl>;
}

function ContractHistory({ contractId }: { contractId: string }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [versions, setVersions] = useState<ContractVersion[]>([]), [hasMore, setHasMore] = useState(false);
  async function fetchHistory(append: boolean) {
    setBusy(true); setError("");
    try {
      const response = await authFetch(`/api/contracts?${new URLSearchParams({ contractId, history: "true", offset: String(append ? versions.length : 0) })}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось загрузить историю");
      setVersions(current => append ? [...current, ...data.versions] : data.versions); setHasMore(data.hasMore); setOpen(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Ошибка загрузки истории"); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3 border-t border-slate-700 pt-3">
    <button className="secondary-button" type="button" disabled={busy} aria-expanded={open} onClick={() => { if (open) setOpen(false); else void fetchHistory(false); }}>{busy ? "Загрузка истории…" : open ? "Скрыть историю" : "История условий"}</button>
    {error && <p role="alert" className="text-red-200">{error}</p>}
    {open && <div className="space-y-3">{versions.map(version => <details key={version.revision} className="rounded border border-slate-700 p-3">
      <summary className="cursor-pointer">Версия {version.revision} · {statusNames[version.status]} · {new Date(version.offeredAt ?? version.createdAt).toLocaleString("ru-RU")}</summary>
      <div className="mt-4"><TermsSummary terms={version.terms} /></div>
    </details>)}{hasMore && <button type="button" className="secondary-button" disabled={busy} onClick={() => void fetchHistory(true)}>Ещё версии</button>}</div>}
  </div>;
}

export default function ContractsPage() {
  const params = useSearchParams();
  const selectedId = params.get("contractId"), selectedOrganization = params.get("organizationId");
  const [contracts, setContracts] = useState<ContractListItem[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [offset, setOffset] = useState(0), [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [accepting, setAccepting] = useState<(ContractListItem & { terms: ConstructorTerms }) | null>(null);
  const [guestReady, setGuestReady] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const pendingOperation = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const [search, setSearch] = useState(""), [choices, setChoices] = useState<Choice[]>([]);
  const [searchKind, setSearchKind] = useState<"players" | "events">("players");
  const fetchContracts = useCallback(async () => {
    const query = new URLSearchParams({ offset: String(offset) });
    if (selectedId) query.set("contractId", selectedId);
    if (selectedOrganization) query.set("organizationId", selectedOrganization);
    const response = await authFetch(`/api/contracts?${query}`), data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Не удалось загрузить договоры");
    return data as { contracts: ContractListItem[]; organizations: Organization[]; hasMore: boolean };
  }, [offset, selectedId, selectedOrganization]);
  const load = useCallback(async () => {
    try {
      const data = await fetchContracts();
      setContracts(data.contracts); setOrganizations(data.organizations); setHasMore(data.hasMore);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Ошибка загрузки"); }
    finally { setLoading(false); }
  }, [fetchContracts]);
  useEffect(() => {
    let cancelled = false;
    void fetchContracts().then(data => {
      if (!cancelled) { setContracts(data.contracts); setOrganizations(data.organizations); setHasMore(data.hasMore); setError(""); }
    }).catch(caught => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Ошибка загрузки"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchContracts]);
  useEffect(() => {
    if (!editor) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [editor]);
  async function mutate(input: Record<string, unknown>) {
    setBusy(true); setError(""); setNotice("");
    const fingerprint = JSON.stringify(input);
    if (pendingOperation.current?.fingerprint !== fingerprint) pendingOperation.current = { fingerprint, requestId: crypto.randomUUID() };
    try {
      const response = await authFetch("/api/contracts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, requestId: pendingOperation.current.requestId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось сохранить договор");
      pendingOperation.current = null;
      if (input.action === "accept") setAccepting(null);
      setEditor(null); setConfirmClose(false); setNotice(input.action === "save" ? "Черновик сохранён" : input.action === "offer" ? "Условия направлены игроку" : input.action === "accept" ? "Вы подписали договор. Его финансовые условия закреплены." : "Действие сохранено");
      await load();
    } catch (caught) { setError(caught instanceof TypeError ? "Нет связи с сервером. Проверьте соединение и повторите сохранение." : caught instanceof Error ? caught.message : "Ошибка сохранения"); }
    finally { setBusy(false); }
  }
  async function findChoices() {
    if (!editor || search.trim().length < 2) return;
    setError(""); setBusy(true);
    try {
      const response = await authFetch(`/api/contracts?${new URLSearchParams({ organizationId: editor.organizationId, search, searchKind })}`), data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Ошибка поиска");
      setChoices(data.items);
      if (!data.items.length) setNotice("Ничего не найдено");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Ошибка поиска"); }
    finally { setBusy(false); }
  }
  const terms = editor?.terms;
  function updateTerms(patch: Partial<ConstructorTerms>) { setEditor(current => current ? { ...current, terms: { ...current.terms, ...patch } } : null); }
  return <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6">
    <section className="cyber-card space-y-3 p-5 sm:p-8">
      <h1 className="section-title">Контракты</h1>
      <p className="text-slate-300">Условия участия, доли призовых и обязательства перед организацией. Каждое изменение сохраняется новой версией.</p>
      <p className="text-sm text-slate-300">Договор действует после подписания обеими сторонами, не раньше указанной даты. Первоначальная выплата начисляется один раз; при продлении резервируется зарплата по новым условиям с учётом сохранённого календаря. Неподписанные условия не создают обязательств.</p>
      <Link href="/my-organizations" className="text-cyan-300 hover:underline">Мои организации</Link>
      {organizations.length > 0 && !editor && <button className="primary-button ml-3" type="button" onClick={() => {
        setError(""); setNotice(""); setChoices([]); setSearch("");
        setEditor({ id: crypto.randomUUID(), revision: 0, organizationId: selectedOrganization ?? organizations[0].id, playerId: "", playerName: "", kind: "main", eventId: null, eventTitle: "", sessionId: null, terms: defaultTerms() });
      }}>Создать договор</button>}
    </section>
    {error && <p role="alert" className="rounded border border-red-500/50 bg-red-950 p-4 text-red-100">{error}</p>}
    {notice && <p role="status" className="cyber-card p-4 text-cyan-200">{notice}</p>}
    <GuestApprovals />
    <RentalIncoming />
    {editor && terms && <form className="cyber-card space-y-6 p-5" onSubmit={event => {
      event.preventDefault();
      const parsed = contractTermsSchema.safeParse(terms);
      if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
      if (!editor.playerId || (editor.kind === "guest" && !editor.eventId)) { setError("Выберите игрока и мероприятие для гостевого выступления"); return; }
      void mutate({ action: "save", contractId: editor.id, expectedRevision: editor.revision, organizationId: editor.organizationId, playerId: editor.playerId, kind: editor.kind, eventId: editor.eventId, sessionId: editor.sessionId, terms: parsed.data });
    }}>
      <h2 className="text-xl font-bold">{editor.revision ? `Новая версия договора №${editor.revision + 1}` : "Новый договор"}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>Организация<select required disabled={editor.revision > 0} className={inputClass} value={editor.organizationId} onChange={event => { setEditor({ ...editor, organizationId: event.target.value, playerId: "", playerName: "" }); setChoices([]); }}>{organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label>
        <label>Вид договора<select disabled={editor.revision > 0} className={inputClass} value={editor.kind} onChange={event => {const defaults=event.target.value==="guest"?defaultRentalTerms():defaultTerms();setEditor({ ...editor, kind: event.target.value as Editor["kind"], eventId: null, sessionId: null, eventTitle: "",terms:{...editor.terms,trainingShareBps:defaults.trainingShareBps,tournamentShareBps:defaults.tournamentShareBps,personalShareBps:defaults.personalShareBps,financial:{...editor.terms.financial,rentalCompensations:[]}} });}}><option value="main">Основной</option><option value="guest">Аренда / гостевое выступление</option></select></label>
      </div>
      <div className="space-y-3 rounded border border-slate-700 p-4">
        <p>Игрок: <strong>{editor.playerName || "не выбран"}</strong>{editor.kind === "guest" && <> · Мероприятие: <strong>{editor.eventTitle || "не выбрано"}</strong></>}</p>
        {editor.revision === 0 && <>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Что искать" className="rounded bg-slate-900 p-2" value={searchKind} onChange={event => { setSearchKind(event.target.value as typeof searchKind); setChoices([]); }}><option value="players">Игрок</option>{editor.kind === "guest" && <option value="events">Мероприятие</option>}</select>
            <input aria-label="Поиск по имени" className="min-w-0 flex-1 rounded bg-slate-900 p-2" value={search} onChange={event => setSearch(event.target.value)} placeholder="Не менее двух символов" />
            <button type="button" className="secondary-button" disabled={busy || search.trim().length < 2} onClick={() => void findChoices()}>Найти</button>
          </div>
          <ul className="space-y-1">{choices.map(choice => <li key={choice.id}><button type="button" className="w-full rounded bg-slate-800 p-2 text-left hover:bg-slate-700" onClick={() => {
            setEditor(searchKind === "players" ? { ...editor, playerId: choice.id, playerName: choice.nickname ?? "Игрок" } : { ...editor, eventId: choice.id, sessionId: null, eventTitle: choice.title ?? "Мероприятие", terms: { ...editor.terms, endsAt: null } }); setChoices([]);
          }}>{choice.nickname ?? choice.title}</button></li>)}</ul>
        </>}
        {editor.kind === "guest" && editor.eventId && <GuestScopeEditor key={editor.eventId} eventId={editor.eventId} sessionId={editor.sessionId} disabled={editor.revision > 0} onScope={(sessionId, endsAt) => setEditor(current => current ? { ...current, sessionId, terms: { ...current.terms, endsAt } } : null)} />}
      </div>
      <fieldset className="grid gap-4 sm:grid-cols-2"><legend className="mb-3 font-semibold">Срок</legend>
        <label>Начало<input type="datetime-local" required className={inputClass} value={localDate(terms.startsAt)} onChange={event => { if (event.target.value) updateTerms({ startsAt: new Date(event.target.value).toISOString() }); }} /></label>
        <label>Окончание (пусто — бессрочно)<input type="datetime-local" className={inputClass} value={terms.endsAt ? localDate(terms.endsAt) : ""} onChange={event => updateTerms({ endsAt: event.target.value ? new Date(event.target.value).toISOString() : null })} /></label>
        <label>Ограничение выступлений<select className={inputClass} value={terms.limit?.unit ?? "none"} onChange={event => updateTerms({ limit: event.target.value === "none" ? null : { unit: event.target.value as "sessions" | "games" | "trainings" | "tournaments", count: terms.limit?.count ?? 1, completion: terms.limit?.completion ?? "contract" } })}><option value="none">Без ограничения</option><option value="sessions">Количество сессий</option><option value="games">Количество игр</option><option value="trainings">Количество тренировок</option><option value="tournaments">Количество турниров</option></select></label>
        {terms.limit && <><label>Количество<input required type="number" min="1" max="1000000" className={inputClass} value={terms.limit.count} onChange={event => updateTerms({ limit: { ...terms.limit!, count: Number(event.target.value) } })} /></label>
          <label>После достижения лимита<select className={inputClass} value={terms.limit.completion ?? "contract"} onChange={event => updateTerms({ limit: { ...terms.limit!, completion: event.target.value as "contract" | "event_payments" } })}><option value="contract">Закончить договор и начисление зарплаты</option><option value="event_payments">Закончить оплату выступлений, сохранить договор и зарплату до срока</option></select></label>
          <p className="text-sm text-slate-300 sm:col-span-2">{terms.limit.unit === "tournaments" ? "Один турнир расходует одну единицу после завершения всех этапов. Участие только в отборе засчитывается при выполнении правила участия. Договор и ставка за целый турнир фиксируются до его начала; продление между этапами не меняет эти условия. Если договор заканчивается по лимиту, зарплата рассчитывается до окончания всего турнира." : "Неявка не расходует лимит. Последняя сессия оплачивается полностью, даже если её игры превышают остаток. Если договор заканчивается по лимиту, зарплата рассчитывается до окончания последней сессии."} Полная неявка не расходует лимит. При продлении новый лимит считается заново.</p></>}
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-3"><legend className="mb-3 font-semibold">Доля игрока от призовых</legend>
        {([['trainingShareBps', 'Тренировка, %'], ['tournamentShareBps', 'Турнир, %'], ['personalShareBps', 'Личная награда, %']] as const).map(([key, label]) => <label key={key}>{label}<input required className={inputClass} type="number" min="0" max="100" step="0.01" value={terms[key] / 100} onChange={event => updateTerms({ [key]: Math.round(Number(event.target.value) * 100) })} /></label>)}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>Правило участия<select className={inputClass} value={terms.participation.mode} onChange={event => updateTerms({ participation: event.target.value === "minimum" ? { mode: "minimum", games: 1 } : { mode: event.target.value as "any" | "proportional" } })}><option value="any">Полная доля за любое участие</option><option value="proportional">Пропорционально сыгранным играм</option><option value="minimum">Полная доля после минимума игр</option></select></label>
        {terms.participation.mode === "minimum" && <label>Минимум игр<input className={inputClass} type="number" min="1" max="10000" value={terms.participation.games} onChange={event => updateTerms({ participation: { mode: "minimum", games: Number(event.target.value) } })} /></label>}
        {terms.participation.mode === "minimum" && <p className="text-sm text-slate-300">Если минимум не выполнен, выплаты за эту сессию не начисляются, включая оплату игр и бонусы за киллы/MVP. Зарплата по времени действия договора рассчитывается отдельно. Штраф за полную неявку задаётся ниже.</p>}
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <FeeInput label="Компенсация при переходе" value={terms.transfer} basis="от цены перехода" onChange={transfer => updateTerms({ transfer })} />
        <FeeInput label="Штраф за выход игрока" value={terms.playerExit} basis="от стоимости игрока" onChange={playerExit => updateTerms({ playerExit })} />
        <FeeInput label="Выплата игроку при расторжении организацией" value={terms.organizationTermination} basis="от стоимости игрока" onChange={organizationTermination => updateTerms({ organizationTermination })} />
        <label className="flex items-start gap-2"><input type="checkbox" checked={terms.transferRequiresConsent} onChange={event => updateTerms({ transferRequiresConsent: event.target.checked })} />Для платного перехода нужно согласие организации</label>
        <label>Выступления за другие коллективы<select className={inputClass} value={terms.guestPolicy} onChange={event => updateTerms({ guestPolicy: event.target.value as ContractTerms["guestPolicy"], ...(event.target.value === "forbidden" ? { guestCompensation: { kind: "none" } as const } : {}) })}><option value="forbidden">Запрещены</option><option value="allowed">Разрешены</option><option value="consent">Требуют согласия организации</option></select></label>
        {terms.guestPolicy !== "forbidden" && <FeeInput label="Компенсация основной организации за гостя" value={terms.guestCompensation} basis="от выплаты игроку" onChange={guestCompensation => updateTerms({ guestCompensation })} />}
      </div>
      {editor.kind==="guest"&&editor.playerId&&editor.eventId&&<RentalConditionsEditor key={`${editor.organizationId}:${editor.playerId}:${editor.eventId}:${editor.sessionId}`} organizationId={editor.organizationId} playerId={editor.playerId} eventId={editor.eventId} sessionId={editor.sessionId} value={terms.financial.rentalCompensations??[]} onChange={rentalCompensations=>updateTerms({financial:{...terms.financial,rentalCompensations}})}/>}
      <FinancialTermsEditor key={editor.organizationId} value={terms.financial} onChange={financial => updateTerms({ financial })} startsAt={terms.startsAt} endsAt={terms.endsAt} organizationId={editor.organizationId} />
      <div className="rounded border border-cyan-700 p-4"><h3 className="mb-3 font-semibold">Проверьте условия перед сохранением</h3><TermsSummary terms={terms} /></div>
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={busy} className="primary-button">{busy ? "Сохранение…" : "Сохранить черновик"}</button><button type="button" disabled={busy} className="secondary-button" onClick={() => setConfirmClose(true)}>Закрыть</button></div>
      {confirmClose && <div className="space-y-3 rounded border border-amber-600 p-4"><p>Закрыть форму без сохранения изменений?</p><div className="flex flex-wrap gap-3"><button type="button" className="secondary-button" onClick={() => { setEditor(null); setConfirmClose(false); }}>Да, закрыть</button><button type="button" className="secondary-button" onClick={() => setConfirmClose(false)}>Продолжить заполнение</button></div></div>}
    </form>}
    {loading ? <p role="status">Загрузка договоров…</p> : !contracts.length ? <section className="cyber-card p-5">Договоров пока нет.</section> : <div className="space-y-4">{contracts.map(contract => <article className="cyber-card space-y-4 p-5" key={contract.id}>
      <div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-bold"><Link href={`/teams/${contract.organizationId}`} className="text-cyan-200">{contract.organizationName}</Link> → <Link href={`/profile/${contract.playerId}`}>{contract.playerName}</Link></h2><p className="text-sm text-slate-400">{contract.kind === "main" ? "Основной договор" : `Гостевое выступление · ${contract.eventTitle ?? "Мероприятие"}`} · Версия {contract.revision}</p></div><span className="text-amber-200">{statusNames[contract.status]}</span></div>
      <TermsSummary terms={contract.terms} />
      {contract.status === "completed" && contract.effectiveEndsAt && <p className="text-sm text-cyan-200">Договор завершён {new Date(contract.effectiveEndsAt).toLocaleString("ru-RU")}. Исправление старых результатов автоматически его не возобновляет.</p>}
      {contract.hasSignedHistory && ["draft", "offered"].includes(contract.status) && <p className="text-sm text-cyan-200">Это новая редакция существующего договора. Для её действия нужны подписи обеих сторон. Первоначальный бонус и цена выкупа повторно не начисляются.</p>}
      <div className="flex flex-wrap gap-3">
        {contract.canEdit && ["draft", "offered", "rejected", "signed", "completed"].includes(contract.status) && <button type="button" disabled={busy || !!editor} className="secondary-button" onClick={() => { setEditor({ id: contract.id, revision: contract.revision, organizationId: contract.organizationId, playerId: contract.playerId, playerName: contract.playerName, kind: contract.kind, eventId: contract.eventId, eventTitle: contract.eventTitle ?? "", sessionId: contract.sessionId, terms: toConstructorTerms(contract.terms) }); setChoices([]); setNotice("note" in contract.terms ? "Старые пояснения остаются в истории. Для новой версии задайте все условия полями конструктора." : contract.status === "signed" ? "Продление сохраняется новой редакцией того же договора. Текущие подписанные условия действуют до принятия новой редакции." : contract.status === "completed" ? "Прежний договор завершён. Продление оформляется новой редакцией с подписями обеих сторон." : ""); }}>{["signed", "completed"].includes(contract.status) ? "Изменить или продлить" : "Изменить условия"}</button>}
        {contract.canOffer && contract.status === "draft" && "schemaVersion" in contract.terms && <button type="button" disabled={busy} className="primary-button" onClick={() => void mutate({ action: "offer", contractId: contract.id, revision: contract.revision })}>Направить игроку</button>}
        {contract.canEdit && ["draft", "offered"].includes(contract.status) && <button type="button" disabled={busy} className="secondary-button" onClick={() => void mutate({ action: "cancel", contractId: contract.id, revision: contract.revision })}>Отозвать</button>}
        {contract.isPlayer && contract.status === "offered" && "schemaVersion" in contract.terms && <button type="button" disabled={busy} className="primary-button" onClick={() => { setGuestReady(contract.kind === "main"); setAccepting({ ...contract, terms: contract.terms as ConstructorTerms }); }}>Подписать и принять</button>}
        {contract.isPlayer && contract.status === "offered" && <button type="button" disabled={busy} className="secondary-button" onClick={() => void mutate({ action: "reject", contractId: contract.id, revision: contract.revision })}>Отклонить условия</button>}
        {contract.isPlayer && contract.status === "offered" && !("schemaVersion" in contract.terms) && <p className="text-sm text-amber-200">Для подписания организация должна отправить новую версию договора через конструктор.</p>}
      </div>
      <ContractHistory key={`${contract.id}:${contract.revision}:${contract.status}`} contractId={contract.id} />
      <ContractPayments key={`${contract.id}:payments`} contractId={contract.id} />
      {contract.kind==="guest"&&<RentalPayments key={`${contract.id}:rental`} contractId={contract.id}/>}
      <ContractFines key={`${contract.id}:fines`} contractId={contract.id} />
      {(contract.canOffer || contract.isPlayer) && (contract.hasSignedHistory || contract.status === "signed") && <ContractTermination key={`${contract.id}:termination`} contractId={contract.id} onEnded={() => void load()} />}
    </article>)}</div>}
    <div className="flex justify-between gap-3">{offset > 0 && <button type="button" className="secondary-button" onClick={() => setOffset(value => Math.max(0, value - 30))}>Предыдущие</button>}{hasMore && <button type="button" className="secondary-button" onClick={() => setOffset(value => value + 30)}>Следующие</button>}</div>
    {accepting && <section role="dialog" aria-modal="true" aria-label="Подтверждение договора" className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl border border-cyan-400/40 bg-slate-950 p-6">
        <h2 className="text-xl font-bold">Подтвердить договор с организацией «{accepting.organizationName}»?</h2>
        <p>Вы подписываете редакцию {accepting.revision}. Она действует после обеих подписей, не раньше {new Date(accepting.terms.startsAt).toLocaleString("ru-RU")}.</p>
        {!accepting.hasSignedHistory&&accepting.terms.financial.signingAmount>0&&<p>Первоначальная выплата: {number(accepting.terms.financial.signingAmount)} OC.</p>}
        {accepting.hasSignedHistory&&<p>При продлении первоначальный бонус и цена выкупа повторно не начисляются.</p>}
        {accepting.kind === "guest" && <GuestRequirements contractId={accepting.id} onReady={setGuestReady} />}
        {accepting.terms.financial.salary&&<p>Зарплата по новым условиям: {number(accepting.terms.financial.salary.amount)} OC за {number(accepting.terms.financial.salary.periodDays)} суток.</p>}
        <p className="text-sm text-slate-300">Организация резервирует зарплату первого периода, если она предусмотрена; при продлении с прежней длительностью периода учитывается его неоплаченный остаток. Первоначальная выплата резервируется только при первом заключении договора. Если средств не хватит, договор не будет подписан.</p>
        <div className="flex flex-wrap gap-3"><button type="button" className="primary-button" disabled={busy || (accepting.kind === "guest" && !guestReady)} onClick={() => void mutate({ action: "accept", contractId: accepting.id, revision: accepting.revision })}>Подписать эту редакцию</button><button type="button" className="secondary-button" disabled={busy} onClick={() => setAccepting(null)}>Вернуться к условиям</button></div>
      </div>
    </section>}
  </div>;
}
