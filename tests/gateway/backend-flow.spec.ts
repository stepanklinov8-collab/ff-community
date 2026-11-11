import {test,expect,type Page} from '@playwright/test';
import {createServer,type Server} from 'node:http';
import {readFile} from 'node:fs/promises';

const userId='00000000-0000-4000-8000-000000998901',teamId='00000000-0000-4000-8000-000000998902';
const user={id:userId,aud:'authenticated',role:'authenticated',email:'test@example.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
let teamPhoto:Buffer;
const token=(expires:number)=>[{alg:'HS256',typ:'JWT'},{sub:userId,exp:expires},'test-only'].map(v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url')).join('.');
const session=(expires=4102444800)=>({access_token:token(expires),refresh_token:'test-refresh',expires_in:3600,expires_at:expires,token_type:'bearer',user});
let server:Server;const calls:Array<{path:string;method:string;body:Record<string,unknown>;headers:Record<string,unknown>}>=[];
test.beforeAll(async()=>{
 teamPhoto=await readFile('public/brand/omcite-emblem.jpg');
 server=createServer(async(req,res)=>{
  const url=new URL(req.url!,'http://127.0.0.1:54321');let raw='';for await(const part of req)raw+=part;
  const body=raw?JSON.parse(raw):{};calls.push({path:url.pathname+url.search,method:req.method!,body,headers:req.headers});
  res.setHeader('Content-Type','application/json');
  if(url.pathname==='/auth/v1/token'||url.pathname==='/auth/v1/verify')return res.end(JSON.stringify(session()));
  if(url.pathname==='/auth/v1/user')return res.end(JSON.stringify(user));
  if(url.pathname==='/auth/v1/signup')return res.end(JSON.stringify({...user,identities:[{id:'test'}],user_metadata:body.data}));
  if(url.pathname.startsWith('/auth/v1/'))return res.end('{}');
  if(url.pathname.endsWith('/avatars/team.jpg')){res.setHeader('Content-Type','image/jpeg');return res.end(teamPhoto);}
  if(url.pathname.startsWith('/storage/v1/')){res.setHeader('Content-Type','image/png');return res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'));}
  if(url.pathname==='/rest/v1/teams')return res.end(JSON.stringify([{id:teamId,name:'Gateway Team',type:'team',description:'',created_at:user.created_at,avatar_url:'http://127.0.0.1:54321/storage/v1/object/public/avatars/team.jpg',main_rating:1,team_members:[{count:4}]}]));
  if(url.pathname==='/rest/v1/profiles')return res.end(JSON.stringify([{id:userId,nickname:'Gateway Player'}]));
  res.end('[]');
 });
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(54321,'127.0.0.1',resolve);});
});
test.afterAll(async()=>{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));});
test.beforeEach(()=>{calls.length=0;});
test('public picture bytes are reused from browser cache and a replacement filename loads a fresh image',async({page})=>{
 // No page.route: Playwright routing disables the HTTP cache being verified.
 await page.goto('/privacy');
 const original='/api/backend/storage/v1/object/public/avatars/teams/test/00000000-0000-4000-8000-000000000011.png';
 const replacement=original.replace('000000000011.png','000000000012.png');
 const load=async(src:string)=>page.evaluate(async url=>{const image=new Image();image.src=url;await image.decode();document.body.append(image);return image.naturalWidth;},src);
 expect(await load(original)).toBe(1);expect(await load(original)).toBe(1);
 expect(calls.filter(call=>call.path.endsWith('000000000011.png'))).toHaveLength(1);
 await page.reload();expect(await load(original)).toBe(1);expect(calls.filter(call=>call.path.endsWith('000000000011.png'))).toHaveLength(1);
 expect(await load(replacement)).toBe(1);expect(calls.filter(call=>call.path.endsWith('000000000012.png'))).toHaveLength(1);
});
async function fixture(page:Page){
 const direct:string[]=[];page.on('request',request=>{if(new URL(request.url()).port==='54321'||new URL(request.url()).hostname.endsWith('.supabase.co'))direct.push(request.url());});
 await page.route('http://127.0.0.1:54321/**',route=>route.abort());
 await page.route('**/api/**',route=>{
  if(new URL(route.request().url()).pathname.startsWith('/api/backend/')||new URL(route.request().url()).pathname==='/api/auth/confirm')return route.continue();
  if(route.request().url().includes('/api/auth/availability'))return route.fulfill({json:{nicknameAvailable:true,gameIdAvailable:true}});
  if(route.request().url().includes('/api/profile'))return route.fulfill({json:{profile:{contactSocialUrl:'https://t.me/test_player'}}});
  return route.fulfill({json:{modules:[],notifications:[],unreadCount:0,rows:[],canManage:false,canOpenAdmin:false}});
 });
 return direct;
}
async function cookie(page:Page,expires=4102444800){const value='base64-'+Buffer.from(JSON.stringify(session(expires))).toString('base64url');await page.context().addCookies([{name:'sb-127-auth-token',value,domain:'127.0.0.1',path:'/',sameSite:'Lax'}]);}

