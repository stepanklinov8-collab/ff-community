import assert from 'node:assert/strict';import test from 'node:test';
import {emptyTransferCancellation,cancellationPaymentKinds,transferCancellationSchema,previewTransferCancellation} from '../src/modules/contracts/transfer-cancellation.ts';
import {defaultTerms,contractTermsSchema} from '../src/modules/contracts/model.ts';
const paid=()=>Object.fromEntries(cancellationPaymentKinds.map(kind=>[kind,101]));
test('each cause has independent signed return rules and no absent historical default',()=>{
 const policy=emptyTransferCancellation();policy.player_fault.salary={kind:'percent',basisPoints:5000};
 assert.equal(previewTransferCancellation(policy,'player_fault',paid()).total,50);
 assert.equal(previewTransferCancellation(policy,'mutual',paid()).total,0);
 assert.throws(()=>previewTransferCancellation(undefined,'mutual',paid()));
 const terms=defaultTerms();assert.equal(contractTermsSchema.parse(terms).financial.transferCancellation,undefined);
 terms.financial.transferCancellation=policy;assert.deepEqual(contractTermsSchema.parse(terms).financial.transferCancellation,policy);
});
test('salary, prize and personal award returns are separate and capped by actual net receipts',()=>{
 const policy=emptyTransferCancellation();policy.hiring_organization_fault.salary={kind:'fixed',amount:500};
 policy.hiring_organization_fault.prize={kind:'combined',amount:40,basisPoints:5000,selection:'minimum'};
 policy.hiring_organization_fault.personalAward={kind:'combined',amount:40,basisPoints:5000,selection:'maximum'};
 const quote=previewTransferCancellation(policy,'hiring_organization_fault',paid());assert.equal(quote.total,191);
 assert.deepEqual(quote.items.find(row=>row.kind==='salary'),{kind:'salary',paid:101,requested:500,amount:101});
 const zero=paid();zero.salary=0;assert.equal(previewTransferCancellation(policy,'hiring_organization_fault',zero).total,90);
});
test('return clauses reject missing causes, unknown receipts, recipient injection and unsafe totals',()=>{
 const policy=emptyTransferCancellation(),missing=structuredClone(policy);delete missing.no_fault;
 assert.equal(transferCancellationSchema.safeParse(missing).success,false);
 for(const rule of [{kind:'percent',basisPoints:10001},{kind:'fixed',amount:-1},{kind:'fixed',amount:10,recipient:'other'}])assert.equal(transferCancellationSchema.safeParse({...policy,mutual:{...policy.mutual,salary:rule}}).success,false);
 assert.throws(()=>previewTransferCancellation(policy,'player',paid()));assert.throws(()=>previewTransferCancellation(policy,'mutual',{...paid(),otherContract:1}));
 policy.no_fault.salary={kind:'percent',basisPoints:10000};policy.no_fault.prize={kind:'percent',basisPoints:10000};
 assert.throws(()=>previewTransferCancellation(policy,'no_fault',{...paid(),salary:Number.MAX_SAFE_INTEGER,prize:1}),/CONTRACT_COIN_RANGE/);
 assert.equal(previewTransferCancellation(policy,'no_fault',{...paid(),salary:1000000000001,prize:0}).total,1000000000001);
});
