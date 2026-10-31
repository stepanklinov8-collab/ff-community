"use client";
import {cancellationReasons,cancellationReasonLabels,emptyTransferCancellationPenalty,type TransferCancellationPenalty} from "../transfer-cancellation";
import {describeOrdinaryCompensation} from "../ordinary-compensation";
import OrdinaryCompensationField from "./OrdinaryCompensationField";
export function TransferCancellationPenaltySummary({value}:{value?:TransferCancellationPenalty}){
 if(!value)return <p>Отдельный штраф за отмену перехода не предусмотрен.</p>;
 return <div className="space-y-2"><p className="font-semibold">Отдельный штраф за отмену перехода</p>{cancellationReasons.map(cause=><p key={cause}>{cancellationReasonLabels[cause]}: {describeOrdinaryCompensation(value[cause],"от стоимости игрока на момент подтверждения отмены")}</p>)}<p>Получатель — организация, с которой заключён этот договор. Призовые не входят в базу штрафа и не меняют зафиксированную сумму. Возврат цены сделки и возврат ранее полученных выплат задаются отдельно.</p></div>;
}
export default function TransferCancellationPenaltyEditor({value,onChange}:{value?:TransferCancellationPenalty;onChange:(value:TransferCancellationPenalty|undefined)=>void}){
 return <fieldset className="space-y-3"><legend className="font-semibold">Отдельный штраф за отмену перехода</legend><label className="flex gap-2"><input type="checkbox" checked={!!value} onChange={e=>onChange(e.target.checked?emptyTransferCancellationPenalty():undefined)}/>Указать отдельный штраф за отмену</label><p className="text-sm text-slate-300">Получатель — организация данного договора. Стоимость игрока фиксируется при подтверждении отмены. При нехватке свободных монет остаток становится долгом; призовые на размер штрафа не влияют.</p>{value&&cancellationReasons.map(cause=><OrdinaryCompensationField key={cause} label={cancellationReasonLabels[cause]} value={value[cause]} basis="от стоимости игрока при отмене" noneLabel="Без штрафа" onChange={rule=>onChange({...value,[cause]:rule})}/>)}</fieldset>;
}
