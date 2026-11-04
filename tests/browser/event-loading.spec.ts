import {test,expect} from '@playwright/test';
import {createServer,type Server} from 'node:http';
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const eventId=id(1),old=id(2),latest=id(3),future=id(4),team=id(5),actor=id(6),organizer=id(7),member=id(8),outsider=id(9),sanction=id(10);
let server:Server,canManage=true;
const reads:Array<{table:string;query:URLSearchParams;body:Record<string,unknown>}>=[];
const event={id:eventId,title:'Тренировка для проверки загрузки',type:'training',public_number:10,is_published:true,moderation_status:'approved',publish_at:null,cancelled_at:null,organizer_user_id:organizer,organizer:'Организатор',show_registrations:true,max_teams:12,min_players:4,roster_lock_minutes:10,comments_enabled:false};
const sessions=[{id:old,start_time:'2026-09-01T16:00:00Z',end_time:'2026-09-01T17:00:00Z',public_number:1},{id:latest,start_time:'2026-10-28T16:00:00Z',end_time:'2026-10-28T17:00:00Z',public_number:2},{id:future,start_time:'2099-01-01T16:00:00Z',end_time:'2099-01-01T17:00:00Z',public_number:3}].map(row=>({...row,event_id:eventId,responsible_user_id:null,registration_open_time:'2026-01-01T00:00:00Z',registration_close_time:row.start_time}));
const snapshot=(session:string)=>({rules:{mode:'training',criterion:'points'},mvps:[],rows:[{gameId:id(session===old?101:102),registrationId:team,played:true,detail:'players',place:1,kills:15,players:[{id:member,userId:member,nickname:'Игрок',played:true,kills:15}]}],standings:[{registrationId:team,teamId:team,userId:null,name:session===old?'Старая команда':'Последняя команда',place:1,gamesPlayed:3,wins:1,kills:15,points:45,placeSum:3,bonus:0}]});
const publications=[{session_id:old,first_published_at:'2026-11-01T16:00:00Z',corrected_at:'2026-11-01T17:00:00Z',published:snapshot(old)},{session_id:latest,first_published_at:'2026-10-28T17:00:00Z',corrected_at:null,published:snapshot(latest)}];
function filter(rows:Array<Record<string,unknown>>,query:URLSearchParams){
 return rows.filter(row=>[...query].every(([key,value])=>value.startsWith('eq.')?String(row[key])===value.slice(3):value.startsWith('in.(')?value.slice(4,-1).split(',').includes(String(row[key])):value==='is.null'?row[key]==null:true));
}
test.beforeAll(async()=>{
 server=createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','authorization,apikey,content-type,x-client-info,prefer,x-supabase-api-version,accept-profile,x-retry-count');if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  const url=new URL(req.url!,'http://127.0.0.1:54321'),table=url.pathname.split('/').at(-1)!;
  const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const body=chunks.length?JSON.parse(Buffer.concat(chunks).toString()):{};
  reads.push({table,query:url.searchParams,body});
  const send=(value:unknown,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
  const rows=(values:Array<Record<string,unknown>>)=>{const data=filter(values,url.searchParams);send(req.headers.accept?.includes('application/vnd.pgrst.object+json')?data[0]??null:data);};
  if(url.pathname==='/auth/v1/user')return req.headers.authorization?send({id:actor,email:'event-test@example.invalid',user_metadata:{},app_metadata:{},aud:'authenticated',created_at:'2026-01-01T00:00:00Z'}):send({message:'Unauthorized'},401);
  if(table==='events')return rows([event]);
  if(table==='event_sessions'||table==='event_sessions_public')return rows(sessions);
  if(table==='competition_publications')return rows(publications);
  if(table==='event_games')return rows([{id:id(101),event_id:eventId,session_id:old,group_id:id(201),game_number:1,public_number:1,map_name:'bermuda'},{id:id(102),event_id:eventId,session_id:latest,group_id:id(202),game_number:1,public_number:1,map_name:'solara'},{id:id(103),event_id:eventId,session_id:future,group_id:id(203),game_number:1,public_number:1,map_name:'kalahari'}]);
  if(table==='event_groups')return rows([{id:id(201),session_id:old,public_number:1},{id:id(202),session_id:latest,public_number:1}]);
  if(table==='event_registrations')return rows([{id:id(301),event_id:eventId,session_id:old,team_id:team,participant_user_id:null,status:'confirmed',created_at:'2026-09-01',roster_json:[],roster:[],roster_snapshot:[],name_snapshot:'Архив',team_name_override:null},{id:id(302),event_id:eventId,session_id:future,team_id:team,participant_user_id:null,status:'confirmed',created_at:'2026-11-01',roster_json:[member],roster:[],roster_snapshot:[],name_snapshot:'Участник',team_name_override:null}]);
  if(table==='u5_event_registration_counts')return send(sessions.map(row=>({session_id:row.id,registered:1,waiting:0,capacity:12})));
  if(table==='teams')return rows([{id:team,name:'Организация',type:'team',avatar_url:null,main_rating:100,ultimate_owner_user_id:actor,verified:true}]);
  if(table==='team_members')return rows([{team_id:team,user_id:member,position:'main',role_in_team:'member'}]);
  if(table==='profiles')return rows([{id:member,nickname:'Участник состава',avatar_url:null,main_rating:50}]);
  if(table==='can_manage_team')return send(canManage);
  if(table==='competition_sanctions')return rows([{id:sanction,target_id:team,target_type:'team',reason:'Три предупреждения за неявку',ends_at:'2099-01-01T00:00:00Z',organizer_id:organizer,lifted_at:null},{id:id(11),target_id:team,target_type:'team',reason:'Истёкшее',ends_at:'2020-01-01T00:00:00Z',organizer_id:organizer,lifted_at:null}]);
  if(table==='warnings')return rows([1,2,3].map(n=>({id:id(400+n),event_id:eventId,session_id:old,reason:'Неявка '+n,activated_at:'2026-10-01T10:00:00Z',expires_at:null,used_in_sanction:sanction,cancelled_at:null})));
  return rows([]);
 });
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(54321,'127.0.0.1',resolve);});
});
test.afterAll(async()=>{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));});
test.beforeEach(()=>{reads.length=0;canManage=true;});

