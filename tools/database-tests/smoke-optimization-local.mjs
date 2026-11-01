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
let inspectedPage;
try{
 const context=await browser.newContext({viewport:{width:1280,height:960}});
 await context.addCookies([{name:`sb-${stagingProject}-auth-token`,value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),domain:'127.0.0.1',path:'/',sameSite:'Lax'}]);
 const page=await context.newPage();inspectedPage=page;
 page.on("response",response=>{const url=new URL(response.url());if(url.origin===origin&&url.pathname.startsWith("/api/"))console.log("LOCAL_RESPONSE",response.status(),url.pathname);});
 page.on("pageerror",error=>console.log("CLIENT_ERROR",error.message.slice(0,250)));
 const authHeaders={Authorization:`Bearer ${session.access_token}`};
 const probeDay=new Date(Date.now()+3*3600000).toISOString().slice(0,10);const probe=await fetch(origin+`/api/admin/analytics?from=${probeDay}&to=${probeDay}`,{headers:authHeaders,signal:AbortSignal.timeout(30000)});console.log("DIRECT_REPORT",probe.status);assert.equal(probe.status,200);
 await page.goto(origin+'/admin/analytics');await page.getByRole('heading',{name:'Активность пользователей',exact:true}).waitFor({timeout:60000});
 await page.getByRole('columnheader',{name:'Игрок',exact:true}).waitFor({timeout:60000});
 // Next's empty route announcer also has role=alert; inspect our error paragraph.
 assert.equal(await page.locator('p[role="alert"]').count(),0);
 const day=new Date(Date.now()+3*3600000).toISOString().slice(0,10);
 const report=await fetch(origin+`/api/admin/analytics?from=${day}&to=${day}`,{headers:authHeaders,signal:AbortSignal.timeout(30000)});assert.equal(report.status,200);assert.match(report.headers.get('cache-control'),/private, no-store/);
 await page.getByRole('button',{name:'Обновить',exact:true}).click();await page.getByRole('status').waitFor({state:'hidden'});
 await page.screenshot({path:new URL('./artifacts/contracts/activity-desktop.png',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:new URL('./artifacts/contracts/activity-mobile.png',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});
 await page.goto(origin+'/wallet');await page.getByRole('heading',{name:'Баланс прогнозов — Arena Points',exact:true}).waitFor({timeout:45000});assert.match(await page.getByText(/Отдельные игровые очки/).innerText(),/OMCITE Coins/);
 const guest=await fetch(origin+`/api/admin/analytics?from=${day}&to=${day}`);assert.equal(guest.status,401);

 // Check the real optimized endpoints against the dedicated staging schema.
 const eventResponse=await fetch(config.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/events?select=id,title&is_published=eq.true&moderation_status=eq.approved&limit=1',{headers:{apikey:config.NEXT_PUBLIC_SUPABASE_ANON_KEY,...authHeaders}});
 assert.equal(eventResponse.status,200);const events=await eventResponse.json();assert.ok(events.length,'Published staging fixture required');const event=events[0];
 await page.setViewportSize({width:1280,height:960});await page.goto(origin+'/tournaments/'+event.id);await page.getByRole('heading',{name:event.title,exact:true}).waitFor({timeout:45000});
 const sessionsResponse=await fetch(config.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/event_sessions_public?select=id&event_id=eq.'+event.id+'&limit=1',{headers:{apikey:config.NEXT_PUBLIC_SUPABASE_ANON_KEY,...authHeaders}});assert.equal(sessionsResponse.status,200);const sessions=await sessionsResponse.json();assert.ok(sessions.length);
 const registrations=await fetch(origin+'/api/events/'+event.id+'/registrations?sessionId='+sessions[0].id,{headers:authHeaders,signal:AbortSignal.timeout(30000)});assert.equal(registrations.status,200);const registrationData=await registrations.json();assert.ok(Array.isArray(registrationData.registrationCounts));assert.ok(registrationData.registrations.every(row=>row.session_id===sessions[0].id));
 const results=await fetch(origin+'/api/events/'+event.id+'/results',{signal:AbortSignal.timeout(30000)});assert.equal(results.status,200);const resultData=await results.json();assert.ok(resultData.selectedSessionId);assert.ok(resultData.sessions.filter(row=>row.id!==resultData.selectedSessionId).every(row=>row.results===null&&row.games.length===0));
 await page.goto(origin+'/contracts');await page.getByRole('heading',{name:'Контракты',exact:true}).waitFor({timeout:45000});
 const contractResponse=await fetch(origin+'/api/contracts?offset=0',{headers:authHeaders,signal:AbortSignal.timeout(30000)});assert.equal(contractResponse.status,200);const contracts=await contractResponse.json();
 if(contracts.organizations.length){
  let writes=0;await page.route('**/api/contracts',async route=>{if(route.request().method()==='POST'){writes++;return route.abort();}return route.continue();});
  await page.getByRole('button',{name:'Создать договор',exact:true}).click();await page.getByRole('heading',{name:'Стороны договора',exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:new URL('./artifacts/contracts/optimization-staging-contract.png',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});
  await page.getByRole('button',{name:'Закрыть',exact:true}).click();await page.getByRole('button',{name:'Да, закрыть',exact:true}).click();assert.equal(writes,0);
 }
 await context.close();console.log('PASS: real staging authenticated analytics/AP wallet, scoped registration counts, single-session public results and unsaved contract wizard; no financial mutations');
}catch(error){if(inspectedPage)await inspectedPage.screenshot({path:new URL("./artifacts/contracts/optimization-staging-error-private.png",import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,"$1"),fullPage:true}).catch(()=>undefined);throw error;}finally{await browser.close();}
