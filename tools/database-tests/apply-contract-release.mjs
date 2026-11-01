// Production is a separate, explicit operation. No automatic retries of DDL.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {productionProject,stagingProject} from '../../src/platform/environment.ts';
if(!process.argv.includes('--production')||!process.argv.includes('--project='+productionProject))throw Error('Select the exact production project explicitly');
const proofPath=process.argv.find(value=>value.startsWith('--restored-backup='))?.slice(18);
if(!proofPath)throw Error('A verified restore proof is required');
const proof=JSON.parse(await readFile(resolve(proofPath),'utf8'));
const archive=await readFile(join(dirname(resolve(proofPath)),'database.dump'));
if(proof.sourceProject!==productionProject||proof.targetProject!==stagingProject||proof.verified!==true||proof.rollbackVerified!==true||!proof.restoredAt||!Array.isArray(proof.updateMigrations)||
 createHash('sha256').update(archive).digest('hex')!==proof.sha256||Date.now()-Date.parse(proof.capturedAt)>86400000||!Number.isFinite(Date.parse(proof.capturedAt)))throw Error('A fresh, restored and rehearsed release backup is required');
const files=await Promise.all(proof.updateMigrations.map(async value=>{
 if(!/^202610\d{6}_[a-z_]+\.sql$/.test(value.name)||value.name<'202610290003')throw Error('Unexpected rehearsal migration');
 const sql=await readFile(resolve('supabase/migrations',value.name),'utf8');
 if(createHash('sha256').update(sql).digest('hex')!==value.sha256)throw Error('Migration differs from the successful rehearsal');
 return {...value,sql,version:value.name.slice(0,12),label:value.name.slice(13,-4)};
}));
if(files.length!==55||files.at(-1).name!=='202610310018_player_transfer_cancellation_penalty.sql')throw Error('Unexpected release boundary; rehearse the actual complete release');
const token=(await readFile('C:/Users/Lenovo/.supabase/access-token','utf8')).trim();
async function query(sql,readOnly=true){
 const response=await fetch(`https://api.supabase.com/v1/projects/${productionProject}/database/query${readOnly?'/read-only':''}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql}),signal:AbortSignal.timeout(180000)});
 if(!response.ok){await writeFile(join(artifacts,'production-error-private.json'),await response.text());throw Error(`Production request failed (${response.status}); private diagnostic saved`);}return response.json();
}
const artifacts=resolve('tools/database-tests/artifacts/contracts');await mkdir(artifacts,{recursive:true});
const literal=value=>"'"+value.replaceAll("'","''")+"'";
async function inspect(){
 const state=(await query(`select (select count(*) from profiles)::int profiles,(select count(*) from teams)::int organizations,(select count(*) from team_members)::int members,
 (select coalesce(sum(balance),0)::text from site_wallets) demo,to_regclass('public.coin_accounts') is not null wallets,
 (select jsonb_agg(jsonb_build_object('version',version,'name',name,'statements',case when version>='202610290003' then statements else null end) order by version) from supabase_migrations.schema_migrations) history`))[0];
 const amounts=state.wallets?(await query('select coalesce(sum(balance),0)::text main,coalesce(sum(reserved),0)::text reserved from coin_accounts'))[0]:{main:'0',reserved:'0'};
 return {...state,...amounts};
}
const before=await inspect(),recorded=new Map(before.history.map(value=>[value.version,value]));
const missing=files.filter(file=>!recorded.has(file.version));
if(missing.length&&before.wallets)throw Error('Wallet tables already exist without complete matching release history; inspect before any write');
for(const file of files.filter(file=>recorded.has(file.version))){if(!recorded.get(file.version).statements?.includes('-- OMCITE RELEASE SHA256: '+file.sha256))throw Error('Previously applied migration lacks matching release evidence');}
if(missing.length&&missing.length!==files.length)throw Error('Partial release history requires inspection; never blindly replay DDL');
console.log(JSON.stringify({project:productionProject,missingMigrations:missing.length,backupRestored:true,before:{profiles:before.profiles,organizations:before.organizations,members:before.members,demo:before.demo,main:before.main,reserved:before.reserved}}));
if(!process.argv.includes('--apply')||!missing.length)process.exit(0);
const runId=randomUUID(),path=join(artifacts,'production-release-'+runId+'.json');
const attempt={runId,project:productionProject,startedAt:new Date().toISOString(),backupSha256:proof.sha256,migrations:files.map(({name,sha256})=>({name,sha256})),before,status:'prepared'};
await writeFile(path,JSON.stringify(attempt,null,2));
const body=missing.map(file=>file.sql.replace(/^begin;\s*$/mi,'').replace(/^commit;\s*$/mi,'')).join('\n');
const history=missing.map(file=>`insert into supabase_migrations.schema_migrations(version,name,statements) values(${literal(file.version)},${literal(file.label)},array[${literal('-- OMCITE RELEASE SHA256: '+file.sha256)}]);`).join('\n');
// Establish the actual baseline under table locks inside the transaction;
// registrations or bets arriving between inspection and application are not
// mistaken for data loss. Requests may resume normally after COMMIT.
const baseline=`lock table profiles,teams,team_members,site_wallets in share row exclusive mode;
create temporary table omcite_release_before on commit drop as select
 (select count(*) from profiles) profiles,(select count(*) from teams) organizations,(select count(*) from team_members) members,
 coalesce((select sum(balance)::numeric from site_wallets),0) total;`;
const checks=`do $$begin
 if (select count(*) from profiles)<>(select profiles from omcite_release_before) or(select count(*) from teams)<>(select organizations from omcite_release_before) or(select count(*) from team_members)<>(select members from omcite_release_before) then raise exception 'RELEASE_ROSTER_COUNTS';end if;
 if coalesce((select sum(balance)::numeric from site_wallets),0)+coalesce((select sum(balance)::numeric from coin_accounts),0)<>(select total from omcite_release_before) then raise exception 'RELEASE_COIN_CONSERVATION';end if;
 if exists(select 1 from teams where owner_user_id is null and owner_team_id is null) then raise exception 'RELEASE_OWNER_BACKFILL';end if;
end $$;`;
let writeError;
try{await query(`begin;set local lock_timeout='5s';set local statement_timeout='150s';${baseline}\n${body}\n${history}\n${checks}\ncommit;`,false);}catch(error){writeError=error;}
// A lost response is not evidence of rollback. Read the transactional history
// and hash markers before deciding whether the write actually committed.
const after=await inspect(),applied=new Map(after.history.map(value=>[value.version,value]));
const complete=files.every(file=>applied.get(file.version)?.statements?.includes('-- OMCITE RELEASE SHA256: '+file.sha256));
if(!complete){await writeFile(path,JSON.stringify({...attempt,status:'not-confirmed',after,error:writeError?.message},null,2));throw writeError??Error('Production migration completion not confirmed');}
// Integrity checks ran before COMMIT under locks. Post-commit user activity is
// legitimate and must not be misreported as a release integrity failure.
await query("notify pgrst, 'reload schema';",false);
await writeFile(path,JSON.stringify({...attempt,status:'verified',completedAt:new Date().toISOString(),after,responseLostButCommitVerified:!!writeError},null,2));
console.log(JSON.stringify({project:productionProject,applied:files.length,verified:true,protectedRosterCounts:true,coinConservation:true,responseLostButCommitVerified:!!writeError}));
