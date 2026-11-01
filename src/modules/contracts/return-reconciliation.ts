import {z} from "zod";
import {cancellationPaymentKinds,previewTransferCancellation,type CancellationPaymentKind} from "./transfer-cancellation.ts";

const coins=z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const amounts=z.object(Object.fromEntries(cancellationPaymentKinds.map(kind=>[kind,coins])) as Record<CancellationPaymentKind,typeof coins>).strict();
const sourceSchema=z.object({
 paid:amounts,collected:amounts,refunded:amounts,playerDebt:amounts,organizationDebt:amounts,
}).strict();
export type ReturnReconciliationSnapshot=z.infer<typeof sourceSchema>;
export const emptyReturnAmounts=()=>Object.fromEntries(cancellationPaymentKinds.map(kind=>[kind,0])) as Record<CancellationPaymentKind,number>;

/** Internal arithmetic, never a debit authorization. The server obtains paid
 * receipts, actual historical recoveries/refunds and open debts from its ledger.
 * A settled target includes BOTH returned coins and remaining liabilities.
 * Repeated income recovery therefore does not create the debt a second time. */
export function previewReturnReconciliation(policy:unknown,reason:unknown,snapshotInput:unknown){
 const snapshot=sourceSchema.parse(snapshotInput);
 const desired=previewTransferCancellation(policy,reason,snapshot.paid);
 return desired.items.map(item=>{
  const kind=item.kind,collected=snapshot.collected[kind],refunded=snapshot.refunded[kind];
  if(refunded>collected)throw Error("CONTRACT_RETURN_HISTORY");
  const netReturned=collected-refunded;
  const accounted=BigInt(netReturned)+BigInt(snapshot.playerDebt[kind])-BigInt(snapshot.organizationDebt[kind]);
  const balanced=accounted===BigInt(item.amount)&&!(snapshot.playerDebt[kind]>0&&snapshot.organizationDebt[kind]>0);
  const difference=BigInt(item.amount)-BigInt(netReturned);
  return {kind,paid:item.paid,target:item.amount,netReturned,balanced,
   playerClaim:balanced?0:Number(difference>BigInt(0)?difference:BigInt(0)),
   organizationRefund:balanced?0:Number(difference<BigInt(0)?-difference:BigInt(0)),
   closePlayerDebt:balanced?0:snapshot.playerDebt[kind],closeOrganizationDebt:balanced?0:snapshot.organizationDebt[kind]};
 });
}
