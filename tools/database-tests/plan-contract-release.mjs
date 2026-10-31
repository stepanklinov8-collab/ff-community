// Read-only release planner. This file has no write endpoint or DDL execution.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
import {productionProject,stagingProject} from '../../src/platform/environment.ts';
const proofArgument=process.argv.find(value=>value.startsWith('--restored-backup='))?.slice(18);
if(!process.argv.includes('--project='+productionProject)||!proofArgument||process.argv.slice(2).some(value=>!value.startsWith('--restored-backup=')&&value!=='--project='+productionProject))throw Error('Select the production project and restore proof only');
const proof=JSON.parse(await readFile(resolve(proofArgument),'utf8'));
if(proof.sourceProject!==productionProject||proof.targetProject!==stagingProject||proof.verified!==true||proof.rollbackVerified!==true||!proof.restoredAt||!Array.isArray(proof.updateMigrations)||!Number.isFinite(Date.parse(proof.capturedAt))||Date.now()-Date.parse(proof.capturedAt)>86400000)throw Error('Fresh verified restore and migration rehearsal required');
const digest=createHash('sha256').update(await readFile(join(dirname(resolve(proofArgument)),'database.dump'))).digest('hex');
if(digest!==proof.sha256)throw Error('Backup archive hash mismatch');
for(const file of proof.updateMigrations){
 if(!/^202610\d{6}_[a-z_]+\.sql$/.test(file.name)||file.name<'202610290003')throw Error('Unexpected release migration');
 const actual=createHash('sha256').update(await readFile(resolve('supabase/migrations',file.name))).digest('hex');if(actual!==file.sha256)throw Error('Migration changed after rehearsal');
}
const token=(await readFile('C:/Users/Lenovo/.supabase/access-token','utf8')).trim();
const query=`select (select count(*) from profiles)::int profiles,(select count(*) from teams)::int organizations,(select count(*) from team_members)::int members,
to_regclass('public.coin_accounts') is not null wallets_ready,to_regclass('public.organization_contracts') is not null contracts_ready,
(select jsonb_agg(jsonb_build_object('version',version,'name',name) order by version) from supabase_migrations.schema_migrations) history`;
const response=await fetch(`https://api.supabase.com/v1/projects/${productionProject}/database/query/read-only`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(30000)});
if(!response.ok)throw Error('Read-only release inspection failed: '+response.status);
const state=(await response.json())[0],applied=new Set(state.history.map(row=>row.version));
const missing=proof.updateMigrations.filter(row=>!applied.has(row.name.slice(0,12)));
const plan={project:productionProject,checkedAt:new Date().toISOString(),writes:false,backupSha256:digest,restoredAt:proof.restoredAt,protectedCounts:{profiles:state.profiles,organizations:state.organizations,members:state.members},walletsReady:state.wallets_ready,contractsReady:state.contracts_ready,missingMigrations:missing};
await writeFile(resolve('tools/database-tests/artifacts/contracts/contracts-production-plan.json'),JSON.stringify(plan,null,2));
console.log(JSON.stringify({...plan,missingMigrations:missing.length}));