test('results API reads one snapshot and one set of games, selects latest by played date and keeps archive explicit',async({request})=>{
 const response=await request.get(`/api/events/${eventId}/results`);expect(response.status()).toBe(200);const data=await response.json();
 expect(data.selectedSessionId).toBe(latest);expect(data.sessions.find((row:{id:string})=>row.id===latest).results.standings[0].name).toBe('Последняя команда');
 expect(data.sessions.filter((row:{id:string})=>row.id!==latest).every((row:{results:unknown;games:unknown[]})=>row.results===null&&row.games.length===0)).toBe(true);
 expect(reads.filter(row=>row.table==='competition_publications'&&row.query.get('select')?.split(',').includes('published'))).toHaveLength(1);
 expect(reads.filter(row=>row.table==='event_games').map(row=>row.query.get('session_id'))).toEqual(['eq.'+latest]);
 expect((await (await request.get(`/api/events/${eventId}/results?sessionId=${old}`)).json()).selectedSessionId).toBe(old);
 reads.length=0;expect((await request.get(`/api/events/${eventId}/results?sessionId=${future}`)).status()).toBe(200);expect(reads.some(row=>row.table==='event_games')).toBe(false);
 expect((await request.get(`/api/events/${eventId}/results?sessionId=${id(999)}`)).status()).toBe(404);
 expect((await request.get(`/api/events/${eventId}/results?sessionId=invalid`)).status()).toBe(400);
});

test('selected registration API avoids archive rosters and uses aggregate counters',async({request})=>{
 const response=await request.get(`/api/events/${eventId}/registrations?sessionId=${future}`);expect(response.ok()).toBe(true);const data=await response.json();
 expect(data.registrations).toHaveLength(1);expect(data.registrations[0].session_id).toBe(future);expect(data.registrationCounts).toHaveLength(3);
 expect(reads.filter(row=>row.table==='event_registrations').map(row=>row.query.get('session_id'))).toEqual(['eq.'+future]);
 expect(reads.filter(row=>row.table==='u5_event_registration_counts')).toHaveLength(1);
});

