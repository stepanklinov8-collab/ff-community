import {test,expect,type Page} from '@playwright/test';

const eventId='00000000-0000-4000-8000-000000008000';
const userId='00000000-0000-4000-8000-000000008001';
const past='00000000-0000-4000-8000-000000008002';
const future='00000000-0000-4000-8000-000000008003';
async function fixtures(page:Page,authenticated=false){
  await page.clock.setFixedTime(new Date('2026-10-05T08:00:00Z'));
  const user={id:userId,aud:'authenticated',role:'authenticated',email:'test@example.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
  if(authenticated){
    const accessToken=[{alg:'HS256',typ:'JWT'},{sub:userId,exp:4102444800},'test-only'].map(v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url')).join('.');
    const value='base64-'+Buffer.from(JSON.stringify({access_token:accessToken,refresh_token:'test',expires_at:4102444800,expires_in:86400,token_type:'bearer',user})).toString('base64url');
    await page.context().addCookies([{name:'sb-127-auth-token',value,domain:'127.0.0.1',path:'/',sameSite:'Lax'}]);
  }
  const controls:string[]=[];
  await page.route('http://127.0.0.1:54321/**',async route=>{
    const url=new URL(route.request().url()),table=url.pathname.split('/').at(-1);
    const rows:Record<string,unknown>={events:{id:eventId,title:'Тренировка',type:'training',cost:0,organizer:'',organizer_user_id:userId,description:'',rules_text:'',image_url:'',stream_url:'',is_published:true,max_teams:15,show_registrations:true,min_players:4,roster_lock_minutes:10,comments_enabled:false},
      event_sessions_public:[{id:past,start_time:'2026-10-04T16:00:00Z',end_time:'2026-10-04T17:00:00Z',responsible_user_id:null},
        {id:future,start_time:'2026-10-05T16:00:00Z',end_time:'2026-10-05T17:00:00Z',responsible_user_id:null}],
      profiles:{id:userId,nickname:'Test',locale:'ru'},user_roles:[],team_members:[]};
    await route.fulfill({json:url.pathname.endsWith('/auth/v1/user')?user:rows[table??'']??[]});
  });
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/api/events/lifecycle')return route.fulfill({json:{event:{configuration_revision:1,frozen_at:null,cancelled_at:null},isAdmin:true,players:[]}});
    if(url.pathname.endsWith('/session-control'))controls.push(url.searchParams.get('sessionId')??'');
    const json=url.pathname.endsWith('/registrations')?{registrations:[],registrationCounts:[]}:url.pathname.endsWith('/session-control')?{description:'',canManage:false,canCloseComments:false,groups:[]}:{modules:[],comments:[],notifications:[],unreadCount:0};
    await route.fulfill({json});
  });
  return controls;
}

test('past event sessions are collapsed, load details only on expansion and preserve deep links',async({page})=>{
  const controls=await fixtures(page);
  await page.goto(`/tournaments/${eventId}`);
  await expect(page.getByRole('heading',{name:'Тренировка',exact:true})).toBeVisible();
  await expect(page.locator(`[data-session-id="${future}"]`)).toBeVisible();
  await expect(page.locator(`[data-session-id="${past}"]`)).toHaveCount(0);
  await expect.poll(()=>controls.includes(future)).toBe(true);
  expect(controls).not.toContain(past);
  const toggle=page.getByRole('button',{name:/Прошедшие \(1\)/});
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await toggle.click();
  await expect(page.locator(`[data-session-id="${past}"]`)).toBeVisible();
  await expect.poll(()=>controls.includes(past)).toBe(true);
  await toggle.click();
  await expect(page.locator(`[data-session-id="${past}"]`)).toHaveCount(0);
  await page.goto(`/tournaments/${eventId}?sessionId=${past}`);
  await expect(page.locator(`[data-session-id="${past}"]`)).toBeVisible();
});

test('training template fills the two-week Moscow schedule and is included in the normal save',async({page})=>{
  await fixtures(page,true);
  let submitted:Record<string,unknown>|null=null;
  await page.route('**/api/events/editor',async route=>{
    if(route.request().method()==='POST'){
      const request=route.request();
      const form=await new Request(request.url(),{method:'POST',headers:request.headers(),body:request.postData()!}).formData();
      submitted=JSON.parse(String(form.get('payload'))).config;
      await route.fulfill({json:{eventId,revision:1,pending:false}});
    }else await route.fulfill({json:{isAdmin:true,events:[]}});
  });
  await page.goto('/tournaments/propose');
  await page.getByLabel('Название',{exact:true}).first().fill('Регулярная тренировка');
  await page.getByLabel('Автоматически добавлять сессии каждую неделю').check();
  await expect(page.getByRole('heading',{name:/^Сессия \d+$/})).toHaveCount(8);
  await expect(page.getByLabel('Начало',{exact:true}).first()).toHaveValue('2026-10-05T19:00');
  await expect(page.getByLabel('Окончание',{exact:true}).first()).toHaveValue('2026-10-05T20:00');
  await expect(page.getByLabel('Открытие регистрации',{exact:true}).first()).toHaveValue('2026-10-05T10:00');
  await expect(page.getByLabel('Закрытие регистрации',{exact:true}).first()).toHaveValue('2026-10-05T18:59');
  await page.getByRole('button',{name:'Сохранить',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Мероприятие сохранено');
  expect(submitted).toMatchObject({trainingSchedule:{enabled:true,startsOn:'2026-10-05'}});
  expect((submitted as unknown as {sessions:unknown[]}).sessions).toHaveLength(8);
  const firstCycle=(submitted as unknown as {sessions:{groups:{games:{map:string}[]}[]}[]}).sessions.slice(0,5).flatMap(s=>s.groups[0].games.map(g=>g.map));
  expect(firstCycle).toHaveLength(15);
  for(const map of ['bermuda','nexterra','solara','purgatory','kalahari'])expect(firstCycle.filter(value=>value===map)).toHaveLength(3);
  await page.getByLabel('Автоматически добавлять сессии каждую неделю').uncheck();
  await expect(page.getByRole('heading',{name:/^Сессия \d+$/})).toHaveCount(8);
});
