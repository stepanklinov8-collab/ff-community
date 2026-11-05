import test from 'node:test';
import assert from 'node:assert/strict';
import {sendVkFinanceNotice} from '../src/lib/finance/vk-delivery.ts';
import {walletRequestSchema} from '../src/lib/economy/wallet-schema.ts';
import {financeNoticeContent} from '../src/lib/finance/notice-content.ts';
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

test('withdrawal needs a Latin full name and country; top-up needs neither and identity cannot be forged',()=>{
 const id='10000000-0000-4000-8000-000000000001';
 const valid=operation=>walletRequestSchema.safeParse({requestId:id,operation}).success;
 const base={action:'withdraw_request',amount:100,note:'Payment details'};
 assert.equal(valid(base),false);
 for(const fullNameLatin of ['IVAN IVANOV',"Anne-Marie O'Neill",'John A. Smith'])assert.equal(valid({...base,fullNameLatin,transferCountry:'Россия'}),true);
 for(const fullNameLatin of ['Иван Иванов','Ivan123','A','Ivan\nIvanov',''])assert.equal(valid({...base,fullNameLatin,transferCountry:'Россия'}),false);
 for(const transferCountry of ['', '123', 'Россия\nTest'])assert.equal(valid({...base,fullNameLatin:'Ivan Ivanov',transferCountry}),false);
 assert.equal(valid({action:'deposit_request',amount:100}),true);
 assert.equal(valid({action:'deposit_request',amount:100,requester_nickname:'Forged',requester_contact_url:'https://t.me/other'}),false);
});

test('both finance alerts include trusted profile identity and contact, while private payout data is excluded',()=>{
 const value={kind:'deposit',amount:500,requester_nickname:'Player\nNew line',requester_contact_url:'https://t.me/player',full_name_latin:'PRIVATE NAME',transfer_country:'PRIVATE COUNTRY',note:'PRIVATE BANK'};
 const content=financeNoticeContent(value);
 assert.match(content.body,/Ник на сайте: Player New line/);assert.match(content.body,/Контакт: https:\/\/t.me\/player/);assert.doesNotMatch(content.body,/PRIVATE/);
 const withdrawal=financeNoticeContent({...value,kind:'withdrawal'});
 assert.equal(withdrawal.title,'Заявка на вывод');assert.match(withdrawal.body,/Player New line/);assert.match(withdrawal.body,/https:\/\/t.me\/player/);assert.doesNotMatch(withdrawal.body,/PRIVATE/);
 assert.match(financeNoticeContent({...value,requester_contact_url:'https://t.me.evil.example/player'}).body,/Контакт: не указан/);
 assert.match(financeNoticeContent({...value,requester_contact_url:null}).body,/Контакт: не указан/);
});
