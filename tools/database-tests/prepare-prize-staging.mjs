import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {assertTestDatabaseTarget} from '../../src/platform/environment.ts';
import {createHash,randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const ref='swjdbeelqzdleefscuuc';
assertTestDatabaseTarget(`https://${ref}.supabase.co`);
const token=(await readFile('C:/Users/Lenovo/.supabase/access-token','utf8')).trim();
const dir=new URL('./artifacts/prize-wallets/',import.meta.url);await mkdir(dir,{recursive:true});
async function request(path,body){
 const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error(`Staging request HTTP ${response.status}: ${(await response.text()).slice(0,500)}`);
 return response.json();
}
const state=await request('database/query/read-only',{query:`select
 to_regprocedure('public.u5_utility_price(numeric,numeric)')::text valuation,
 to_regclass('public.coin_accounts')::text coin_accounts,
 (select count(*) from profiles)::int profiles,
 (select count(*) from events)::int events,
 (select jsonb_agg(jsonb_build_object('id',p.id,'nickname',p.nickname,'owner',public.is_owner(p.id))) from profiles p join user_roles r on r.user_id=p.id where r.role in('admin','superadmin')) admins,
 to_regclass('supabase_migrations.schema_migrations')::text migration_table`});
await writeFile(new URL('staging-inspection.json',dir),JSON.stringify(state,null,2));
console.log(JSON.stringify({project:ref,...state[0]}));
if(!process.argv.includes('--apply'))process.exit(0);
if(state[0].coin_accounts&&!process.argv.includes('--finish'))throw Error('Wallet migration already present; use --finish for fixture setup only');
if(!state[0].coin_accounts){
const previous=await request('database/query/read-only',{query:`select
 (select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid))) from pg_proc p where p.pronamespace='public'::regnamespace and p.prokind='f') functions,
 (select jsonb_agg(to_jsonb(w)) from site_wallets w) wallets,
 (select count(*) from currency_ledger) ledger_count,
 (select count(*) from event_sessions) sessions`});
await writeFile(new URL('before-staging.json',dir),JSON.stringify(previous));
const names=[...(state[0].valuation?[]:['202610290001_organization_values.sql','202610290002_registration_reserve.sql']),
 '202610290003_main_coin_wallets.sql','202610290004_prize_reservations.sql'];
let body='';const hashes=[];
for(const name of names){
 const sql=await readFile(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8');
 body+=sql.replace(/^begin;/i,'').replace(/commit;\s*$/i,'')+'\n';
 hashes.push({name,sha256:createHash('sha256').update(sql).digest('hex')});
}
await request('database/query',{query:`begin;set local lock_timeout='5s';set local statement_timeout='40s';${body}rollback;`});
const rolledBack=await request('database/query/read-only',{query:"select to_regclass('public.coin_accounts')::text coin_accounts"});
if(rolledBack[0].coin_accounts!==null)throw Error('Staging rollback failed');
await request('database/query',{query:`begin;set local lock_timeout='5s';set local statement_timeout='40s';${body}commit;`});
await writeFile(new URL('staging-applied.json',dir),JSON.stringify({project:ref,appliedAt:new Date().toISOString(),hashes,transactionRollbackVerified:true},null,2));
}
await request('database/query',{query:"notify pgrst, 'reload schema';"});
const privateEnv=JSON.parse(await readFile(new URL('../../../ff-update-2/tools/database-tests/artifacts/local-staging-private.json',import.meta.url),'utf8'));
assertTestDatabaseTarget(privateEnv.NEXT_PUBLIC_SUPABASE_URL);
if(new URL(privateEnv.NEXT_PUBLIC_SUPABASE_URL).hostname!==`${ref}.supabase.co`)throw Error('Wrong staging credentials');
const db=createClient(privateEnv.NEXT_PUBLIC_SUPABASE_URL,privateEnv.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const email='stepanklinov8@gmail.com';let password=randomBytes(24).toString('base64url')+'Aa1!';
let owner=state[0].admins?.find(a=>a.owner)?.id;
if(owner){
 const {data,error}=await db.auth.admin.getUserById(owner);
 if(error||data.user.user_metadata.prize_wallet_fixture!==true)throw Error('Existing owner is not this isolated fixture; do not change its credentials');
 const {error:passwordError}=await db.auth.admin.updateUserById(owner,{password});if(passwordError)throw passwordError;
}else{
 const {data:created,error:createError}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{nickname:'OMCITE Тест',game_id:'9900291001',contact_social_url:'https://t.me/omcite_test',prize_wallet_fixture:true}});
 if(createError)throw Error(`Test owner creation failed: ${createError.message}`);owner=created.user.id;
}
await writeFile(new URL('local-login-private.json',dir),JSON.stringify({project:ref,userId:owner,email,password}));
await request('database/query',{query:`insert into public.user_roles(user_id,role) values('${owner}','superadmin') on conflict(user_id) do update set role=excluded.role;
select public.u6_coin_action('${owner}','7eddb20d-6d7d-46b2-bac3-76f4b9191e64','adjust',jsonb_build_object('kind','player','ownerId','${owner}','amount',1000000,'reason','Тестовое начисление создателю для локальной проверки'));`});
await writeFile(new URL('local-staging-private.json',dir),JSON.stringify(privateEnv));
await writeFile(new URL('local-login-private.json',dir),JSON.stringify({project:ref,userId:owner,email,password}));
await writeFile(new URL('local-test-login.md',dir),`# Локальная проверка кошельков\n\nСайт: http://127.0.0.1:3001/wallet\n\nТолько тестовый проект ff-update-2-staging. Это не пароль рабочего сайта.\n\nПочта: ${email}\n\nПароль: ${password}\n\nОсновной тестовый баланс: 1 000 000 OMCITE Coins.\n`);
console.log(JSON.stringify({stagingApplied:true,testOwnerReady:true,credentialsSavedLocally:true,productionChanged:false}));
