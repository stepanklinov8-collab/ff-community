import {test,expect,type Page} from '@playwright/test';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const event=id(88000),session=id(88001),group=id(88002),team=id(88003),player=id(88004),reg=id(88005),game=id(88006);
async function login(page:Page){
 const user={id:player,aud:'authenticated',role:'authenticated',email:'test@example.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
 const token=[{alg:'HS256',typ:'JWT'},{sub:player,exp:4102444800},'test-only'].map(v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url')).join('.');
 const value='base64-'+Buffer.from(JSON.stringify({access_token:token,refresh_token:'test',expires_at:4102444800,expires_in:86400,token_type:'bearer',user})).toString('base64url');
 await page.context().addCookies([{name:'sb-127-auth-token',value,domain:'127.0.0.1',path:'/',sameSite:'Lax'}]);
 await page.route('http://127.0.0.1:54321/**',route=>route.fulfill({json:route.request().url().includes('/auth/v1/user')?user:[]}));
 await page.route('**/api/**',route=>route.fulfill({json:{modules:[],notifications:[],unreadCount:0,files:[],groups:[],comments:[],canManage:false,canCloseComments:false}}));
}
test('prize field stays local until explicit save and survives reload; other organizers see a readonly field',async({page})=>{
 await login(page);
 const draft={rows:[{registrationId:reg,gameId:game,played:true,reason:'no_show',detail:'players',place:1,kills:5,rounds:null,landingLocation:null,players:[{id:player,userId:player,played:true,kills:5,deaths:0,assists:0}]}],warnings:[],manualOrder:[],prizes:[] as {registrationId:string;amount:number}[]};
 const data={event:{id:event,title:'Проверка награды',type:'training'},sessions:[{id:session,start_time:'2030-01-01T16:00:00Z'}],session:{id:session},groups:[{id:group,name:'A',public_number:1}],publicId:'123',context:{rules:{mode:'training',criterion:'points',placePoints:[12,9,8],killPoints:1,bonuses:{},nominations:['points'],ratingEnabled:true,winsRequired:1,mvpEnabled:false},entrants:[{id:reg,teamId:team,userId:null,groupId:group,name:'Север',organizationType:'team',roster:[{id:player,nickname:'Игрок'}],registeredAt:'2026-01-01'}],games:[{id:game,groupId:group,number:1,map:'bermuda',publicId:'123-1'}]},draft,published:null,revision:0,configurationRevision:1,firstPublishedAt:null,correctedAt:null,canEdit:true,canRank:true,isAdmin:true,prizesAllowed:true};
 const writes:Record<string,unknown>[]=[];
 await page.route(`**/api/admin/events/${event}/competition-results*`,async route=>{
  if(route.request().method()==='POST'){
   const body=route.request().postDataJSON();writes.push(body);data.draft=body.draft;data.revision++;
   return route.fulfill({json:{revision:data.revision,configurationRevision:1}});
  }
  return route.fulfill({json:data});
 });
 await page.goto(`/tournaments/${event}/manage-results`);
 await page.getByText('Подтверждённые призовые · 🪙',{exact:true}).click();
 await page.getByLabel('Призовые: Север').fill('250');
 await expect(page.getByLabel('Призовые: Север')).toHaveValue('250');
 expect(writes).toHaveLength(0);
 await page.getByRole('button',{name:/Сохранить черновик/}).click();
 await expect.poll(()=>writes.length).toBe(1);
 expect(writes[0]).toMatchObject({action:'draft',draft:{prizes:[{registrationId:reg,amount:250}]}});
 await page.reload();
 await page.getByText('Подтверждённые призовые · 🪙',{exact:true}).click();
 await expect(page.getByLabel('Призовые: Север')).toHaveValue('250');
 data.isAdmin=false;await page.reload();
 await page.getByText('Подтверждённые призовые · 🪙',{exact:true}).click();
 await expect(page.getByLabel('Призовые: Север')).toBeDisabled();
});

test('reserve number remains visible to an ordinary member when the event participant list is private',async({page})=>{
 await login(page);
 await page.clock.setFixedTime(new Date('2026-10-29T08:00:00Z'));
 await page.route('http://127.0.0.1:54321/rest/v1/**',route=>{
  const table=new URL(route.request().url()).pathname.split('/').at(-1);
  const rows:Record<string,unknown>={events:{id:event,title:'Резерв тренировки',type:'training',cost:0,organizer_user_id:id(88),description:'',is_published:true,max_teams:12,show_registrations:false,min_players:4,roster_lock_minutes:10,comments_enabled:false},event_sessions_public:[{id:session,start_time:'2026-10-29T16:00:00Z',end_time:'2026-10-29T17:00:00Z',registration_open_time:'2026-10-29T07:00:00Z',registration_close_time:'2026-10-29T15:59:00Z',max_teams:12}],profiles:{id:player,nickname:'Участник',locale:'ru'},user_roles:[],team_members:[]};
  return route.fulfill({json:rows[table??'']??[]});
 });
 await page.route(`**/api/events/${event}/registrations`,route=>route.fulfill({json:{registrations:[{id:reg,session_id:session,team_id:team,participant_user_id:null,status:'waiting',queue_position:3,is_own:true,team_name:'Север',roster:[],roster_players:[]}],registrationCounts:[{session_id:session,registered:12,waiting:3,capacity:12}],visibility:'own'}}));
 await page.goto(`/tournaments/${event}`);
 await expect(page.getByRole('heading',{name:'Резерв тренировки',exact:true})).toBeVisible();
 await expect(page.getByRole('status').filter({hasText:'Север: запас №3'})).toBeVisible();
 await expect(page.locator('p').filter({hasText:'12/12'}).first()).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
