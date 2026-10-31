import test from 'node:test';import assert from 'node:assert/strict';
import {emptyTransferCancellation} from '../src/modules/contracts/transfer-cancellation.ts';
import {emptyReturnAmounts,previewReturnReconciliation} from '../src/modules/contracts/return-reconciliation.ts';
const snapshot=()=>({paid:emptyReturnAmounts(),collected:emptyReturnAmounts(),refunded:emptyReturnAmounts(),playerDebt:emptyReturnAmounts(),organizationDebt:emptyReturnAmounts()});
const policy=()=>{const value=emptyTransferCancellation();value.player_fault.prize={kind:'percent',basisPoints:2000};return value;};
test('partly recovered return debt remains balanced rather than charged again',()=>{
 const state=snapshot();state.paid.prize=1000;state.collected.prize=60;state.playerDebt.prize=140;
 let row=previewReturnReconciliation(policy(),'player_fault',state).find(row=>row.kind==='prize');assert.equal(row.balanced,true);assert.equal(row.playerClaim,0);
 state.collected.prize=100;state.playerDebt.prize=100;row=previewReturnReconciliation(policy(),'player_fault',state).find(row=>row.kind==='prize');assert.equal(row.balanced,true);
});
test('a corrected prize refunds only the excess collected and preserves paid history',()=>{
 const state=snapshot();state.paid.prize=500;state.collected.prize=200;
 let row=previewReturnReconciliation(policy(),'player_fault',state).find(row=>row.kind==='prize');assert.equal(row.target,100);assert.equal(row.organizationRefund,100);
 state.refunded.prize=40;state.organizationDebt.prize=60;row=previewReturnReconciliation(policy(),'player_fault',state).find(row=>row.kind==='prize');assert.equal(row.balanced,true);assert.equal(row.organizationRefund,0);
 state.refunded.prize=100;state.organizationDebt.prize=0;row=previewReturnReconciliation(policy(),'player_fault',state).find(row=>row.kind==='prize');assert.equal(row.balanced,true);
});
test('later eligible pay replaces obsolete unpaid refunds instead of charging both directions',()=>{
 const state=snapshot();state.paid.prize=1500;state.collected.prize=200;state.organizationDebt.prize=100;
 const row=previewReturnReconciliation(policy(),'player_fault',state).find(row=>row.kind==='prize');assert.equal(row.target,300);assert.equal(row.closeOrganizationDebt,100);assert.equal(row.playerClaim,100);assert.equal(row.organizationRefund,0);
});
test('the return equation rejects invented or contradictory receipt history',()=>{
 const state=snapshot();state.refunded.salary=1;assert.throws(()=>previewReturnReconciliation(policy(),'player_fault',state),/CONTRACT_RETURN_HISTORY/);
 assert.throws(()=>previewReturnReconciliation(policy(),'player_fault',{...snapshot(),sourceAccount:'forged'}));
});
