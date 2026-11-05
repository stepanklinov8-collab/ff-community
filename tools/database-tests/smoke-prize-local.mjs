import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {chromium} from '@playwright/test';
import {assertTestDatabaseTarget} from '../../src/platform/environment.ts';
const dir=new URL('./artifacts/prize-wallets/',import.meta.url);
const config=JSON.parse(await readFile(new URL('local-staging-private.json',dir),'utf8'));
const credentials=JSON.parse(await readFile(new URL('local-login-private.json',dir),'utf8'));
assertTestDatabaseTarget(config.NEXT_PUBLIC_SUPABASE_URL);
assert.equal(new URL(config.NEXT_PUBLIC_SUPABASE_URL).hostname,'swjdbeelqzdleefscuuc.supabase.co');
const admin=createClient(config.NEXT_PUBLIC_SUPABASE_URL,config.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const client=createClient(config.NEXT_PUBLIC_SUPABASE_URL,config.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}});
const {data:auth,error}=await client.auth.signInWithPassword({email:credentials.email,password:credentials.password});
if(error)throw error;
const base='http://127.0.0.1:3001';
async function api(path,body,expected=200){
 const response=await fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${auth.session.access_token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60000)});
 const value=await response.json();assert.equal(response.status,expected,JSON.stringify(value));return value;
}
const action=(operation,requestId=randomUUID())=>api('/api/wallet',{requestId,operation});
const wallet=()=>api('/api/wallet');
// Release only this script's earlier unfinished fixture after an interrupted run.
const {data:earlier,error:earlierError}=await admin.from('events').select('id').eq('title','Проверка призов 250 / 150 / 100').eq('organizer_user_id',credentials.userId).eq('description','Изолированное тестовое мероприятие для проверки кошельков.');
if(earlierError)throw earlierError;
if(earlier.length){const {error}=await admin.from('event_sessions').update({status:'cancelled'}).in('event_id',earlier.map(e=>e.id));if(error)throw error;}
const initial=await wallet(),own=()=>initial.accounts.find(a=>a.user_id===credentials.userId);
assert.equal(initial.canManage,true);assert.equal(own().balance,1000000);assert.equal(own().reserved,0);
const access=await api('/api/admin/wallet');assert.equal(access.isOwner,true);
const {data:players,error:playersError}=await admin.from('profiles').select('id,nickname').neq('id',credentials.userId).limit(1);
if(playersError)throw playersError;assert.ok(players.length);
const target=players[0].id,transferId=randomUUID(),op={action:'transfer',userId:target,amount:10};
await action(op,transferId);await action(op,transferId);
assert.equal((await wallet()).accounts[0].balance,999990);
await action({action:'reverse',operationId:transferId,reason:'Локальная проверка: отмена тестового перевода'});
const withdrawId=randomUUID();
await action({action:'withdraw_request',fullNameLatin:'Test Player',transferCountry:'Россия',amount:250,note:'ТЕСТ: свободный текст реквизитов, реальная выплата не требуется'},withdrawId);
assert.equal((await wallet()).accounts[0].reserved,250);
assert.ok((await api('/api/admin/wallet')).withdrawals.some(w=>w.id===withdrawId));
await action({action:'withdraw_cancel',withdrawalId:withdrawId});
assert.equal((await wallet()).accounts[0].reserved,0);
console.log('PASS: real local API login, owner permissions, idempotent transfer/reversal, withdrawal reserve/cancel');

const sessionId=randomUUID(),groupId=randomUUID(),games=['bermuda','purgatory','kalahari'].map(map=>({id:randomUUID(),map}));
const start=new Date(Date.now()+86400000),end=new Date(+start+3600000);
const eventConfig={title:'Проверка призов 250 / 150 / 100',type:'training',cost:0,organizer:'OMCITE Тест',organizerUserId:credentials.userId,
 description:'Изолированное тестовое мероприятие для проверки кошельков.',rulesText:'Тестовые призы.',streamUrl:'',paymentUrl:'',imageUrl:'',maxTeams:12,minPlayers:4,
 publishAt:null,commentsEnabled:true,allowIndividualRegistration:false,prizePlan:[250,150,100],
 rules:{mode:'training',criterion:'points',placePoints:[12,9,8,7,6,5,4,3,2,1,0,0],killPoints:1},
 sessions:[{id:sessionId,startTime:start.toISOString(),endTime:end.toISOString(),registrationOpenTime:null,registrationCloseTime:null,maxTeams:12,groups:[{id:groupId,name:'Группа A',capacity:12,games}]}]};
