"use client";
import {useState} from "react";
import {cancellationReasons,cancellationReasonLabels,cancellationPaymentLabels,type CancellationReason,type CancellationPaymentKind} from "../transfer-cancellation";

type Party="player"|"organization"|"buyer"|"previous";
export type TransferReversalData={canReview:boolean;proposal:{id:string;cause:CancellationReason;mode:"fixed"|"recalculate";reason:string;price:number;oldOrganizationId:string|null;
 returns:{total:number;items:Array<{kind:CancellationPaymentKind;paid:number;amount:number}>}|null;penalty?:{amount:number;playerValue:number;organizationId:string;paid?:number;remaining?:number;cancelledAt?:string|null;cancellationReason?:string|null};
 consents:Array<{party:Party;signed:boolean;canSign:boolean}>;canExecute:boolean}|null};
const parties:Record<Party,string>={player:"Игрок",organization:"Принимающая организация",buyer:"Плательщик перехода",previous:"Прежняя организация"};
const money=(value:number)=>`${value.toLocaleString("ru-RU")} OC`;
type Ask=(action:string,title:string,description:string,extra?:Record<string,unknown>)=>void;

export function ReversalSummary({proposal}:{proposal:NonNullable<TransferReversalData["proposal"]>}){
 return <div className="space-y-3 break-words">
  <p><strong>{cancellationReasonLabels[proposal.cause]}</strong>: {proposal.reason}</p>
  <p>Цена перехода {money(proposal.price)} возвращается исходному плательщику. {proposal.oldOrganizationId?"Игрок возвращается в прежний состав.":"Игрок покидает принимающий состав."} Старый договор не восстанавливается.</p>
  <p>{proposal.mode==="recalculate"?"При исправлении исходных выплат или последующей оплате долга возврат пересчитывается по тем же подписанным условиям.":"Размер возврата фиксируется при отмене перехода."}</p>
  {proposal.penalty&&<p className="rounded border border-amber-500/40 p-3"><strong>Отдельный штраф: {money(proposal.penalty.amount)}.</strong> Получатель — принимающая организация. Призовые не меняют эту сумму. {proposal.penalty.playerValue>0&&`Стоимость игрока в расчёте: ${money(proposal.penalty.playerValue)}.`}</p>}
  {proposal.penalty?.paid!==undefined&&<p>{proposal.penalty.cancelledAt?`Штраф отменён владельцем: ${proposal.penalty.cancellationReason}. Возврат отражён в начислениях договора.`:`Погашено штрафа: ${money(proposal.penalty.paid)}. Остаток долга: ${money(proposal.penalty.remaining??0)}.`}</p>}
  {proposal.returns?<div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="mb-2 text-left">Возвраты по подписанному договору на момент рассмотрения</caption><thead><tr><th className="p-2">Выплата</th><th className="p-2 text-right">Получено</th><th className="p-2 text-right">Вернуть</th></tr></thead><tbody>{proposal.returns.items.map(row=><tr key={row.kind} className="border-t border-slate-700"><td className="p-2">{cancellationPaymentLabels[row.kind]}</td><td className="p-2 text-right tabular-nums">{money(row.paid)}</td><td className="p-2 text-right tabular-nums">{money(row.amount)}</td></tr>)}</tbody></table><p className="mt-2">Всего по договору: {money(proposal.returns.total)}</p></div>:<p className="text-sm text-slate-300">Условия нового трудового договора и его выплаты доступны игроку, принимающей организации и администрации.</p>}
  <p className="text-sm text-slate-300">Возврат выплат по договору использует только свободные монеты игрока, остаток становится долгом. Возврат цены сделки учитывается отдельно. Перед исполнением сайт ещё раз проверит состав, права и подписанные условия.</p>
 </div>;
}

export default function TransferReversal({value,busy,ask}:{value:TransferReversalData;busy:boolean;ask:Ask}){
 const[cause,setCause]=useState<CancellationReason>("mutual"),[reason,setReason]=useState("");
 const proposal=value.proposal;
 if(!value.canReview&&!proposal)return null;
 return <section aria-label="Отмена завершённого перехода" className="space-y-4 rounded-xl border border-amber-500/40 bg-slate-950 p-4">
  <h3 className="text-lg font-semibold">Отмена завершённого перехода</h3>
  {value.canReview&&<div className="space-y-3"><p>Администрация рассматривает причину спора и готовит решение по условиям подписанного договора. Подготовка решения ещё не меняет состав и баланс.</p>
   <label className="block">Основание отмены<select className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2" disabled={busy} value={cause} onChange={e=>setCause(e.target.value as CancellationReason)}>{cancellationReasons.map(item=><option key={item} value={item}>{cancellationReasonLabels[item]}</option>)}</select></label>
   <label className="block">Обоснование решения<textarea className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2" disabled={busy} minLength={3} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
   <button className="secondary-button" disabled={busy||reason.trim().length<3} onClick={()=>ask("reverse_review","Подготовить решение об отмене",`${cancellationReasonLabels[cause]}: ${reason.trim()}. Сайт сохранит проверенные условия; оплата и состав пока не изменятся.`,{cause,reason:reason.trim()})}>Подготовить решение об отмене</button>
  </div>}
  {proposal&&<><ReversalSummary proposal={proposal}/>
   {proposal.cause==="mutual"&&<ul className="space-y-2">{proposal.consents.map(row=><li key={row.party} className="flex flex-wrap items-center justify-between gap-2"><span>{parties[row.party]}: {row.signed?"подтверждено":"ожидается подтверждение"}</span>{row.canSign&&<button disabled={busy} className="secondary-button" onClick={()=>ask("reverse_consent","Согласовать отмену перехода",`Вы подтверждаете это решение как «${parties[row.party]}». При новой редакции решения согласия собираются заново.`,{proposalId:proposal.id,party:row.party})}>Подтвердить: {parties[row.party]}</button>}</li>)}</ul>}
   {proposal.canExecute&&<button className="primary-button" disabled={busy} onClick={()=>ask("reverse_complete","Исполнить отмену перехода","Состав, цена сделки, завершение нового договора и возвраты по его условиям изменятся вместе. Старый договор не возобновится.",{proposalId:proposal.id})}>Исполнить отмену перехода</button>}
  </>}
 </section>;
}
