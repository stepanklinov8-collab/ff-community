import {test,expect,type Page} from '@playwright/test';
import {defaultTerms} from '../../src/modules/contracts/model';import {emptyTransferCancellation} from '../../src/modules/contracts/transfer-cancellation';
const actor='00000000-0000-4000-8000-000000095000',player='00000000-0000-4000-8000-000000095001',org='00000000-0000-4000-8000-000000095010',previous='00000000-0000-4000-8000-000000095011',dealId='00000000-0000-4000-8000-000000095020',contractId='00000000-0000-4000-8000-000000095021';
const terms={...defaultTerms(new Date('2026-10-01T10:00:00Z')),financial:{...defaultTerms().financial,transferCancellation:emptyTransferCancellation()}};
const base={id:dealId,playerId:player,playerName:'Игрок Севера',organizationId:org,organizationName:'Север',buyerUserId:null,buyerOrganizationId:org,buyerName:'Север',revision:1,price:1000,status:'offered',expiresAt:'2027-01-01T00:00:00Z',newTerms:terms,newContractId:contractId,organizationFees:200,playerAmount:800,requirements:[],requiresFeeException:false,compensationOverrides:[],fresh:true,isCurrent:true,isPlayer:false,startsReady:true,prepared:true,playerConsented:true,homeReady:true,disputed:false,canEdit:true,canOffer:false,canPlayerConsent:false,canPrepare:false,canFund:true,canComplete:false,canCancel:true,canDispute:true,canResolve:false,canMessage:true};
async function setup(page:Page,change:Record<string,unknown>={},reversal?:Record<string,unknown>){
 const user={id:actor,aud:'authenticated',role:'authenticated',email:'transfer@example.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
 const token=[{alg:'HS256',typ:'JWT'},{sub:actor,exp:4102444800},'test-only'].map(value=>Buffer.from(typeof value==='string'?value:JSON.stringify(value)).toString('base64url')).join('.');
 await page.context().addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify({access_token:token,refresh_token:'test',expires_at:4102444800,expires_in:86400,token_type:'bearer',user})).toString('base64url'),domain:'127.0.0.1',path:'/',sameSite:'Lax'}]);
 await page.route('http://127.0.0.1:54321/**',route=>{const path=new URL(route.request().url()).pathname;if(path==='/auth/v1/user')return route.fulfill({json:user});return route.fulfill({json:route.request().headers().accept?.includes('application/vnd.pgrst.object+json')?{id:actor,nickname:'Представитель'}:[]});});
 const writes:Record<string,unknown>[]=[];let current={...base,...change};
 await page.route('**/api/**',route=>{
  const url=new URL(route.request().url());if(url.pathname!=='/api/transfers')return route.fulfill({json:{modules:[],notifications:[],unreadCount:0,canOpenAdmin:false}});
  if(route.request().method()==='POST'){
   const value=route.request().postDataJSON();writes.push(value);
   if(value.action==='player_save')current={...current,id:value.dealId,status:'draft',canOffer:true};
   if(value.action==='buyer_fund')current={...current,status:'funded',canFund:false};
   if(value.action==='complete')current={...current,status:'completed',canComplete:false,canCancel:false};
   return route.fulfill({json:{success:true,dealId:current.id,revision:1,status:current.status}});
  }
  if(url.searchParams.has('search'))return route.fulfill({json:{items:[{id:player,name:'Игрок Севера',kind:'player'}]}});
  if(url.searchParams.has('dealId'))return route.fulfill({json:{deal:current,priceReserve:{amount:1000,held:current.status==='funded'?1000:0},contractReserve:{amount:0,held:0},dispute:null,reversal}});
  return route.fulfill({json:{deals:[current],organizations:[{id:org,name:'Север',type:'team',canSpend:true}],hasMore:false,userId:actor}});
 });return writes;
}
test('an invitation saves a structured new contract without signing or ending the old one',async({page})=>{
 const writes=await setup(page);await page.goto('/transfers');await page.getByRole('button',{name:'Пригласить игрока',exact:true}).click();
 const form=page.getByRole('form',{name:'Предложение перехода игрока'});await form.getByLabel('Имя для поиска',{exact:true}).fill('Игрок');await form.getByRole('button',{name:'Найти',exact:true}).click();await form.getByRole('button',{name:'Игрок Севера',exact:true}).click();
 await form.getByLabel('Цена перехода, OC',{exact:true}).fill('1000');await form.getByLabel('Указать возврат выплат по причинам отмены',{exact:true}).check();
 await form.getByLabel('Указать отдельный штраф за отмену',{exact:true}).check();
 const penalty=form.getByRole('group',{name:'Отдельный штраф за отмену перехода',exact:true});await penalty.getByRole('combobox',{name:'Нарушение со стороны игрока',exact:true}).selectOption('fixed');await penalty.getByLabel('Сумма, OC',{exact:true}).fill('120');
 await form.getByRole('button',{name:'Сохранить предложение',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Изменения подтверждены'})).toBeVisible();
 expect(writes).toHaveLength(1);expect(writes[0]).toMatchObject({action:'player_save',playerId:player,destinationId:org,buyerOrganizationId:org,buyerUserId:null,price:1000,expectedRevision:0,newTerms:{schemaVersion:2,financial:{transferCancellation:{player_fault:{salary:{kind:'none'}}}}}});
 expect(writes[0]).not.toHaveProperty('oldContractEnded');expect(writes[0]).not.toHaveProperty('playerSignature');
 expect(writes[0]).toMatchObject({newTerms:{financial:{transferCancellationPenalty:{player_fault:{kind:'fixed',amount:120}}}}});
});
test('price funding explicitly confirms the source and reuses a request after a lost reply',async({page})=>{
 await setup(page);const attempts:Record<string,unknown>[]=[];
 await page.route('**/api/transfers',route=>{if(route.request().method()!=='POST'||route.request().postDataJSON().action!=='buyer_fund')return route.fallback();attempts.push(route.request().postDataJSON());return attempts.length===1?route.abort('failed'):route.fallback();});
 await page.goto(`/transfers?dealId=${dealId}`);await page.getByRole('button',{name:'Зарезервировать цену',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Зарезервировать цену перехода'});
 await expect(dialog).toContainText('основном счёте «Север»');await dialog.getByRole('button',{name:'Подтвердить действие',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('Ответ не получен');
 await dialog.getByRole('button',{name:'Подтвердить действие',exact:true}).click();await expect(dialog).toHaveCount(0);expect(attempts).toHaveLength(2);expect(attempts[0]).toEqual(attempts[1]);
});
test('the final player signature displays exact contract conditions on mobile',async({page})=>{
 const writes=await setup(page,{isPlayer:true,status:'funded',canFund:false,canPrepare:false,canComplete:true,canEdit:false});await page.setViewportSize({width:390,height:844});await page.goto(`/transfers?dealId=${dealId}`);
 await page.getByRole('button',{name:'Подписать и перейти',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Подписать договор и перейти'});await expect(dialog).toContainText('Договор коллектива другого типа сохраняется');await expect(dialog).toContainText('Выплаты при отмене завершённого перехода');
 await dialog.getByText('Выплаты при отмене завершённого перехода',{exact:true}).scrollIntoViewIfNeeded();await dialog.screenshot({path:'tools/database-tests/artifacts/contracts/player-transfer-signature-mobile.png'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await dialog.getByRole('button',{name:'Подтвердить действие',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(writes.filter(row=>row.action==='complete')).toHaveLength(1);expect(writes[0]).toMatchObject({action:'complete',dealId,revision:1});expect(writes[0]).not.toHaveProperty('signature');
});
test('the former organization cannot read new employment terms or choose their payment source',async({page})=>{
 const writes=await setup(page,{newTerms:null,canFund:false,canPrepare:false,canEdit:false,requirements:[{contractId,organizationId:previous,organizationName:'Прежний состав',relation:'leaving',requiresConsent:true,approved:false,fee:200,canApprove:true,canDisclose:false,terms:null}]});
 await page.goto(`/transfers?dealId=${dealId}`);await expect(page.getByText('Содержание договора скрыто до разрешения его организации.')).toBeVisible();await expect(page.getByRole('button',{name:'Подписать от организации',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Согласовать переход',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Подтвердить действие',exact:true}).click();
 expect(writes[0]).toMatchObject({action:'home_consent',homeContractId:contractId,approve:true});expect(writes[0]).not.toHaveProperty('fee');
});
test('confirmed funding with failed refresh removes stale financial controls',async({page})=>{
 await setup(page);let confirmed=false;await page.route('**/api/transfers**',route=>{if(route.request().method()==='POST'){confirmed=true;return route.fallback();}if(confirmed)return route.fulfill({status:503,json:{error:'Refresh failed'}});return route.fallback();});
 await page.goto(`/transfers?dealId=${dealId}`);await page.getByRole('button',{name:'Зарезервировать цену',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Подтвердить действие',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'Действие выполнено'})).toBeVisible();await expect(page.getByRole('button',{name:'Зарезервировать цену',exact:true})).toHaveCount(0);
});
test('disabled contracts module also hides player transfer page and API',async({page})=>{
 const response=await page.goto('http://127.0.0.1:3104/transfers');expect(response?.status()===404||(await page.content()).includes('NEXT_HTTP_ERROR_FALLBACK;404')).toBe(true);
 expect((await page.request.get('http://127.0.0.1:3104/api/transfers')).status()).toBe(404);
});
test('transfer history can load older revisions and its API rejects guests',async({page})=>{
 expect((await page.request.get('/api/transfers')).status()).toBe(401);
 await setup(page);await page.route('**/api/transfers**',route=>{const url=new URL(route.request().url());if(url.searchParams.get('history')!=='true')return route.fallback();const older=url.searchParams.get('offset')==='1';return route.fulfill({json:{versions:[{revision:older?1:2,price:1000,status:'superseded'}],hasMore:!older}});});
 await page.goto(`/transfers?dealId=${dealId}`);await page.getByRole('button',{name:'История редакций',exact:true}).click();await page.getByRole('button',{name:'Предыдущие редакции',exact:true}).click();
 await expect(page.getByRole('link',{name:/Редакция 1 ·/})).toBeVisible();await expect(page.getByRole('link',{name:/Редакция 2 ·/})).toBeVisible();await expect(page.getByRole('button',{name:'Предыдущие редакции',exact:true})).toHaveCount(0);
});

test('administration prepares a reasoned reversal without client-selected charges or timing',async({page})=>{
 const writes=await setup(page,{status:'completed',canFund:false,canEdit:false,canCancel:false},{canReview:true,proposal:null});
 await page.goto(`/transfers?dealId=${dealId}`);const panel=page.getByRole('region',{name:'Отмена завершённого перехода'});
 await panel.getByRole('combobox',{name:'Основание отмены',exact:true}).selectOption('player_fault');await panel.getByLabel('Обоснование решения',{exact:true}).fill('Подтверждённое нарушение договора');
 await panel.getByRole('button',{name:'Подготовить решение об отмене',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Подготовить решение об отмене'});await expect(dialog).toContainText('Сайт сохранит проверенные условия');await dialog.getByRole('button',{name:'Подтвердить действие',exact:true}).click();
 expect(writes[0]).toMatchObject({action:'reverse_review',cause:'player_fault',reason:'Подтверждённое нарушение договора'});expect(writes[0]).not.toHaveProperty('mode');expect(writes[0]).not.toHaveProperty('amount');
});

test('mutual reversal presents exact payment returns and signs a single reviewed party on mobile',async({page})=>{
 const proposalId='00000000-0000-4000-8000-000000095099';
 const writes=await setup(page,{status:'completed',canFund:false,canEdit:false,canCancel:false},{canReview:false,proposal:{id:proposalId,cause:'mutual',mode:'fixed',reason:'Стороны согласовали отмену',price:1000,oldOrganizationId:previous,penalty:{amount:120,playerValue:0,organizationId:org},
  returns:{total:200,items:[{kind:'prize',paid:1000,amount:200}]},consents:[{party:'player',signed:false,canSign:true},{party:'organization',signed:true,canSign:false}],canExecute:false}});
 await page.setViewportSize({width:390,height:844});await page.goto(`/transfers?dealId=${dealId}`);await page.getByRole('button',{name:'Подтвердить: Игрок',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Согласовать отмену перехода'});
 await expect(dialog).toContainText('Старый договор не восстанавливается');await expect(dialog).toContainText('200 OC');await expect(dialog).toContainText('Размер возврата фиксируется');await expect(dialog).toContainText('Отдельный штраф: 120 OC');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await dialog.screenshot({path:'tools/database-tests/artifacts/contracts/player-transfer-reversal-mobile.png'});
 await dialog.getByRole('button',{name:'Подтвердить действие',exact:true}).click();expect(writes[0]).toMatchObject({action:'reverse_consent',proposalId,party:'player'});expect(writes[0]).not.toHaveProperty('mode');expect(writes[0]).not.toHaveProperty('paid');
});

test('a different contract party sees the reversal decision without private employment payments',async({page})=>{
 await setup(page,{status:'completed',newTerms:null,canFund:false,canEdit:false,canCancel:false},{canReview:false,proposal:{id:contractId,cause:'mutual',mode:'fixed',reason:'Стороны согласовали отмену',price:1000,oldOrganizationId:previous,returns:null,consents:[],canExecute:false}});
 await page.goto(`/transfers?dealId=${dealId}`);const panel=page.getByRole('region',{name:'Отмена завершённого перехода'});await expect(panel).toContainText('выплаты доступны игроку, принимающей организации и администрации');await expect(panel.getByRole('table')).toHaveCount(0);await expect(panel.getByRole('button')).toHaveCount(0);
});
