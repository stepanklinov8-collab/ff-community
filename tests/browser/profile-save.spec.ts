import {test, expect, type Page} from '@playwright/test';
import {createServer, type Server} from 'node:http';

// Exercise the real Next API and UI together. Only the external Auth/PostgREST
// transport is replaced; there is no connection to a real user's database.
const userId='00000000-0000-4000-8000-000000009100';
const token=[{alg:'HS256',typ:'JWT'},{sub:userId,exp:4102444800},'test-only']
  .map(v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url')).join('.');
const initial=()=>({id:userId,nickname:'Старый ник',game_id:'123456789',bio:'',phone:'',
  contact_social_url:null as string|null,player_roles:[] as string[],locale:'ru',avatar_url:'',
  profile_level:1,reputation_score:50,reputation_events_count:0,main_rating:null});
let profile=initial();
let metadata:Record<string,unknown>={};
let server:Server;
let rejectRead=false,ignoreWrite=false,failMetadata=false;
let writes=0,localeWrites=0;
const metadataUpdates:Record<string,unknown>[]=[];
const authUser=()=>({id:userId,aud:'authenticated',role:'authenticated',email:'profile-test@example.invalid',
  app_metadata:{},user_metadata:metadata,created_at:'2026-01-01T00:00:00Z'});

test.beforeAll(async()=>{
  server=createServer(async(req,res)=>{
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Access-Control-Allow-Headers','authorization,apikey,content-type,x-client-info,prefer,x-supabase-api-version');
    res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,PATCH,OPTIONS');
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
    const send=(value:unknown,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
    const url=new URL(req.url!,'http://127.0.0.1:54321');
    const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
    const body=chunks.length?JSON.parse(Buffer.concat(chunks).toString()):{};
    if(url.pathname==='/auth/v1/user'){
      if(req.headers.authorization!==`Bearer ${token}`)return send({message:'Invalid JWT'},401);
      return send(authUser());
    }
    if(url.pathname===`/auth/v1/admin/users/${userId}`){
      metadataUpdates.push(body.user_metadata);
      if(failMetadata)return send({message:'Auth unavailable',code:'unexpected_failure'},503);
      metadata={...metadata,...body.user_metadata};return send(authUser());
    }
    const single=req.headers.accept?.includes('application/vnd.pgrst.object+json');
    const rows=(values:unknown[])=>send(single?values[0]??null:values);
    if(url.pathname==='/rest/v1/profiles'){
      if(req.method==='GET'){
        if(rejectRead)return send({message:'Profile read unavailable',code:'XX000'},500);
        if(url.searchParams.get('id')?.startsWith('neq.'))return rows([]);
        return rows([profile]);
      }
      if(req.method==='POST'){
        writes++;
        if(!ignoreWrite)profile={...profile,...body};
        return rows([profile]);
      }
      if(req.method==='PATCH'){
        localeWrites++;profile={...profile,...body};return send(null,200);
      }
    }
    if(url.pathname==='/rest/v1/site_wallets')return rows([{balance:1000}]);
    return rows([]);
  });
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(54321,'127.0.0.1',resolve);});
});
test.afterAll(async()=>{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));});
test.beforeEach(()=>{
  profile=initial();metadata={nickname:profile.nickname,game_id:profile.game_id,locale:'ru',unrelated:'preserve'};
  rejectRead=false;ignoreWrite=false;failMetadata=false;writes=0;localeWrites=0;metadataUpdates.length=0;
});

async function login(page:Page){
  const value='base64-'+Buffer.from(JSON.stringify({access_token:token,refresh_token:'test',expires_at:4102444800,
    expires_in:86400,token_type:'bearer',user:authUser()})).toString('base64url');
  await page.context().addCookies([{name:'sb-127-auth-token',value,domain:'127.0.0.1',path:'/',sameSite:'Lax'}]);
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/profile'||path==='/api/profile/locale')return route.continue();
    if(path==='/api/profile/warnings')return route.fulfill({json:{activeWarnings:[],warningCount:0,history:[],activeBan:null}});
    return route.fulfill({json:{summaries:[],history:[],hasMore:false,goldOrganizer:false,modules:[],warnings:[],
      sanctions:[],canOpenAdmin:false,notifications:[],unreadCount:0}});
  });
  await page.goto('/profile');
}
const contact=(page:Page)=>page.getByRole('textbox',{name:/Ссылка для связи/});

