import test from 'node:test';import assert from 'node:assert/strict';
import {playerTransferDraftSchema,playerTransferMutationSchema,playerTransferQuerySchema} from '../src/modules/contracts/player-transfer-model.ts';import {defaultTerms} from '../src/modules/contracts/model.ts';
import {emptyTransferCancellation} from '../src/modules/contracts/transfer-cancellation.ts';
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
const valid=()=>{const newTerms=defaultTerms(new Date('2026-12-01T10:00:00Z'));newTerms.financial.transferCancellation=emptyTransferCancellation();return {action:'player_save',requestId:a,dealId:b,expectedRevision:0,playerId:a,destinationId:b,buyerUserId:a,buyerOrganizationId:null,price:10000,expiresAt:'2026-12-10T10:00:00Z',newTerms,compensationOverrides:[]};};
test('a transfer requires a destination and the exact structured new contract',()=>{
 assert.equal(playerTransferDraftSchema.safeParse(valid()).success,true);const {newTerms,...missing}=valid();void newTerms;assert.equal(playerTransferDraftSchema.safeParse(missing).success,false);
 for(const change of [{destinationId:null},{price:-1},{price:0.5},{payerId:a},{oldContractEnded:true},{playerSignature:true},{newTerms:null},{buyerOrganizationId:b},{buyerUserId:null}])assert.equal(playerTransferDraftSchema.safeParse({...valid(),...change}).success,false);
 const withoutPolicy=valid();delete withoutPolicy.newTerms.financial.transferCancellation;assert.equal(playerTransferDraftSchema.safeParse(withoutPolicy).success,false);
});
test('a dated transfer cannot expire before the offered new contract begins',()=>{
 assert.equal(playerTransferDraftSchema.safeParse({...valid(),expiresAt:'2026-11-30T10:00:00Z'}).success,false);
 assert.equal(playerTransferDraftSchema.safeParse({...valid(),buyerUserId:null,buyerOrganizationId:b}).success,true);
});
test('deal-specific compensation proposals do not accept hidden recipients or duplicates',()=>{
 const value={...valid(),compensationOverrides:[{contractId:a,amount:4000}]};assert.equal(playerTransferDraftSchema.safeParse(value).success,true);
 for(const overrides of [[{contractId:a,amount:4000,recipient:b}],[{contractId:a,amount:4000},{contractId:a,amount:10}],[{contractId:a,amount:0.5}]])assert.equal(playerTransferDraftSchema.safeParse({...value,compensationOverrides:overrides}).success,false);
});
test('player signatures and financial approvals cannot inject accounts, amounts or early contract termination',()=>{
 for(const action of ['offer','player_consent','prepare_contract','buyer_fund','complete','cancel','reject']){
  const input={action,requestId:a,dealId:b,revision:1};assert.equal(playerTransferMutationSchema.safeParse(input).success,true);
  for(const addition of [{actorId:a},{accountId:b},{amount:1},{oldContractEnded:true},{organizationSigner:a},{signature:true}])assert.equal(playerTransferMutationSchema.safeParse({...input,...addition}).success,false);
 }
 assert.equal(playerTransferMutationSchema.safeParse({action:'reverse',requestId:a,dealId:b,revision:1,reason:'not implemented'}).success,false);
});
test('home approvals and disclosure select references, never caller-provided terms or fees',()=>{
 const approval={action:'home_consent',requestId:a,dealId:b,revision:1,homeContractId:a,approve:true};
 assert.equal(playerTransferMutationSchema.safeParse(approval).success,true);assert.equal(playerTransferMutationSchema.safeParse({...approval,fee:100}).success,false);
 const disclosure={action:'disclose',requestId:a,dealId:b,revision:1,organizationId:a};assert.equal(playerTransferMutationSchema.safeParse(disclosure).success,true);
 assert.equal(playerTransferMutationSchema.safeParse({...disclosure,contracts:[]}).success,false);
 assert.equal(playerTransferQuerySchema.safeParse({dealId:a,chat:'true',history:'true'}).success,false);
});
