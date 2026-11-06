// Named staging only. Reads/authenticates a dedicated test account; sends no emails.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {assertTestDatabaseTarget,stagingProject} from '../../src/platform/environment.ts';
const config=JSON.parse(await readFile(new URL('./artifacts/prize-wallets/local-staging-private.json',import.meta.url),'utf8'));
const login=JSON.parse(await readFile(new URL('./artifacts/prize-wallets/local-login-private.json',import.meta.url),'utf8'));
assertTestDatabaseTarget(config.NEXT_PUBLIC_SUPABASE_URL);assert.equal(new URL(config.NEXT_PUBLIC_SUPABASE_URL).hostname,stagingProject+'.supabase.co');assert.equal(login.project,stagingProject);
const origin='http://127.0.0.1:3001';
const start=performance.now();
const response=await fetch(origin+'/api/backend/auth/v1/token?grant_type=password',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({email:login.email,password:login.password}),signal:AbortSignal.timeout(30000)});
assert.equal(response.status,200,'Local staging proxy sign-in');assert.match(response.headers.get('cache-control'),/private, no-store/);
const session=await response.json();assert.equal(session.user.id,login.userId);const signInMs=Math.round(performance.now()-start);
const times=[];
for(let i=0;i<3;i++){
 const t=performance.now(),r=await fetch(origin+'/api/backend/auth/v1/user',{headers:{authorization:'Bearer '+session.access_token},signal:AbortSignal.timeout(30000)});
 assert.equal(r.status,200);assert.equal((await r.json()).id,login.userId);times.push(Math.round(performance.now()-t));
}
const browser=await chromium.launch({headless:true});let screenshot;
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addCookies([{name:`sb-${stagingProject}-auth-token`,value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),domain:'127.0.0.1',path:'/',sameSite:'Lax'}]);
 const page=await context.newPage(),direct=[],sockets=[];
 page.on('request',r=>{if(new URL(r.url()).hostname.endsWith('.supabase.co'))direct.push(r.url());});page.on('websocket',socket=>{if(new URL(socket.url()).hostname.endsWith('.supabase.co'))sockets.push(socket.url());});
 await page.route('https://*.supabase.co/**',route=>route.abort());
 await page.goto(origin+'/wallet');await page.getByRole('region',{name:'Баланс: Личный баланс',exact:true}).waitFor({timeout:60000});
 await page.goto(origin+'/teams');await page.getByRole('heading',{name:'Команды и гильдии',exact:true}).waitFor({timeout:60000});
 await page.goto(origin+'/chat');await page.getByRole('heading',{name:'Чат',exact:true}).waitFor({timeout:60000});
 await page.getByRole('textbox',{name:'Сообщение',exact:true}).waitFor({timeout:60000});
 assert.equal(direct.length,0);assert.equal(sockets.length,0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 screenshot=new URL('./artifacts/contracts/backend-staging-chat.png',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');await page.screenshot({path:screenshot,fullPage:true});
 await context.close();
}finally{await browser.close();}
const proof={verified:true,project:stagingProject,checkedAt:new Date().toISOString(),signInMs,userReadMs:times,browserDirectRequests:0,webSockets:0,mainWallet:true,organizations:true,chat:true,externalMessagesSent:false,screenshot};
await writeFile(new URL('./artifacts/contracts/backend-staging-smoke.json',import.meta.url),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
