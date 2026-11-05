// Only the dedicated staging database is allowed; production is never targeted.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {assertTestDatabaseTarget,stagingProject} from '../../src/platform/environment.ts';
assertTestDatabaseTarget(`https://${stagingProject}.supabase.co`);
if(process.argv.slice(2).some(arg=>!['--apply','--details','--withdrawal-contacts'].includes(arg)))throw Error('Only --apply, --details and --withdrawal-contacts are accepted');
const details=process.argv.includes('--details'),contacts=process.argv.includes('--withdrawal-contacts');
if(details&&contacts)throw Error('Select one migration');
const name=contacts?'202611050003_withdrawal_notification_contacts.sql':details?'202611050002_withdrawal_details_and_request_contacts.sql':'202611050001_funding_requests_notifications.sql';
const markerFunction=details?'public.coin_request_notify()':'public.coin_deposit_action(uuid,uuid,text,jsonb)';
const markerTarget=contacts?'trigger coin_withdrawal_notify on public.coin_withdrawals':'function '+markerFunction;
const markerRead=contacts?"(select obj_description(oid,'pg_trigger') from pg_trigger where tgrelid='public.coin_withdrawals'::regclass and tgname='coin_withdrawal_notify')":"case when to_regprocedure('"+markerFunction+"') is not null then obj_description(to_regprocedure('"+markerFunction+"'),'pg_proc') end";
const sql=await readFile(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8');
const sha256=createHash('sha256').update(sql).digest('hex');
const token=(await readFile('C:/Users/Lenovo/.supabase/access-token','utf8')).trim();
async function query(query,readOnly=true){
 const response=await fetch(`https://api.supabase.com/v1/projects/${stagingProject}/database/query${readOnly?'/read-only':''}`,{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(60000),
 });
 if(!response.ok){await writeFile(new URL('./artifacts/contracts/finance-staging-error-private.txt',import.meta.url),await response.text());throw Error('Staging request failed: '+response.status);}
 return response.json();
}
const inspection=`select jsonb_build_object(
 'profiles',(select count(*) from profiles),'organizations',(select count(*) from teams),'members',(select count(*) from team_members),
 'registrations',(select count(*) from event_registrations),
 'coins',(select md5(coalesce(string_agg(id||':'||balance||':'||reserved,',' order by id),'')) from coin_accounts),
 'forecasts',(select md5(coalesce(string_agg(user_id||':'||balance,',' order by user_id),'')) from site_wallets)
 ) protected,
 ${contacts?markerRead+' is not null':details?"exists(select 1 from information_schema.columns where table_schema='public' and table_name='coin_withdrawals' and column_name='full_name_latin')":"to_regclass('public.coin_deposits') is not null"} installed,
 to_regprocedure('public.u6_coin_action(uuid,uuid,text,jsonb)') is not null ${details||contacts?"and to_regclass('public.coin_deposits') is not null":''} base_installed,
 ${markerRead} marker`;
const before=(await query(inspection))[0];
if(!before.base_installed)throw Error('Staging financial foundation missing');
if(before.installed){
 if(before.marker!==`OMCITE staging migration ${name} SHA256 ${sha256}`)throw Error('Existing migration needs review before replay');
 console.log(JSON.stringify({project:stagingProject,alreadyInstalled:true,sha256}));
}else if(!process.argv.includes('--apply')){
 console.log(JSON.stringify({project:stagingProject,writes:false,ready:true,sha256}));
}else{
 const body=sql.replace(/^begin;\s*$/mi,'').replace(/^commit;\s*$/mi,'');
 await query(`begin;set local lock_timeout='5s';${body}\nrollback;`,false);
 const rolled=(await query(inspection))[0];
 if(JSON.stringify(before)!==JSON.stringify(rolled))throw Error('Staging rollback changed protected state');
 await query(`begin;set local lock_timeout='5s';${body}\ncomment on ${markerTarget} is 'OMCITE staging migration ${name} SHA256 ${sha256}';commit;notify pgrst,'reload schema';`,false);
 const after=(await query(inspection))[0];
 if(JSON.stringify(before.protected)!==JSON.stringify(after.protected)||!after.installed)throw Error('Staging integrity check failed');
 await writeFile(new URL(contacts?'./artifacts/contracts/finance-withdrawal-contacts-staging-proof.json':details?'./artifacts/contracts/finance-details-staging-proof.json':'./artifacts/contracts/finance-staging-proof.json',import.meta.url),JSON.stringify({project:stagingProject,name,sha256,verified:true,rollbackVerified:true,checkedAt:new Date().toISOString(),before,after},null,2));
 console.log('PASS: staging finance migration, rollback rehearsal and unchanged users/organizations/registrations/main/AP account fingerprints');
}
