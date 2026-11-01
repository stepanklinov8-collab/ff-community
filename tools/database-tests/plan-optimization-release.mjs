// Read-only production inspection and reviewed SQL preparation. Never executes DDL.
import {readFile,writeFile,realpath} from 'node:fs/promises';
import {resolve,relative,join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {productionProject,stagingProject} from '../../src/platform/environment.ts';
const argument=process.argv.find(value=>value.startsWith('--backup='))?.slice(9);
if(!argument||process.argv.slice(2).some(value=>!value.startsWith('--backup=')))throw Error('Only --backup=<verified backup directory> is accepted; this command cannot apply changes');
const root=await realpath(resolve('tools/database-tests/artifacts/release-backup')),directory=await realpath(resolve(argument));
if(relative(root,directory).startsWith('..')||directory===root)throw Error('Select a release-backup child directory');
const proof=JSON.parse(await readFile(join(directory,'restore-proof.json'),'utf8'));
const hash=createHash('sha256').update(await readFile(join(directory,'database.dump'))).digest('hex');
if(proof.sourceProject!==productionProject||proof.targetProject!==stagingProject||proof.verified!==true||proof.rollbackVerified!==true||!proof.restoredAt||proof.sha256!==hash||!Number.isFinite(Date.parse(proof.capturedAt))||Date.now()-Date.parse(proof.capturedAt)>86400000)throw Error('A fresh verified rollback restore is required');
const names=['202611010001_user_activity_and_forecast_points.sql','202611020001_event_registration_counts.sql'];
if(proof.updateMigrations?.map(row=>row.name).join(',')!==names.join(','))throw Error('The restore must rehearse exactly this update');
const files=await Promise.all(names.map(async name=>{const sql=await readFile(resolve('supabase/migrations',name),'utf8'),sha256=createHash('sha256').update(sql).digest('hex');if(proof.updateMigrations.find(row=>row.name===name)?.sha256!==sha256)throw Error('Migration changed since rehearsal');return {name,sha256,sql,version:name.slice(0,12),label:name.slice(13,-4)};}));
const token=(await readFile('C:/Users/Lenovo/.supabase/access-token','utf8')).trim();
const snapshot=`select jsonb_build_object('profiles',(select count(*) from public.profiles),'organizations',(select count(*) from public.teams),'members',(select count(*) from public.team_members),'registrations',(select count(*) from public.event_registrations),'main',(select coalesce(sum(balance),0)::text from public.coin_accounts),'reserved',(select coalesce(sum(reserved),0)::text from public.coin_accounts),'forecasts',(select coalesce(sum(balance),0)::text from public.site_wallets))`;
const response=await fetch(`https://api.supabase.com/v1/projects/${productionProject}/database/query/read-only`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({query:`select (${snapshot}) protected,to_regclass('public.analytics_visits') is not null analytics_installed,to_regprocedure('public.u5_event_registration_counts(uuid)') is not null counts_installed,(select jsonb_agg(jsonb_build_object('version',version,'name',name,'statements',statements)) from supabase_migrations.schema_migrations where version>='202611010001') history`}),signal:AbortSignal.timeout(30000)});
if(!response.ok)throw Error('Read-only production inspection failed: '+response.status);
const state=(await response.json())[0];
if(state.analytics_installed||state.counts_installed||state.history?.length)throw Error('Update or later migrations already present; inspect before preparing any replay');
const literal=value=>"'"+value.replaceAll("'","''")+"'";
const sourceHead=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();
if(execFileSync('git',['status','--porcelain'],{encoding:'utf8',windowsHide:true}).trim())throw Error('Commit the reviewed source before preparing the final deployment plan');
const sql=`-- PREPARED ONLY; target ${productionProject}; source ${sourceHead}; backup ${hash}
-- Re-run preparation if source, migrations, backup age or production state changes.
begin isolation level repeatable read;
set local lock_timeout='5s';set local statement_timeout='60s';
select pg_advisory_xact_lock(hashtext('omcite_activity_optimization_release'));
do $$begin if exists(select 1 from supabase_migrations.schema_migrations where version>='202611010001') then raise exception 'RELEASE_REINSPECTION_REQUIRED';end if;end $$;
create temporary table optimization_protected_before as ${snapshot} value;
${files.map(file=>file.sql.replace(/^begin;\s*$/mi,'').replace(/^commit;\s*$/mi,'')+`\ninsert into supabase_migrations.schema_migrations(version,name,statements) values(${literal(file.version)},${literal(file.label)},array[${literal('-- OMCITE RELEASE SHA256: '+file.sha256)},${literal(file.sql)}]);`).join('\n')}
do $$begin if (select value from optimization_protected_before)<>(${snapshot}) then raise exception 'RELEASE_PROTECTED_DATA_CHANGED';end if;end $$;
notify pgrst,'reload schema';
commit;
`;
const output=resolve('tools/database-tests/artifacts/contracts');
await writeFile(join(output,'optimization-production.sql'),sql);
const plan={project:productionProject,writes:false,sourceHead,checkedAt:new Date().toISOString(),backupSha256:hash,capturedAt:proof.capturedAt,restoredAt:proof.restoredAt,protected:state.protected,migrations:files.map(({name,sha256})=>({name,sha256})),sqlSha256:createHash('sha256').update(sql).digest('hex')};
await writeFile(join(output,'optimization-production-plan.json'),JSON.stringify(plan,null,2));
console.log(JSON.stringify({prepared:true,project:productionProject,writes:false,sourceHead,migrations:files.length,backupVerified:true}));
