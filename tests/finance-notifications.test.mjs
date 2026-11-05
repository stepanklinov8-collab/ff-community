import test from 'node:test';
import assert from 'node:assert/strict';
import {sendVkFinanceNotice} from '../src/lib/finance/vk-delivery.ts';
import {walletRequestSchema} from '../src/lib/economy/wallet-schema.ts';
const input={token:'isolated-test-token',recipient:'s.klinov12',groupId:216519943,deliveryId:123,message:'Test request'};
test('VK resolves a personal recipient and posts secrets in the body with stable duplicate protection',async()=>{
 const calls=[];
 const send=async(url,options)=>{
  calls.push({url,options});
  return Response.json({response:url.endsWith('utils.resolveScreenName')?{type:'user',object_id:456}:100});
 };
 await sendVkFinanceNotice(input,send);await sendVkFinanceNotice(input,send);
 assert.equal(calls.length,4);
 for(const call of calls){assert.ok(!call.url.includes(input.token));assert.equal(call.options.redirect,'error');assert.equal(call.options.method,'POST');}
 const bodies=calls.filter(c=>c.url.endsWith('messages.send')).map(c=>c.options.body);
 for(const body of bodies){assert.equal(body.get('random_id'),'123');assert.equal(body.get('user_id'),'456');assert.equal(body.get('group_id'),'216519943');}
});
test('VK errors do not expose upstream text or tokens and non-user recipients are rejected',async()=>{
 await assert.rejects(()=>sendVkFinanceNotice({...input,recipient:'456'},async()=>Response.json({error:{error_code:901,error_msg:input.token}})),error=>error.message==='VK_901');
 await assert.rejects(()=>sendVkFinanceNotice(input,async()=>Response.json({response:{type:'group',object_id:456}})),/VK_RECIPIENT/);
});
test('deposit approvals cannot supply or replace a request amount or account',()=>{
 const id='10000000-0000-4000-8000-000000000001';
 const valid=operation=>walletRequestSchema.safeParse({requestId:id,operation}).success;
 assert.equal(valid({action:'deposit_request',amount:100}),true);
 assert.equal(valid({action:'deposit_request',amount:1.1}),false);
 assert.equal(valid({action:'deposit_credit',depositId:id,reason:'Payment received'}),true);
 assert.equal(valid({action:'deposit_credit',depositId:id,reason:'Payment received',amount:1000000}),false);
 assert.equal(valid({action:'deposit_credit',depositId:id,reason:'Payment received',ownerId:id}),false);
});