test('saved nickname, contact, roles, description and locale survive a full reload and update the header',async({page})=>{
  await login(page);
  await expect(contact(page)).toBeVisible();
  await expect(contact(page)).toHaveAttribute('required','');
  await page.getByRole('button',{name:'Сохранить изменения',exact:true}).click();
  expect(writes).toBe(0);
  await page.getByLabel('Игровой ник',{exact:true}).fill(' Новый ник ');
  await page.getByLabel('Free Fire ID',{exact:true}).fill('987654321');
  await page.getByLabel('Телефон или контакт',{exact:true}).fill('Дополнительный контакт');
  await contact(page).fill('https://t.me/saved_player');
  await page.getByRole('textbox',{name:/^О себе/}).fill('Описание игрока');
  await page.getByLabel('Снайпер',{exact:true}).check();
  await page.getByRole('combobox',{name:/^Язык/}).selectOption('kk');
  await page.getByRole('button',{name:'Сохранить изменения',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Профиль сохранён');
  await expect(page.locator('.header-account')).toContainText('Новый ник');
  expect(writes).toBe(1);expect(localeWrites).toBe(0);
  expect(metadataUpdates[0]).not.toHaveProperty('unrelated');
  expect(profile.contact_social_url).toBe('https://t.me/saved_player');
  await page.reload();
  await page.getByRole('button',{name:'Редактировать профиль'}).click();
  await expect(page.getByLabel('Игровой ник',{exact:true})).toHaveValue('Новый ник');
  await expect(page.getByLabel('Free Fire ID',{exact:true})).toHaveValue('987654321');
  await expect(page.getByLabel('Телефон или контакт',{exact:true})).toHaveValue('Дополнительный контакт');
  await expect(contact(page)).toHaveValue('https://t.me/saved_player');
  await expect(page.getByRole('textbox',{name:/^О себе/})).toHaveValue('Описание игрока');
  await expect(page.getByLabel('Снайпер',{exact:true})).toBeChecked();
  await expect(page.getByRole('combobox',{name:/^Язык/})).toHaveValue('kk');
  expect(localeWrites).toBe(0);
});

test('an unconfirmed database write never displays saved and preserves the entered form',async({page})=>{
  await login(page);ignoreWrite=true;
  await page.getByLabel('Игровой ник',{exact:true}).fill('Новый ник');
  await contact(page).fill('https://vk.com/saved_player');
  await page.getByRole('button',{name:'Сохранить изменения',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'не подтвердил сохранение'})).toBeVisible();
  await expect(contact(page)).toHaveValue('https://vk.com/saved_player');
  expect(profile.contact_social_url).toBeNull();
  expect(metadataUpdates).toEqual([]);
});

test('a profile load failure is visible and cannot be saved as an empty profile',async({page})=>{
  rejectRead=true;await login(page);
  await expect(page.getByRole('button',{name:'Повторить загрузку профиля'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Редактировать профиль'})).toBeDisabled();
  expect(writes).toBe(0);
  rejectRead=false;await page.getByRole('button',{name:'Повторить загрузку профиля'}).click();
  await expect(contact(page)).toBeVisible();
});

test('Auth metadata failure does not erase committed profile values or the header after reload',async({page})=>{
  await login(page);failMetadata=true;
  await page.getByLabel('Игровой ник',{exact:true}).fill('Сохранённый ник');
  await contact(page).fill('https://max.ru/player');
  await page.getByRole('button',{name:'Сохранить изменения',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Профиль сохранён');
  await page.reload();
  await expect(page.locator('.header-account')).toContainText('Сохранённый ник');
  await page.getByRole('button',{name:'Редактировать профиль'}).click();
  await expect(contact(page)).toHaveValue('https://max.ru/player');
});

test('server requires an approved contact and language updates contain no stale identity fields',async({request})=>{
  const headers={Authorization:`Bearer ${token}`};
  const data={nickname:'Новый ник',gameId:'123456789',bio:'',phone:'',playerRoles:[],locale:'ru'};
  for(const contactSocialUrl of ['', 'https://youtube.com/@player', 'https://tiktok.com/@player']){
    const response=await request.patch('/api/profile',{headers,data:{...data,contactSocialUrl}});
    expect(response.status()).toBe(400);
  }
  expect(writes).toBe(0);
  for(const contactSocialUrl of ['https://t.me/player','https://vk.com/player','https://max.ru/player','https://instagram.com/player']){
    const response=await request.patch('/api/profile',{headers,data:{...data,contactSocialUrl}});
    expect(response.ok()).toBeTruthy();
    expect((await response.json()).profile.contactSocialUrl).toBe(contactSocialUrl);
  }
  const response=await request.patch('/api/profile/locale',{headers,data:{locale:'ky'}});
  expect(response.ok()).toBeTruthy();
  expect(metadataUpdates.at(-1)).toEqual({locale:'ky'});
  expect(metadata.nickname).toBe('Новый ник');
  expect(metadata.unrelated).toBe('preserve');
  expect((await request.patch('/api/profile',{data:{...data,contactSocialUrl:'https://t.me/player'}})).status()).toBe(401);
});
