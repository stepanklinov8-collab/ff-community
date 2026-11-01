import test from 'node:test';import assert from 'node:assert/strict';
import {marketMutationSchema,marketQuerySchema} from '../src/modules/contracts/market-model.ts';
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
test('market drafts select one funding buyer, exact integer price and a finite dated revision',()=>{
 const draft={action:'save',requestId:a,dealId:b,expectedRevision:0,organizationId:b,buyerUserId:a,buyerOrganizationId:null,price:300,expiresAt:'2026-12-01T10:00:00+03:00'};
 assert.equal(marketMutationSchema.safeParse(draft).success,true);assert.equal(marketMutationSchema.safeParse({...draft,buyerUserId:null,buyerOrganizationId:b}).success,true);
 for(const change of [{price:1.5},{price:-1},{price:1e13},{expectedRevision:-1},{buyerUserId:null},{buyerOrganizationId:b},{sellerUserId:a},{bundle:{contracts:[]}},{actorId:b},{expiresAt:'infinity'},{expiresAt:'2026-12-01'}])assert.equal(marketMutationSchema.safeParse({...draft,...change}).success,false);
});
test('financial decisions cannot forge accounts, signature, recipient or a current price',()=>{
 for(const action of ['offer','disclose','seller_accept','buyer_fund','complete','cancel','reject']){
  const value={action,requestId:a,dealId:b,revision:1};assert.equal(marketMutationSchema.safeParse(value).success,true);
  for(const change of [{price:1},{amount:1},{payerId:a},{recipientId:a},{sellerSigned:true},{disclosureHash:'forged'},{revision:0},{actorId:b}])assert.equal(marketMutationSchema.safeParse({...value,...change}).success,false);
 }
 for(const action of ['dispute','resolve','reverse']){const value={action,requestId:a,dealId:b,revision:1,reason:'Explanation'};assert.equal(marketMutationSchema.safeParse(value).success,true);assert.equal(marketMutationSchema.safeParse({...value,reason:' '}).success,false);}
});
test('private chat and evidence cannot query or send into a second financial scope',()=>{
 assert.equal(marketMutationSchema.safeParse({action:'message',requestId:a,dealId:b,body:'Text',replyTo:'1'}).success,true);
 assert.equal(marketMutationSchema.safeParse({action:'message',requestId:a,dealId:b,body:'Text',replyTo:1}).success,false);
 for(const valid of [{},{dealId:a},{dealId:a,chat:'true',before:'10'},{dealId:a,history:'true',offset:'30'},{search:'Команда',searchKind:'organizations'}])assert.equal(marketQuerySchema.safeParse(valid).success,true);
 for(const bad of [{history:'true'},{chat:'true'},{dealId:a,search:'User',searchKind:'users'},{dealId:a,history:'true',events:'true'},{dealId:a,before:'1'},{dealId:a,actorId:b},{dealId:a,offset:-1},{search:'x',searchKind:'users'}])assert.equal(marketQuerySchema.safeParse(bad).success,false);
});