test('signup and code confirmation traverse the real gateway while direct backend access is blocked',async({page})=>{
 const direct=await fixture(page);await page.goto('/auth');await page.getByRole('button',{name:'Нет аккаунта? Зарегистрироваться'}).click();
 await page.getByPlaceholder('Никнейм').fill('Gateway Player');await page.getByPlaceholder('Free Fire ID — только цифры').fill('123456789');
 await page.getByRole('textbox',{name:'Email',exact:true}).fill('test@example.invalid');await page.getByPlaceholder('Пароль — минимум 6 символов').fill('test-password');
 await page.getByRole('textbox',{name:/Ссылка для связи/}).fill('https://t.me/test_player');await page.getByRole('button',{name:'Создать аккаунт',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Аккаунт создан');
 const signup=calls.find(c=>c.path.startsWith('/auth/v1/signup'));expect(signup?.body.data).toMatchObject({nickname:'Gateway Player',contact_social_url:'https://t.me/test_player'});
 await page.getByPlaceholder(/Код из письма/).fill('123456');await page.getByRole('button',{name:'Подтвердить код',exact:true}).click();
 await expect(page).toHaveURL(/\/profile/);expect(calls.some(c=>c.path==='/auth/v1/verify')).toBe(true);expect(direct).toEqual([]);
 expect((await page.context().cookies()).some(c=>c.name.startsWith('sb-127-auth-token'))).toBe(true);
});

test('login, persisted session, user read and sign-out keep canonical cookies through the gateway',async({page})=>{
 const direct=await fixture(page);await page.goto('/auth');await page.getByRole('textbox',{name:'Email',exact:true}).fill(user.email);
 await page.getByPlaceholder('Пароль',{exact:true}).fill('test-password');await page.getByRole('button',{name:'Войти',exact:true}).click();await expect(page).toHaveURL('/');
 expect(calls.some(c=>c.path==='/auth/v1/token?grant_type=password')).toBe(true);
 await page.goto('/teams');await expect(page.getByText('Gateway Team',{exact:true})).toBeVisible();await page.reload();await expect(page.getByText('Gateway Team',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Открыть меню',exact:true}).click();await page.getByRole('button',{name:'Выйти',exact:true}).click();
 await expect.poll(()=>calls.some(c=>c.path.startsWith('/auth/v1/logout'))).toBe(true);expect(direct).toEqual([]);
 const remaining=await page.context().cookies();expect(remaining.filter(c=>c.name==='sb-127-auth-token')).toHaveLength(0);
});

test('expired session refresh, REST/RLS and responsive thumbnails work with no browser connection to Supabase',async({page})=>{
 const direct=await fixture(page);
 let releasePrices!:()=>void;
 const pricesReady=new Promise<void>(resolve=>{releasePrices=resolve;});
 await page.route('**/api/competition/leaderboard?*',async route=>{
  await pricesReady;
  await route.fulfill({json:{items:[{id:teamId,cost:25}]}});
 });
 const backgroundProfiles:string[]=[];
 const capabilities:string[]=[];
 page.on('request',request=>{
  const path=new URL(request.url()).pathname;
  if(path==='/teams/'+teamId)backgroundProfiles.push(path);
  if(path==='/api/admin/capabilities')capabilities.push(path);
 });
 try {
  await cookie(page,Math.floor(Date.now()/1000)-120);await page.goto('/teams');
  await expect(page.getByText('Gateway Team',{exact:true})).toBeVisible();
  await expect.poll(()=>calls.some(c=>c.path==='/auth/v1/token?grant_type=refresh_token')).toBe(true);
 } finally {
  releasePrices();
 }
 const image=page.getByRole('img',{name:'Gateway Team',exact:true});await expect(image).toHaveAttribute('srcset',/\/_next\/image\?/);
 await expect.poll(()=>image.evaluate(element=>(element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
 const thumbnailUrl=await image.evaluate(element=>(element as HTMLImageElement).currentSrc);
 expect(new URL(thumbnailUrl).pathname).toBe('/_next/image');
 const thumbnail=await page.request.get(thumbnailUrl);
 expect(thumbnail.ok()).toBe(true);
 const thumbnailBytes=(await thumbnail.body()).length;
 expect(thumbnailBytes).toBeLessThan(teamPhoto.length/2);
 console.log(`Catalog thumbnail: ${thumbnailBytes} bytes of ${teamPhoto.length} original bytes`);
 expect(backgroundProfiles).toEqual([]);expect(capabilities).toEqual([]);
 await page.getByRole('button',{name:'Открыть меню',exact:true}).click();
 await expect.poll(()=>capabilities.length).toBe(1);
 const rest=calls.find(c=>c.path.startsWith('/rest/v1/teams'));expect(rest?.headers.apikey).toBe('local-test-not-a-production-key');expect(rest?.headers.cookie).toBeUndefined();expect(direct).toEqual([]);
});

test('password recovery request reaches auth backend through the site',async({page})=>{
 const direct=await fixture(page);await page.goto('/auth?mode=reset');await page.getByRole('textbox',{name:'Email',exact:true}).fill(user.email);
 await page.getByRole('button',{name:'Отправить письмо',exact:true}).click();await expect.poll(()=>calls.some(c=>c.path.startsWith('/auth/v1/recover'))).toBe(true);
 await page.getByPlaceholder('Код из письма').fill('123456');await page.getByRole('button',{name:'Подтвердить код',exact:true}).click();
 await page.getByPlaceholder('Новый пароль',{exact:true}).fill('new-test-password');await page.getByPlaceholder('Повторите пароль',{exact:true}).fill('new-test-password');
 await page.getByRole('button',{name:'Сохранить пароль',exact:true}).click();await expect(page).toHaveURL(/\/profile/);
 expect(calls.some(c=>c.path==='/auth/v1/user'&&c.method==='PUT'&&c.body.password==='new-test-password')).toBe(true);expect(direct).toEqual([]);
});

test('email confirmation link verifies only after explicit click on our website and stores the same session cookie',async({page})=>{
 const direct=await fixture(page);await page.goto('/auth/confirm?token_hash=isolated-test-hash&type=signup');
 await expect(page.getByRole('button',{name:'Подтвердить почту',exact:true})).toBeVisible();expect(calls.some(c=>c.path==='/auth/v1/verify')).toBe(false);
 await page.getByRole('button',{name:'Подтвердить почту',exact:true}).click();await expect(page).toHaveURL(/\/profile/);
 expect(calls.some(c=>c.path==='/auth/v1/verify'&&c.body.token_hash==='isolated-test-hash')).toBe(true);expect((await page.context().cookies()).some(c=>c.name.startsWith('sb-127-auth-token'))).toBe(true);expect(direct).toEqual([]);
});

test('chat receives new messages by visible-page polling without any direct WebSocket connection',async({page})=>{
 const direct=await fixture(page);await cookie(page);const room='00000000-0000-4000-8000-000000998903';let updated=false,reads=0;const sockets:string[]=[];
 page.on('websocket',socket=>sockets.push(socket.url()));
 await page.route('**/api/chat*',route=>{
  const url=new URL(route.request().url());if(route.request().method()==='POST')return route.fulfill({json:{ok:true}});
  if(url.searchParams.has('roomId')){reads++;return route.fulfill({json:{messages:updated?[{id:'00000000-0000-4000-8000-000000998904',roomId:room,position:1,body:'Сообщение через шлюз',version:1,createdAt:user.created_at,editedAt:null,deleted:false,pinned:false,author:{id:userId,nickname:'Gateway Player',avatar:null},reply:null}]:[],pins:[],mutes:[],canWrite:true,lastRead:0,hasOlder:false,hasNewer:false}});}
  return route.fulfill({json:{userId,isAdmin:false,unreadRooms:0,nextCursor:null,rooms:[{id:room,kind:'common',ownerId:null,nickname:null,avatar:null,unread:false,updatedAt:user.created_at}]}});
 });
 await page.goto('/chat');await expect.poll(()=>reads).toBeGreaterThan(0);updated=true;
 await expect(page.getByText('Сообщение через шлюз',{exact:true})).toBeVisible({timeout:15000});expect(sockets).toEqual([]);expect(direct).toEqual([]);
});

test('gateway blocks admin/open-proxy routes, cross-site writes and private response caching',async({request})=>{
 const denied=await request.get('/api/backend/auth/v1/admin/users');expect(denied.status()).toBe(404);
 const cross=await request.post('/api/backend/auth/v1/signup',{headers:{origin:'https://evil.invalid'},data:{email:user.email}});expect(cross.status()).toBe(403);
 const auth=await request.post('/api/backend/auth/v1/token?grant_type=password',{headers:{origin:'http://127.0.0.1:3106'},data:{email:user.email,password:'test-only'}});
 expect(auth.status()).toBe(200);expect(auth.headers()['cache-control']).toContain('private, no-store');expect(auth.headers()['set-cookie']).toBeUndefined();
});