test('eligibility is private, checks ownership, excludes arbitrary players and explains the actual sanction basis',async({request})=>{
 const path=`/api/events/${eventId}/eligibility?teamId=${team}&roster=${member},${outsider}`;
 expect((await request.get(path)).status()).toBe(401);canManage=false;
 expect((await request.get(path,{headers:{Authorization:'Bearer test-event-actor'}})).status()).toBe(403);
 canManage=true;reads.length=0;const response=await request.get(path,{headers:{Authorization:'Bearer test-event-actor'}}),data=await response.json();
 expect(response.headers()['cache-control']).toBe('private, no-store');expect(data.restrictions).toHaveLength(1);expect(data.restrictions[0]).toMatchObject({id:sanction,endsAt:'2099-01-01T00:00:00Z',scope:'У этого организатора'});expect(data.restrictions[0].warnings).toHaveLength(3);
 expect(data.restrictions[0].warnings[0].eventUrl).toBe(`/tournaments/${eventId}?sessionId=${old}`);
 expect(reads.find(row=>row.table==='competition_sanctions')?.query.get('target_id')).not.toContain(outsider);
});

test('mobile results keep name and place visible while numeric columns scroll and session choice updates URL',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto(`/tournaments/${eventId}/results`);
 await expect(page.getByRole('link',{name:'Последняя команда',exact:true})).toBeVisible();
 const region=page.getByRole('region',{name:'Таблица результатов'}),name=region.locator('tbody .competition-name').first();const before=await name.boundingBox();
 await region.evaluate(node=>{node.scrollLeft=200;});expect(Math.abs((await name.boundingBox())!.x-before!.x)).toBeLessThan(2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('combobox').selectOption(old);await expect(page).toHaveURL(new RegExp('sessionId='+old));await expect(page.getByRole('link',{name:'Старая команда',exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Подроб/}).click();await expect(page.getByText('Игрок:',{exact:false})).toBeVisible();
 await page.screenshot({path:'tools/database-tests/artifacts/contracts/optimization-results-mobile.png',fullPage:true});
});

test('event archive games and rosters stay unloaded until selected or expanded; failed event can retry',async({page})=>{
 await page.route(`**/api/events/${eventId}/session-control*`,route=>route.fulfill({json:{description:'',groups:[],canManage:false}}));
 let failed=false;
 // Avoid testing the SDK's automatic 5xx retry instead of our visible Retry action.
 await page.route('http://127.0.0.1:54321/rest/v1/events?**',async route=>{if(!failed){failed=true;return route.fulfill({status:400,json:{message:'Test load failure'}});}return route.continue();});
 await page.goto(`/tournaments/${eventId}`);await expect(page.getByRole('alert').filter({hasText:'Не удалось загрузить мероприятие'})).toBeVisible();await page.getByRole('button',{name:'Повторить',exact:true}).click();
 await expect(page.getByRole('heading',{name:event.title,exact:true})).toBeVisible();await expect(page.locator(`[data-session-id="${future}"]`)).toBeVisible();
 await expect.poll(()=>reads.some(row=>row.table==='event_games'&&row.query.get('session_id')?.includes(future))).toBe(true);
 expect(reads.filter(row=>row.table==='event_games').some(row=>row.query.get('session_id')?.includes(old))).toBe(false);
 await page.getByRole('button',{name:/Прошедшие \(2\)/}).click();await expect(page.locator(`[data-session-id="${old}"]`)).toBeVisible();
 await expect.poll(()=>reads.some(row=>row.table==='event_games'&&row.query.get('session_id')?.includes(old))).toBe(true);
 expect(reads.filter(row=>row.table==='event_registrations').every(row=>row.query.get('session_id')==='eq.'+future)).toBe(true);
});

test('grouped navigation preserves links and loads module links once for both sections',async({page})=>{
 let moduleRequests=0;page.on('request',request=>{if(new URL(request.url()).pathname==='/api/modules')moduleRequests++;});
 await page.goto(`/tournaments/${eventId}/results`);await page.getByRole('button',{name:'Открыть меню',exact:true}).click();
 const nav=page.getByRole('complementary',{name:'Главная навигация'});
 for(const title of ['Играть','Моя арена','Сообщество','Управление и помощь'])await expect(nav.getByRole('region',{name:title,exact:true})).toBeVisible();
 await expect(nav.getByRole('region',{name:'Играть',exact:true}).getByRole('link',{name:'Турниры',exact:true})).toHaveAttribute('href','/tournaments');
 await expect(nav.getByRole('region',{name:'Сообщество',exact:true}).getByRole('link',{name:'Чат',exact:true})).toHaveAttribute('href','/chat');
 await expect(nav.getByRole('region',{name:'Моя арена',exact:true}).getByRole('link',{name:'Контракты и сделки',exact:true})).toHaveAttribute('href','/contracts');expect(moduleRequests).toBe(1);
 await page.screenshot({path:'tools/database-tests/artifacts/contracts/optimization-menu-desktop.png',fullPage:true});
});
