import test from 'node:test';import assert from 'node:assert/strict';
import {playerTransferDraftSchema} from '../src/modules/contracts/player-transfer-model.ts';import {defaultTerms} from '../src/modules/contracts/model.ts';
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
