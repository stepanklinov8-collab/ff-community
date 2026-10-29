import {test,expect,type Page} from '@playwright/test';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const alice=id(996002),bob=id(996003),account=id(997001);
async function login(page:Page){
 const user={id:alice,aud:'authenticated',role:'authenticated',email:'test@example.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
 const token=[{alg:'HS256',typ:'JWT'},{sub:alice,exp:4102444800},'test-only'].map(v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url')).join('.');
 const value='base64-'+Buffer.from(JSON.stringify({access_token:token,refresh_token:'test',expires_at:4102444800,expires_in:86400,token_type:'bearer',user})).toString('base64url');
 await page.context().addCookies([{name:'sb-127-auth-token',value,domain:'127.0.0.1',path:'/',sameSite:'Lax'}]);
 await page.route('http://127.0.0.1:54321/**',route=>route.fulfill({json:route.request().url().includes('/auth/v1/user')?user:[]}));
 await page.route('**/api/**',route=>route.fulfill({json:{modules:[],notifications:[],unreadCount:0,canOpenAdmin:true,canManage:true,isSuperadmin:true}}));
}
const initial=()=>({userId:alice,canManage:false,accounts:[{id:account,user_id:alice,team_id:null,name:'Личный баланс',balance:1000,reserved:0,canSpend:true}],demoBalance:999999,ledger:[],withdrawals:[] as Array<{id:string;account_id:string;user_id:string;amount:number;status:string;note:string;created_at:string}>});
test('main wallet transfers use explicit confirmation, update balance and expose no demo source',async({page})=>{
 await login(page);const state=initial();const writes:Array<{requestId:string;operation:Record<string,unknown>}>=[];
 await page.route('**/api/wallet*',async route=>{
  if(route.request().url().includes('search='))return route.fulfill({json:{players:[{id:bob,nickname:'Получатель'}],teams:[]}});
  if(route.request().method()==='POST'){
   const body=route.request().postDataJSON();writes.push(body);state.accounts[0].balance-=Number(body.operation.amount);
   return route.fulfill({json:{success:true,operationId:body.requestId}});
  }return route.fulfill({json:state});
 });
 await page.goto('/wallet');
 await expect(page.getByRole('heading',{name:'Демо-баланс ставок'})).toBeVisible();
 await expect(page.getByLabel('Откуда списать монеты').locator('option')).toHaveCount(1);
 await page.getByLabel('Найти игрока',{exact:true}).fill('Получатель');
 await page.getByRole('button',{name:'Получатель · Игрок'}).click();
 await page.getByLabel('Сумма, 🪙',{exact:true}).first().fill('100');
 await page.getByRole('button',{name:'Проверить перевод'}).click();
 expect(writes).toHaveLength(0);
 await expect(page.getByRole('dialog')).toContainText('100');
 await page.getByRole('button',{name:'Подтвердить',exact:true}).click();
 await expect.poll(()=>writes.length).toBe(1);
 expect(writes[0].operation).toEqual({action:'transfer',userId:bob,amount:100});
 await expect(page.getByText('Доступно: 900 🪙',{exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('withdrawal reserves primary money, preserves free-form details and cancellation releases reserve',async({page})=>{
 await login(page);const state=initial();const writes:Array<Record<string,unknown>>=[];
 await page.route('**/api/wallet*',async route=>{
  if(route.request().method()==='POST'){
   const body=route.request().postDataJSON(),op=body.operation;writes.push(op);
   if(op.action==='withdraw_request'){
    state.accounts[0].reserved+=op.amount;state.withdrawals.push({id:body.requestId,account_id:account,user_id:alice,amount:op.amount,status:'pending',note:op.note,created_at:'2026-10-29T08:00:00Z'});
   }else if(op.action==='withdraw_cancel'){state.accounts[0].reserved=0;state.withdrawals[0].status='cancelled';}
   return route.fulfill({json:{success:true,operationId:body.requestId}});
  }return route.fulfill({json:state});
 });
 await page.goto('/wallet');
 await page.getByLabel('Сумма, 🪙',{exact:true}).last().fill('250');
 await page.getByLabel('Реквизиты для перевода',{exact:true}).fill('Тестовый банк, реквизиты для администратора');
 await page.getByRole('button',{name:'Подать заявку'}).click();await page.getByRole('button',{name:'Подтвердить',exact:true}).click();
 await expect(page.getByText('В резерве: 250 🪙',{exact:true})).toBeVisible();
 await expect(page.getByText('Доступно: 750 🪙',{exact:true})).toBeVisible();
 expect(writes[0]).toMatchObject({action:'withdraw_request',amount:250,note:'Тестовый банк, реквизиты для администратора'});
 await page.getByRole('button',{name:'Отменить заявку'}).click();await page.getByRole('button',{name:'Подтвердить',exact:true}).click();
 await expect(page.getByText('В резерве: 0 🪙',{exact:true})).toBeVisible();
 expect(writes[1].action).toBe('withdraw_cancel');
});
test('financial API denial is visible without exposing money controls',async({page})=>{
 await login(page);
 await page.route('**/api/wallet',route=>route.fulfill({status:403,json:{error:'Нет прав на управление балансами'}}));
 await page.goto('/wallet');
 await expect(page.getByRole('alert').filter({hasText:'Нет прав на управление балансами'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Проверить перевод'})).toHaveCount(0);
});
