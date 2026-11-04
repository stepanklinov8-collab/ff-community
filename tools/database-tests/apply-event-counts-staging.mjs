import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {assertTestDatabaseTarget,stagingProject} from '../../src/platform/environment.ts';
assertTestDatabaseTarget(`https://${stagingProject}.supabase.co`);
if(!process.argv.includes('--apply'))throw Error('Explicit --apply required for the named staging project');
const name='202611020001_event_registration_counts.sql',sql=await readFile(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8');
const hash=createHash('sha256').update(sql).digest('hex');
const token=(await readFile('C:/Users/Lenovo/.supabase/access-token','utf8')).trim();
async function query(query,readOnly=true){const r=await fetch(`https://api.supabase.com/v1/projects/${stagingProject}/database/query${readOnly?'/read-only':''}`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(60000)});if(!r.ok){await writeFile(new URL('./artifacts/contracts/optimization-staging-error-private.txt',import.meta.url),await r.text());throw Error('Staging request '+r.status);}return r.json();}
const inspection=`select (select count(*) from profiles)::int profiles,(select count(*) from teams)::int organizations,(select count(*) from team_members)::int members,(select count(*) from event_registrations)::int registrations,(select coalesce(sum(balance),0)::text from site_wallets) demo,(select coalesce(sum(balance),0)::text from coin_accounts) main,to_regprocedure('public.u5_event_registration_counts(uuid)') is not null installed`;
const before=(await query(inspection))[0];if(before.installed)throw Error('Aggregate count function already installed; inspect before replay');
const body=sql.replace(/^begin;\s*$/mi,'').replace(/^commit;\s*$/mi,'');
await query(`begin;${body}\nrollback;`,false);
const rolled=(await query(inspection))[0];if(JSON.stringify(before)!==JSON.stringify(rolled))throw Error('Staging rollback changed protected state');
// This dedicated fixture project has no CLI-owned schema_migrations journal.
await query(`begin;${body}\ncomment on function public.u5_event_registration_counts(uuid) is 'OMCITE staging migration ${name} SHA256 ${hash}';commit;`,false);
const after=(await query(inspection))[0];for(const key of ['profiles','organizations','members','registrations','demo','main'])if(before[key]!==after[key])throw Error('Staging integrity mismatch '+key);
await query("notify pgrst, 'reload schema'",false);
await writeFile(new URL('./artifacts/contracts/optimization-staging-proof.json',import.meta.url),JSON.stringify({project:stagingProject,name,hash,before,after,verified:true,rollbackVerified:true,checkedAt:new Date().toISOString()},null,2));
console.log('PASS: dedicated staging migration, rollback and unchanged users/rosters/main/demo balances');
