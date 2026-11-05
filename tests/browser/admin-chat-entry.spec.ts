import {test,expect,type Page} from '@playwright/test';
import {createServer,type Server} from 'node:http';

const admin='10000000-0000-4000-8000-000000009700',player='10000000-0000-4000-8000-000000009701',room='10000000-0000-4000-8000-000000009799';
const user={id:admin,aud:'authenticated',role:'authenticated',email:'chat-admin@example.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
let server:Server,role='admin',actorAllowed=true,targetAllowed=true;
const mutations:Array<{p_actor:string;p_input:Record<string,unknown>}>=[];

test.beforeAll(async()=>{
 server=createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','authorization,apikey,content-type,x-client-info,x-supabase-api-version,accept-profile');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  const url=new URL(req.url!,'http://127.0.0.1:54321');
  const send=(data:unknown,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  if(url.pathname==='/auth/v1/user')return send(user);
  if(url.pathname==='/rest/v1/user_roles')return send(role?[{role}]:[]);
  const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const body=chunks.length?JSON.parse(Buffer.concat(chunks).toString()):{};
  if(url.pathname==='/rest/v1/rpc/chat_query')return actorAllowed?send({userId:admin,rooms:[]}):send({message:'CHAT_AUTH',code:'42501'},403);
  if(url.pathname==='/rest/v1/rpc/chat_mutate'){
   mutations.push(body);
   return targetAllowed?send({roomId:room}):send({message:'CHAT_AUTH',code:'42501'},403);
  }
  return send([]);
 });
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(54321,'127.0.0.1',resolve);});
});
test.afterAll(async()=>{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));});
test.beforeEach(()=>{mutations.length=0;role='admin';actorAllowed=true;targetAllowed=true;});

test('opening a support conversation requires a full administrator and enabled chat',async({request})=>{
 expect((await request.post('/api/admin/message',{data:{toUserId:player}})).status()).toBe(401);
 for(const nextRole of ['', 'moderator']){
  role=nextRole;
  expect((await request.post('/api/admin/message',{headers:{Authorization:'Bearer local-test'},data:{toUserId:player}})).status()).toBe(403);
 }
 for(const port of [3104,3105])expect((await request.post(`http://127.0.0.1:${port}/api/admin/message`,{data:{toUserId:player}})).status()).toBe(404);
 expect(mutations).toEqual([]);
});

test('admin opens only a support room, never sends as recipient or writes an old inbox message',async({request})=>{
 const post=(data:unknown)=>request.post('/api/admin/message',{headers:{Authorization:'Bearer local-test'},data});
 expect((await post({toUserId:player,subject:'Old subject',body:'Old text'})).status()).toBe(400);
 expect((await post({toUserId:'invalid'})).status()).toBe(400);expect(mutations).toHaveLength(0);
 const response=await post({toUserId:player});expect(response.status()).toBe(200);
 expect(response.headers()['cache-control']).toBe('private, no-store');
 expect(await response.json()).toEqual({success:true,link:'/chat?room='+room});
 expect(mutations).toEqual([{p_actor:player,p_input:{action:'open_support'}}]);
 actorAllowed=false;expect((await post({toUserId:player})).status()).toBe(403);expect(mutations).toHaveLength(1);
 actorAllowed=true;targetAllowed=false;expect((await post({toUserId:player})).status()).toBe(409);
});

async function login(page:Page){
 const token=[{alg:'HS256',typ:'JWT'},{sub:admin,exp:4102444800},'test-only'].map(v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url')).join('.');
 const value='base64-'+Buffer.from(JSON.stringify({access_token:token,refresh_token:'test',expires_at:4102444800,expires_in:86400,token_type:'bearer',user})).toString('base64url');
 await page.context().addCookies([{name:'sb-127-auth-token',value,domain:'127.0.0.1',path:'/',sameSite:'Lax'}]);
 await page.route('http://127.0.0.1:54321/**',route=>route.fulfill({json:route.request().url().includes('/auth/v1/user')?user:[]}));
 await page.route('**/api/**',route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/api/admin/message')return route.continue();
  if(url.pathname==='/api/admin/users')return route.fulfill({json:{users:[{id:player,email:'player@example.invalid',user_metadata:{nickname:'Игрок'},roles:[],created_at:user.created_at}]}});
  if(url.pathname==='/api/admin/events')return route.fulfill({json:{events:[]}});
  if(url.pathname==='/api/chat')return route.fulfill({json:url.searchParams.has('roomId')?{messages:[],pins:[],mutes:[],canWrite:true,lastRead:0,hasOlder:false,hasNewer:false}:{userId:admin,isAdmin:true,unreadRooms:0,nextCursor:null,rooms:[{id:room,kind:'support',ownerId:player,nickname:'Игрок',avatar:null,updatedAt:user.created_at,unread:false}]}});
  return route.fulfill({json:{canOpenAdmin:true,modules:[{id:'chat',href:'/chat',title:{ru:'Чат',kk:'Чат',ky:'Чат'}}]}});
 });
}

test('user list opens chat, sidebar has one chat entry, and archived messages remain accessible',async({page})=>{
 await login(page);await page.goto('/admin/users');
 await page.getByRole('button',{name:'Написать в чат',exact:true}).click();await expect(page).toHaveURL('/chat?room='+room);
 expect(mutations).toEqual([{p_actor:player,p_input:{action:'open_support'}}]);
 await page.getByRole('button',{name:'Открыть меню',exact:true}).click();
 const navigation=page.getByRole('complementary',{name:'Главная навигация'});
 await expect(navigation.getByRole('link',{name:'Чат',exact:true})).toHaveCount(1);
 await expect(navigation.locator('a[href="/messages"]')).toHaveCount(0);
 await page.goto('/messages');await expect(page.getByRole('heading',{name:'Архив сообщений'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Перейти в чат',exact:true})).toHaveAttribute('href','/chat');
});