const event=await api('/api/events/editor',{id:null,revision:0,config:eventConfig});
assert.ok(event.eventId);assert.equal((await wallet()).accounts[0].reserved,500);
const fund=await api(`/api/events/${event.eventId}/prizes`);assert.ok(JSON.stringify(fund).includes('250'));
const teams=Array.from({length:3},(_,i)=>({id:randomUUID(),name:`Кошелёк: тестовое место ${i+1}`,type:'team',leader_id:credentials.userId}));
const registrations=teams.map(t=>({id:randomUUID(),team_id:t.id,event_id:event.eventId,session_id:sessionId,group_id:groupId,roster_json:[],status:'confirmed'}));
for(const [table,rows] of [['teams',teams],['event_registrations',registrations]]){const {error}=await admin.from(table).insert(rows);if(error)throw error;}
const resultsPath=`/api/admin/events/${event.eventId}/competition-results`;
const context=await api(resultsPath+`?sessionId=${sessionId}`);
const draft={rows:games.flatMap(g=>registrations.map((r,i)=>({registrationId:r.id,gameId:g.id,played:true,detail:'team',place:i+1,kills:10-i,players:[]}))),warnings:[],manualOrder:[],prizes:[]};
await api(resultsPath,{action:'publish',sessionId,revision:context.revision,configurationRevision:context.configurationRevision,requestId:randomUUID(),draft});
const {data:won,error:wonError}=await admin.from('coin_accounts').select('team_id,balance').in('team_id',teams.map(t=>t.id));
if(wonError)throw wonError;
assert.deepEqual(teams.map(t=>won.find(a=>a.team_id===t.id)?.balance),[250,150,100]);
assert.equal((await wallet()).accounts[0].balance,999500);assert.equal((await wallet()).accounts[0].reserved,0);
const {error:cancelError}=await admin.from('event_sessions').update({status:'cancelled'}).eq('id',sessionId);if(cancelError)throw cancelError;
const restored=await wallet();assert.equal(restored.accounts[0].balance,1000000);assert.equal(restored.accounts[0].reserved,0);assert.equal(restored.demoBalance,initial.demoBalance);
console.log('PASS: real event creation reserves 500, API publication pays 250/150/100, cancellation refunds, demo unchanged');

const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const sessionValue='base64-'+Buffer.from(JSON.stringify(auth.session)).toString('base64url');
 const cookies=[];for(let offset=0;offset<sessionValue.length;offset+=3000)cookies.push({name:`sb-swjdbeelqzdleefscuuc-auth-token.${cookies.length}`,value:sessionValue.slice(offset,offset+3000),domain:'127.0.0.1',path:'/',sameSite:'Lax'});
 await context.addCookies(cookies);const page=await context.newPage();
 const failures=[];page.on('pageerror',error=>failures.push(error.message));
 await page.goto(base+'/wallet');await page.getByText('1 000 000 OMCITE Coins',{exact:true}).waitFor({timeout:60000});
 await page.screenshot({path:new URL('wallet-desktop.png',dir).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
 await page.goto(base+'/admin/wallet');await page.getByRole('heading',{name:'Балансы и выплаты',exact:true}).waitFor();
 await page.getByRole('heading',{name:'Доступ к балансам и выплатам'}).waitFor({timeout:60000});
 await page.screenshot({path:new URL('wallet-admin.png',dir).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/wallet');await page.getByText('1 000 000 OMCITE Coins',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:new URL('wallet-mobile.png',dir).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
 assert.deepEqual(failures,[]);
 console.log('PASS: real signed-in desktop/mobile wallet, admin page, no client exceptions/overflow');
}finally{await browser.close();await client.auth.signOut();}
await writeFile(new URL('live-smoke.json',dir),JSON.stringify({passed:true,at:new Date().toISOString(),project:'swjdbeelqzdleefscuuc',eventId:event.eventId,mainBalance:1000000,demoBalance:initial.demoBalance,productionChanged:false},null,2));
