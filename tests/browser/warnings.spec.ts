import {test,expect,type Page} from '@playwright/test';

const actor='00000000-0000-4000-8000-000000009001';
const event='00000000-0000-4000-8000-000000009002';
const team='00000000-0000-4000-8000-000000009003';
const guild='00000000-0000-4000-8000-000000009004';
async function warningsFixture(page:Page){
  const user={id:actor,aud:'authenticated',role:'authenticated',email:'test@example.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
  const accessToken=[{alg:'HS256',typ:'JWT'},{sub:actor,exp:4102444800},'test-only'].map(v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url')).join('.');
  const value='base64-'+Buffer.from(JSON.stringify({access_token:accessToken,refresh_token:'test',expires_at:4102444800,expires_in:86400,token_type:'bearer',user})).toString('base64url');
  await page.context().addCookies([{name:'sb-127-auth-token',value,domain:'127.0.0.1',path:'/',sameSite:'Lax'}]);
  await page.route('http://127.0.0.1:54321/**',route=>route.fulfill({json:route.request().url().includes('/auth/v1/user')?user:[]}));
  const common={created_at:'2026-10-12T15:00:00Z',activated_at:'2026-10-13T17:30:00Z',expires_at:'2026-10-20T17:30:00Z',status:'active',penalty:5,canCancel:true,canAppeal:false,organizer_id:actor,event_id:event,event_title:'Вечерняя тренировка',session_start_time:'2026-10-13T16:00:00Z'};
  const warnings=[
    {...common,id:'warning-team',target_type:'team',target_kind:'team',target_id:team,target_name:'Север',reason:'Нарушение правил тренировки'},
    {...common,id:'warning-guild',target_type:'team',target_kind:'guild',target_id:guild,target_name:'Альянс',reason:'Неявка гильдии'},
    {...common,id:'warning-player',target_type:'player',target_kind:'player',target_id:actor,target_name:'Сокол',reason:'Оскорбление',event_id:null,event_title:null,session_start_time:null,expires_at:null},
  ];
  const actions:Record<string,unknown>[]=[];
  await page.route('**/api/competition/moderation',async route=>{
    if(route.request().method()==='POST'){
      const body=route.request().postDataJSON();actions.push(body);
      if(body.action==='cancel_warning'){const warning=warnings.find(w=>w.id===body.id)!;warning.status='cancelled';warning.canCancel=false;}
      return route.fulfill({json:{success:true}});
    }
    await route.fulfill({json:{generatedAt:Date.now(),actor,isAdmin:true,isModerator:true,isOwner:false,warnings,sanctions:[],blacklist:[],appeals:[],applications:[],profiles:[{id:actor,nickname:'Сокол'}],organizations:[{id:team,name:'Север',type:'team'},{id:guild,name:'Альянс',type:'guild'}],events:[],teamIds:[],recipientIds:[],adminIds:[actor],source:null}});
  });
  // The public moderation page uses the same warning UI as the protected admin route.
  await page.goto('/appeals');
  await page.getByRole('button',{name:'Предупреждения',exact:true}).click();
  return actions;
}

test('warnings distinguish teams, guilds and players and show issued date, session and named event link',async({page})=>{
  await warningsFixture(page);
  await expect(page.getByRole('button',{name:'Команды и гильдии (2)',exact:true})).toHaveAttribute('aria-pressed','true');
  const teamCard=page.locator('article').filter({has:page.getByRole('heading',{name:'Команда: Север',exact:true})});
  await expect(teamCard).toBeVisible();
  await expect(page.getByRole('heading',{name:'Гильдия: Альянс',exact:true})).toBeVisible();
  await expect(teamCard.getByText(/Выдано:.*13\.10\.2026.*20:30.*МСК/)).toBeVisible();
  await expect(teamCard.getByText(/Сессия:.*13\.10\.2026.*19:00/)).toBeVisible();
  await expect(teamCard.getByRole('link',{name:'Вечерняя тренировка',exact:true})).toHaveAttribute('href',`/tournaments/${event}`);
  await expect(teamCard.getByRole('link',{name:'Север',exact:true})).toHaveAttribute('href',`/teams/${team}`);
  await page.getByRole('searchbox').fill('Альянс');
  await expect(page.locator('article')).toHaveCount(1);
  await page.getByRole('searchbox').fill('');
  await page.getByRole('button',{name:'Игроки (1)',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Игрок: Сокол',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Команда: Север',exact:true})).toHaveCount(0);
  await expect(page.getByText('Мероприятие: Без привязки к мероприятию',{exact:true})).toBeVisible();
  await expect(page.getByText('Срок: Бессрочно',{exact:true})).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('warning cancellation keeps its target and sends an explicit reason',async({page})=>{
  const actions=await warningsFixture(page);
  const card=page.locator('article').filter({has:page.getByRole('heading',{name:'Гильдия: Альянс',exact:true})});
  await card.getByRole('button',{name:'Отмена',exact:true}).click();
  await card.locator('input').fill('Неявка отмечена ошибочно');
  await card.getByRole('button',{name:'Отменить предупреждение',exact:true}).click();
  await expect.poll(()=>actions.length).toBe(1);
  expect(actions[0]).toEqual({action:'cancel_warning',id:'warning-guild',reason:'Неявка отмечена ошибочно'});
  await expect(card.getByRole('button',{name:'Отмена',exact:true})).toHaveCount(0);
});

test('admin warnings page redirects unauthenticated visitors to sign in',async({page})=>{
  await page.goto('/admin/warnings');
  await expect(page).toHaveURL(/\/auth\?next=/);
});
