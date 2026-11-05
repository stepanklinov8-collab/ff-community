// Read-only production preflight. Writes local, reviewed SQL; never applies it.
import {readFile,writeFile,realpath} from 'node:fs/promises';
import {resolve,relative,join,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {productionProject,stagingProject} from '../../src/platform/environment.ts';
const args=process.argv.slice(2),argument=args.find(arg=>arg.startsWith('--backup='))?.slice(9);
if(args.length!==1||!argument)throw Error('Only --backup=<verified backup directory> is accepted');
const root=await realpath(resolve('tools/database-tests/artifacts/release-backup')),directory=await realpath(resolve(argument));
if(directory===root||relative(root,directory).startsWith('..')||isAbsolute(relative(root,directory)))throw Error('Select a release-backup child directory');
const proof=JSON.parse(await readFile(join(directory,'restore-proof.json'),'utf8'));
const hash=createHash('sha256').update(await readFile(join(directory,'database.dump'))).digest('hex');
const age=Date.now()-Date.parse(proof.capturedAt);
if(proof.sourceProject!==productionProject||proof.targetProject!==stagingProject||!proof.verified||!proof.rollbackVerified||proof.sha256!==hash||!Number.isFinite(age)||age<0||age>86400000)throw Error('Fresh, fully restored backup required');
const names=['202611050001_funding_requests_notifications.sql','202611050002_withdrawal_details_and_request_contacts.sql','202611050003_withdrawal_notification_contacts.sql'];
if(proof.updateMigrations?.map(row=>row.name).join(',')!==names.join(','))throw Error('Restore must rehearse exactly the three finance migrations');
const files=await Promise.all(names.map(async name=>{
 const sql=await readFile(resolve('supabase/migrations',name),'utf8'),sha256=createHash('sha256').update(sql).digest('hex');
 if(proof.updateMigrations.find(row=>row.name===name)?.sha256!==sha256)throw Error('Migration changed since full restore');
 return {name,sql,sha256,version:name.slice(0,12),label:name.slice(13,-4)};
}));
if(execFileSync('git',['status','--porcelain'],{encoding:'utf8',windowsHide:true}).trim())throw Error('Commit reviewed source before preparing the final plan');
const sourceHead=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();
const snapshot=`select jsonb_build_object(
 'profiles',(select count(*) from profiles),'organizations',(select count(*) from teams),'members',(select count(*) from team_members),
 'registrations',(select count(*) from event_registrations),
 'main',(select md5(coalesce(string_agg(id||':'||balance||':'||reserved,',' order by id),'')) from coin_accounts),
 'forecasts',(select md5(coalesce(string_agg(user_id||':'||balance,',' order by user_id),'')) from site_wallets),
 'withdrawals',(select md5(coalesce(string_agg((to_jsonb(w)-'full_name_latin'-'transfer_country')::text,',' order by w.id),'')) from coin_withdrawals w)
 )`;
const token=(await readFile('C:/Users/Lenovo/.supabase/access-token','utf8')).trim();
const response=await fetch(`https://api.supabase.com/v1/projects/${productionProject}/database/query/read-only`,{
 method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
 body:JSON.stringify({query:`select (${snapshot}) protected,to_regclass('public.coin_deposits') is not null finance_installed,
 (select max(version) from supabase_migrations.schema_migrations) latest_migration,
 (select count(*) from supabase_migrations.schema_migrations where version>='202611050001') later_migrations,
 pg_get_functiondef('public.u6_coin_action(uuid,uuid,text,jsonb)'::regprocedure) original_wallet_function,
 pg_get_functiondef('public.organization_wallet_withdrawals(uuid)'::regprocedure) original_withdrawal_list`}),signal:AbortSignal.timeout(30000),
});
if(!response.ok)throw Error('Production read-only preflight HTTP '+response.status);
const state=(await response.json())[0];
if(state.finance_installed||Number(state.later_migrations)||state.latest_migration!=='202611020001')throw Error('Production schema changed; review before preparing a replay');
const literal=value=>"'"+value.replaceAll("'","''")+"'";
const sql=`-- PREPARED ONLY: production ${productionProject}; source ${sourceHead}; backup ${hash}
-- Recreate this plan if backup age, source or production schema changes.
begin isolation level repeatable read;
set local lock_timeout='5s';set local statement_timeout='60s';
select pg_advisory_xact_lock(hashtext('omcite_finance_requests_release'));
do $$begin
 if exists(select 1 from supabase_migrations.schema_migrations where version>='202611050001')
 or to_regclass('public.coin_deposits') is not null then raise exception 'FINANCE_RELEASE_REINSPECTION_REQUIRED';end if;
end $$;
create temporary table finance_protected_before as ${snapshot} value;
${files.map(file=>file.sql.replace(/^begin;\s*$/mi,'').replace(/^commit;\s*$/mi,'')+`\ninsert into supabase_migrations.schema_migrations(version,name,statements) values(${literal(file.version)},${literal(file.label)},array[${literal('-- OMCITE RELEASE SHA256: '+file.sha256)},${literal(file.sql)}]);`).join('\n')}
do $$begin
 if (select value from finance_protected_before)<>(${snapshot}) then raise exception 'FINANCE_RELEASE_PROTECTED_DATA_CHANGED';end if;
 if (select count(*) from coin_deposits)<>0 or(select count(*) from coin_request_deliveries)<>0 then raise exception 'FINANCE_RELEASE_UNEXPECTED_REQUESTS';end if;
 if has_table_privilege('authenticated','coin_deposits','select') or has_function_privilege('authenticated','coin_deposit_action(uuid,uuid,text,jsonb)','execute') then raise exception 'FINANCE_RELEASE_ACL';end if;
end $$;
notify pgrst,'reload schema';
commit;
`;
const output=resolve('tools/database-tests/artifacts/contracts');
await writeFile(join(output,'finance-production.sql'),sql);
const rollback=`-- EMERGENCY CODE COMPATIBILITY ROLLBACK ONLY; source ${sourceHead}
-- Preserves new tables, requests, migration journal and all completed payments.
-- Coordinate with promotion of the previous application deployment.
begin isolation level repeatable read;
set local lock_timeout='5s';set local statement_timeout='60s';
select pg_advisory_xact_lock(hashtext('omcite_finance_requests_release'));
do $$begin
 if (select count(*) from supabase_migrations.schema_migrations where version between '202611050001' and '202611050003')<>3
 or exists(select 1 from supabase_migrations.schema_migrations where version>'202611050003') then raise exception 'ROLLBACK_REVIEW_REQUIRED';end if;
end $$;
create temporary table finance_rollback_before as ${snapshot} value;
${state.original_wallet_function};
${state.original_withdrawal_list};
do $$begin if (select value from finance_rollback_before)<>(${snapshot}) then raise exception 'ROLLBACK_PROTECTED_DATA_CHANGED';end if;end $$;
notify pgrst,'reload schema';
commit;
`;
await writeFile(join(output,'finance-rollback-functions.sql'),rollback);
await writeFile(join(output,'finance-production-plan.json'),JSON.stringify({project:productionProject,writes:false,sourceHead,checkedAt:new Date().toISOString(),
 backupDirectory:directory,backupSha256:hash,capturedAt:proof.capturedAt,restoredAt:proof.restoredAt,protected:state.protected,
 migrations:files.map(({name,sha256})=>({name,sha256})),sqlSha256:createHash('sha256').update(sql).digest('hex'),rollbackSha256:createHash('sha256').update(rollback).digest('hex')},null,2));
console.log(JSON.stringify({prepared:true,writes:false,project:productionProject,sourceHead,migrations:files.length,backupVerified:true}));
