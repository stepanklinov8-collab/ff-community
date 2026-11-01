import {test,expect,type Page} from '@playwright/test';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const event=id(82000),session=id(82001),group=id(82002),team=id(82003),player=id(82004),reg=id(82005),game=id(82006),fund=id(82007);
const fingerprint='a'.repeat(32);
function awardsData(closed=false,admin=false){return{fund:{id:fund,session_id:session,total:20,held:20,closed_at:closed?'2026-10-30T10:00:00Z':null,cancelled_at:null,last_error:closed?'closed_results_changed':null,plan:{mvp:20,maxKills:0}},
 plans:{mvp:{ready:false,reason:'winner_choice_required'} as {ready:boolean;reason?:string;[key:string]:unknown},maxKills:{ready:true,amount:0}},fingerprint,canReopen:admin,activeKinds:[] as string[],
 candidates:{players:[{key:'user:'+player,userId:player,nickname:'Игрок',kills:12,mvpCandidate:true,maxKillsCandidate:true},{key:'guest:'+id(82008),userId:null,nickname:'Гость',kills:12,mvpCandidate:true,maxKillsCandidate:true}]},history:[]};}
async function fixture(page:Page){
 const user={id:player,aud:'authenticated',role:'authenticated',email:'test@example.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
 const token=[{alg:'HS256',typ:'JWT'},{sub:player,exp:4102444800},'test-only'].map(v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url')).join('.');
 const value='base64-'+Buffer.from(JSON.stringify({access_token:token,refresh_token:'test',expires_at:4102444800,expires_in:86400,token_type:'bearer',user})).toString('base64url');
 await page.context().addCookies([{name:'sb-127-auth-token',value,domain:'127.0.0.1',path:'/',sameSite:'Lax'}]);
 await page.route('http://127.0.0.1:54321/**',route=>route.fulfill({json:route.request().url().includes('/auth/v1/user')?user:[]}));
 await page.route('**/api/**',route=>route.fulfill({json:{modules:[],notifications:[],unreadCount:0,files:[],groups:[],comments:[],canManage:false,canCloseComments:false}}));
 const row={registrationId:reg,gameId:game,played:true,reason:'no_show',detail:'players',place:1,kills:12,rounds:null,landingLocation:null,players:[{id:player,userId:player,played:true,kills:12,deaths:0,assists:0}]};
 await page.route(`**/api/admin/events/${event}/competition-results*`,route=>route.fulfill({json:{event:{id:event,title:'Проверка личных наград',type:'training'},sessions:[{id:session,start_time:'2026-10-29T16:00:00Z'}],session:{id:session},groups:[{id:group,name:'A',public_number:1}],publicId:'123',
  context:{rules:{mode:'training',criterion:'points',placePoints:[12,9,8],killPoints:1,bonuses:{},nominations:['points'],ratingEnabled:true,winsRequired:1,mvpEnabled:false},entrants:[{id:reg,teamId:team,userId:null,groupId:group,name:'Север',organizationType:'team',roster:[{id:player,nickname:'Игрок'}],registeredAt:'2026-01-01'}],games:[{id:game,groupId:group,number:1,map:'bermuda',publicId:'123-1'}]},draft:{rows:[row],warnings:[],manualOrder:[]},published:{rows:[row],standings:[],mvps:[player]},revision:1,configurationRevision:1,firstPublishedAt:'2026-10-29T17:00:00Z',correctedAt:null,canEdit:true,canRank:true,isAdmin:true}}));
}
test('personal award choice stays local until confirmation; anonymous winners remain visible but cannot receive money',async({page})=>{
 await fixture(page);const data=awardsData();const writes:Record<string,unknown>[]=[];
 await page.route(`**/api/events/${event}/personal-awards*`,async route=>{
  if(route.request().method()==='POST'){writes.push(route.request().postDataJSON());data.activeKinds=['mvp'];data.fund.held=0;data.plans.mvp={ready:true,amount:20,winner:data.candidates.players[0],playerAmount:20,organizationAmount:0};return route.fulfill({json:{success:true,settlement:{pending:0}}});}
  return route.fulfill({json:data});
 });
 await page.goto(`/tournaments/${event}/manage-results`);const panel=page.getByRole('region',{name:'Личные денежные награды'});
 await expect(panel).toBeVisible();const select=panel.getByRole('combobox',{name:'Получатель: MVP'});
 await expect(select.locator('option').filter({hasText:'Гость'})).toHaveJSProperty('disabled',true);
 await select.selectOption('user:'+player);expect(writes).toHaveLength(0);
 await panel.getByRole('button',{name:'Подтвердить получателя'}).click();await expect.poll(()=>writes.length).toBe(1);
 expect(writes[0]).toMatchObject({fundId:fund,action:'choose',expected:fingerprint,kind:'mvp',winner:'user:'+player});
 await expect(panel.getByRole('status')).toHaveText('Действие выполнено');
 await expect(panel).toContainText('Выплачено.');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await panel.getByRole('checkbox').check();await expect(panel.getByRole('button',{name:'Окончательно закрыть личный фонд'})).toBeEnabled();
 await page.screenshot({path:'tools/database-tests/artifacts/contracts/personal-awards-mobile.png',fullPage:true});
});
test('failed personal award request is visible and retry reuses the same operation identity',async({page})=>{
 await fixture(page);const data=awardsData(),writes:Record<string,unknown>[]=[];
 await page.route(`**/api/events/${event}/personal-awards*`,async route=>{
  if(route.request().method()==='POST'){writes.push(route.request().postDataJSON());return route.fulfill({status:writes.length===1?503:200,json:writes.length===1?{error:'Связь прервалась. Повторите запрос'}:{success:true,settlement:{pending:0}}});}
  return route.fulfill({json:data});
 });
 await page.goto(`/tournaments/${event}/manage-results`);const panel=page.getByRole('region',{name:'Личные денежные награды'});
 await panel.getByRole('button',{name:'Проверить и выплатить награды'}).click();await expect(panel.getByRole('status')).toHaveText('Связь прервалась. Повторите запрос');
 await panel.getByRole('button',{name:'Проверить и выплатить награды'}).click();await expect.poll(()=>writes.length).toBe(2);expect(writes[0].requestId).toBe(writes[1].requestId);
});
test('closed personal fund permits only an authorized administrator to request correction after explicit acknowledgement',async({page})=>{
 await fixture(page);let data=awardsData(true),action:Record<string,unknown>|null=null;
 await page.route(`**/api/events/${event}/personal-awards*`,async route=>{
  if(route.request().method()==='POST'){action=route.request().postDataJSON();data=awardsData(false,true);return route.fulfill({json:{success:true,settlement:{pending:0}}});}
  return route.fulfill({json:data});
 });
 await page.goto(`/tournaments/${event}/manage-results`);let panel=page.getByRole('region',{name:'Личные денежные награды'});
 await expect(panel.getByRole('alert')).toContainText('Результаты изменились после закрытия');await expect(panel.getByRole('button',{name:'Открыть для исправления выплат'})).toHaveCount(0);
 data=awardsData(true,true);await page.reload();panel=page.getByRole('region',{name:'Личные денежные награды'});
 const reopen=panel.getByRole('button',{name:'Открыть для исправления выплат'});await expect(reopen).toBeDisabled();
 await panel.getByRole('checkbox',{name:'Проверил изменённые результаты и финансирование'}).check();await reopen.click();
 await expect.poll(()=>action).toMatchObject({action:'reopen',fundId:fund,expected:fingerprint});
 await expect(panel.getByRole('button',{name:'Окончательно закрыть личный фонд'})).toBeDisabled();
});
test('personal award endpoint requires authentication',async({request})=>{
 expect((await request.get(`/api/events/${event}/personal-awards?sessionId=${session}`)).status()).toBe(401);
 expect((await request.get(`/api/events/${event}/prize-fund?sessionId=${session}`)).status()).toBe(401);
});

test('podium final closure requires acknowledgement and keeps an unpaid funding error beside its button',async({page})=>{
 await fixture(page);await page.route(`**/api/events/${event}/personal-awards*`,route=>route.fulfill({json:{fund:null}}));
 const data={fund:{total:500,held:250,closed_at:null,cancelled:false,last_error:null,awards:[{amount:250}]},fingerprint,additionalReserve:0,canReopen:false};
 let submitted:Record<string,unknown>|null=null;
 await page.route(`**/api/events/${event}/prize-fund*`,route=>{
  if(route.request().method()==='POST'){submitted=route.request().postDataJSON();return route.fulfill({status:409,json:{error:'Сначала закройте личные награды'}});}
  return route.fulfill({json:data});
 });
 await page.goto(`/tournaments/${event}/manage-results`);const panel=page.getByRole('region',{name:'Завершение призов топ-3'});
 await expect(panel).toContainText('остаток в резерве: 250');const close=panel.getByRole('button',{name:'Закрыть призы топ-3 и вернуть остаток'});await expect(close).toBeDisabled();
 await panel.getByRole('checkbox').check();await close.click();await expect.poll(()=>submitted).toMatchObject({action:'close',expected:fingerprint});
 await expect(panel.getByRole('status')).toHaveText('Сначала закройте личные награды');
});

test('a confirmed award action with a failed refresh removes stale financial controls',async({page})=>{
 await fixture(page);let accepted=false,writes=0;
 await page.route(`**/api/events/${event}/personal-awards*`,route=>{
  if(route.request().method()==='POST'){accepted=true;writes++;return route.fulfill({json:{success:true,settlement:{pending:0}}});}
  return route.fulfill({status:accepted?503:200,json:accepted?{error:'Refresh unavailable'}:awardsData()});
 });
 await page.goto(`/tournaments/${event}/manage-results`);await page.getByRole('button',{name:'Проверить и выплатить награды'}).click();
 await expect(page.getByRole('alert').filter({hasText:'Действие подтверждено, но обновить список не удалось'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Проверить и выплатить награды'})).toHaveCount(0);expect(writes).toBe(1);
});

test('additional personal award funding is quoted and unavailable without authority over its source',async({page})=>{
 await fixture(page);const data={...awardsData(),additionalReserve:20,canFund:false};
 await page.route(`**/api/events/${event}/personal-awards*`,route=>route.fulfill({json:data}));
 await page.goto(`/tournaments/${event}/manage-results`);const panel=page.getByRole('region',{name:'Личные денежные награды'});
 await expect(panel).toContainText('дополнительно зарезервировать на исходном счёте организатора до 20');
 await expect(panel.getByRole('button',{name:'Проверить и выплатить награды'})).toBeDisabled();
});

test('an open podium fund never offers a new debit to an editor without funding authority',async({page})=>{
 await fixture(page);await page.route(`**/api/events/${event}/personal-awards*`,route=>route.fulfill({json:{fund:null}}));
 await page.route(`**/api/events/${event}/prize-fund*`,route=>route.fulfill({json:{fund:{total:500,held:0,closed_at:null,cancelled:false,last_error:'additional_funding_required',awards:[{amount:250}]},fingerprint,additionalReserve:150,canReopen:false,canFund:false}}));
 await page.goto(`/tournaments/${event}/manage-results`);const panel=page.getByRole('region',{name:'Завершение призов топ-3'});
 await expect(panel.getByRole('alert')).toContainText('Обычная публикация не списывает эти монеты');await expect(panel).toContainText('дополнительный резерв: 150');
 await panel.getByRole('checkbox').check();await expect(panel.getByRole('button',{name:'Закрыть призы топ-3 и вернуть остаток'})).toBeDisabled();
});
