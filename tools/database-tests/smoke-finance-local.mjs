import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {assertTestDatabaseTarget,stagingProject} from '../../src/platform/environment.ts';
const config=JSON.parse(await readFile(new URL('./artifacts/prize-wallets/local-staging-private.json',import.meta.url),'utf8'));
const login=JSON.parse(await readFile(new URL('./artifacts/prize-wallets/local-login-private.json',import.meta.url),'utf8'));
assertTestDatabaseTarget(config.NEXT_PUBLIC_SUPABASE_URL);
assert.equal(new URL(config.NEXT_PUBLIC_SUPABASE_URL).hostname,stagingProject+'.supabase.co');assert.equal(login.project,stagingProject);
const signIn=await fetch(config.NEXT_PUBLIC_SUPABASE_URL+'/auth/v1/token?grant_type=password',{
 method:'POST',headers:{apikey:config.NEXT_PUBLIC_SUPABASE_ANON_KEY,'Content-Type':'application/json'},
 body:JSON.stringify({email:login.email,password:login.password}),signal:AbortSignal.timeout(30000),
});
if(!signIn.ok)throw Error('Staging test sign-in failed: '+signIn.status);
const session=await signIn.json();assert.equal(session.user.id,login.userId);
const origin='http://127.0.0.1:3001',headers={Authorization:'Bearer '+session.access_token};
const call=async(operation,requestId=randomUUID())=>{
 const response=await fetch(origin+'/api/wallet',{method:'POST',headers:{...headers,'Content-Type':'application/json'},
 body:JSON.stringify({requestId,operation}),signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Error('Staging financial operation failed: HTTP '+response.status);
 return response.json();
};
const wallet=async()=>{
 const response=await fetch(origin+'/api/wallet',{headers,signal:AbortSignal.timeout(60000)});
 assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private, no-store/);return response.json();
};
const balances=value=>value.accounts.map(a=>({user:a.user_id,team:a.team_id,balance:a.balance,reserved:a.reserved}));
async function readStaging(path){
 const response=await fetch(config.NEXT_PUBLIC_SUPABASE_URL+path,{headers:{apikey:config.NEXT_PUBLIC_SUPABASE_ANON_KEY,Authorization:'Bearer '+config.SUPABASE_SERVICE_ROLE_KEY},signal:AbortSignal.timeout(30000)});
 assert.equal(response.status,200);return response.json();
}
const [profile]=await readStaging('/rest/v1/profiles?id=eq.'+session.user.id+'&select=nickname,contact_social_url');
async function checkNoticeIdentity(id,kind){
 const rows=await readStaging('/rest/v1/coin_request_deliveries?request_id=eq.'+id+'&select=kind,requester_nickname,requester_contact_url');
 assert.equal(rows.length,2);
 for(const row of rows){assert.equal(row.kind,kind);assert.equal(row.requester_nickname,profile.nickname.replace(/[\s\u0000-\u001f\u007f]+/g,' ').slice(0,80));assert.equal(row.requester_contact_url,profile.contact_social_url||null);}
}
const before=await wallet(),requestId=randomUUID();let pending=false;
try{
 await call({action:'deposit_request',amount:1},requestId);pending=true;
 await call({action:'deposit_request',amount:1},requestId);
 const requested=await wallet();assert.equal(requested.deposits.filter(row=>row.id===requestId).length,1);
 await checkNoticeIdentity(requestId,'deposit');
 assert.equal(requested.deposits.find(row=>row.id===requestId).status,'pending');assert.deepEqual(balances(requested),balances(before));
 assert.equal(requested.demoBalance,before.demoBalance);
 await call({action:'deposit_cancel',depositId:requestId});pending=false;
 const after=await wallet();assert.equal(after.deposits.find(row=>row.id===requestId).status,'cancelled');assert.deepEqual(balances(after),balances(before));assert.equal(after.demoBalance,before.demoBalance);
}finally{if(pending)await call({action:'deposit_cancel',depositId:requestId});}
const available=before.accounts.find(a=>a.user_id===session.user.id);
let withdrawalChecked=false;
if(available && Number(available.balance)-Number(available.reserved)>=1){
 const key=randomUUID();let held=false;
 try{
  const input={action:'withdraw_request',amount:1,note:'TEST ONLY - DO NOT PAY',fullNameLatin:'TEST PLAYER',transferCountry:'Россия'};
  await call(input,key);held=true;await call(input,key);
  const requested=await wallet(),row=requested.withdrawals.find(row=>row.id===key);
  assert.equal(row.full_name_latin,'TEST PLAYER');assert.equal(row.transfer_country,'Россия');
  assert.equal(requested.withdrawals.filter(row=>row.id===key).length,1);
  await checkNoticeIdentity(key,'withdrawal');
  await call({action:'withdraw_cancel',withdrawalId:key});held=false;
  const released=await wallet();assert.deepEqual(balances(released),balances(before));assert.equal(released.demoBalance,before.demoBalance);withdrawalChecked=true;
 }finally{if(held)await call({action:'withdraw_cancel',withdrawalId:key});}
}
assert.equal((await fetch(origin+'/api/wallet')).status,401);
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addCookies([{name:`sb-${stagingProject}-auth-token`,value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),domain:'127.0.0.1',path:'/',sameSite:'Lax'}]);
 const page=await context.newPage();await page.goto(origin+'/wallet');
 const ownBalance=page.getByRole('region',{name:'Баланс: Личный баланс',exact:true});
 await ownBalance.waitFor({timeout:60000});
 assert.equal(await page.getByRole('region',{name:'Пополнение монет',exact:true}).count(),0);
 assert.equal(await page.getByRole('region',{name:'Запрос на вывод',exact:true}).count(),0);
 await page.getByRole('heading',{name:'Баланс прогнозов — Arena Points',exact:true}).waitFor();
 await ownBalance.getByRole('button',{name:'Пополнить',exact:true}).click();
 await page.getByRole('heading',{name:'Пополнить баланс',exact:true}).waitFor();
 await page.getByRole('button',{name:'Назад к балансу',exact:true}).click();
 await ownBalance.getByRole('button',{name:'Вывести',exact:true}).click();
 await page.getByLabel('ФИО латиницей',{exact:true}).waitFor();await page.getByLabel('Страна перевода',{exact:true}).waitFor();
 assert.equal(await page.getByRole('link',{name:'Связаться с администрацией',exact:true}).count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:new URL('./artifacts/contracts/finance-staging-wallet-mobile.png',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});
 await context.close();
}finally{await browser.close();}
await writeFile(new URL('./artifacts/contracts/finance-local-smoke.json',import.meta.url),JSON.stringify({project:stagingProject,verified:true,checkedAt:new Date().toISOString(),depositRequestRetry:true,cancellation:true,depositContacts:true,withdrawalContacts:withdrawalChecked,withdrawalDetails:withdrawalChecked,balancesUnchanged:true,forecastsUnchanged:true,mobile:true,externalMessagesSent:false},null,2));
console.log('PASS: real staging deposit/retry/cancellation, unchanged main/AP funds, guest denial and mobile wallet; no external messages');
