import {readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {assertTestDatabaseTarget,stagingProject} from '../../src/platform/environment.ts';
const config=JSON.parse(await readFile(new URL('./artifacts/prize-wallets/local-staging-private.json',import.meta.url),'utf8'));
const login=JSON.parse(await readFile(new URL('./artifacts/prize-wallets/local-login-private.json',import.meta.url),'utf8'));
assertTestDatabaseTarget(config.NEXT_PUBLIC_SUPABASE_URL);assert.equal(new URL(config.NEXT_PUBLIC_SUPABASE_URL).hostname,stagingProject+'.supabase.co');assert.equal(login.project,stagingProject);
const r=await fetch(config.NEXT_PUBLIC_SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:config.NEXT_PUBLIC_SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:login.email,password:login.password}),signal:AbortSignal.timeout(30000)});
if(!r.ok)throw Error('Staging test sign-in '+r.status);const session=await r.json();assert.equal(session.user.id,login.userId);
const origin='http://127.0.0.1:3001';
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:1280,height:960}});
 await context.addCookies([{name:`sb-${stagingProject}-auth-token`,value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),domain:'127.0.0.1',path:'/',sameSite:'Lax'}]);
 const page=await context.newPage();
 await page.goto(origin+'/admin/analytics');await page.getByRole('heading',{name:'Активность пользователей',exact:true}).waitFor({timeout:60000});
 await page.getByRole('columnheader',{name:'Игрок',exact:true}).waitFor({timeout:60000});
 // Next's empty route announcer also has role=alert; inspect our error paragraph.
 assert.equal(await page.locator('p[role="alert"]').count(),0);
 const authHeaders={Authorization:`Bearer ${session.access_token}`};
 const day=new Date(Date.now()+3*3600000).toISOString().slice(0,10);
 const report=await fetch(origin+`/api/admin/analytics?from=${day}&to=${day}`,{headers:authHeaders,signal:AbortSignal.timeout(30000)});assert.equal(report.status,200);assert.match(report.headers.get('cache-control'),/private, no-store/);
 await page.getByRole('button',{name:'Обновить',exact:true}).click();await page.getByRole('status').waitFor({state:'hidden'});
 await page.screenshot({path:new URL('./artifacts/contracts/activity-desktop.png',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:new URL('./artifacts/contracts/activity-mobile.png',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});
 await page.goto(origin+'/wallet');await page.getByRole('heading',{name:'Баланс прогнозов — Arena Points',exact:true}).waitFor({timeout:45000});assert.match(await page.getByText(/Отдельные игровые очки/).innerText(),/OMCITE Coins/);
 const guest=await fetch(origin+`/api/admin/analytics?from=${day}&to=${day}`);assert.equal(guest.status,401);
 await context.close();console.log('PASS: authenticated staging admin report, activity tracker, desktop/mobile UI, isolated AP wallet and guest denial');
}finally{await browser.close();}
