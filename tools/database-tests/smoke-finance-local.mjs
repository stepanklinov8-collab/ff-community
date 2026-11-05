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
const before=await wallet(),requestId=randomUUID();let pending=false;
try{
 await call({action:'deposit_request',amount:1},requestId);pending=true;
 await call({action:'deposit_request',amount:1},requestId);
 const requested=await wallet();assert.equal(requested.deposits.filter(row=>row.id===requestId).length,1);
 assert.equal(requested.deposits.find(row=>row.id===requestId).status,'pending');assert.deepEqual(balances(requested),balances(before));
 assert.equal(requested.demoBalance,before.demoBalance);
 await call({action:'deposit_cancel',depositId:requestId});pending=false;
 const after=await wallet();assert.equal(after.deposits.find(row=>row.id===requestId).status,'cancelled');assert.deepEqual(balances(after),balances(before));assert.equal(after.demoBalance,before.demoBalance);
}finally{if(pending)await call({action:'deposit_cancel',depositId:requestId});}
assert.equal((await fetch(origin+'/api/wallet')).status,401);
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addCookies([{name:`sb-${stagingProject}-auth-token`,value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),domain:'127.0.0.1',path:'/',sameSite:'Lax'}]);
 const page=await context.newPage();await page.goto(origin+'/wallet');
 await page.getByRole('heading',{name:'Пополнить баланс',exact:true}).waitFor({timeout:60000});
 await page.getByRole('heading',{name:'Баланс прогнозов — Arena Points',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:new URL('./artifacts/contracts/finance-staging-wallet-mobile.png',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});
 await context.close();
}finally{await browser.close();}
await writeFile(new URL('./artifacts/contracts/finance-local-smoke.json',import.meta.url),JSON.stringify({project:stagingProject,verified:true,checkedAt:new Date().toISOString(),depositRequestRetry:true,cancellation:true,balancesUnchanged:true,forecastsUnchanged:true,mobile:true,externalMessagesSent:false},null,2));
console.log('PASS: real staging deposit/retry/cancellation, unchanged main/AP funds, guest denial and mobile wallet; no external messages');
