// No writes unless --apply is explicitly supplied for a fresh reviewed plan.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {productionProject} from '../../src/platform/environment.ts';
if(process.argv.slice(2).some(arg=>arg!=='--apply'))throw Error('Only --apply is accepted');
const folder=new URL('./artifacts/contracts/',import.meta.url);
const plan=JSON.parse(await readFile(new URL('finance-production-plan.json',folder),'utf8'));
const sql=await readFile(new URL('finance-production.sql',folder),'utf8');
const rollback=await readFile(new URL('finance-rollback-functions.sql',folder),'utf8');
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();
const age=Date.now()-Date.parse(plan.capturedAt);
if(plan.project!==productionProject||plan.writes!==false||plan.sourceHead!==head||!Number.isFinite(age)||age<0||age>86400000
 ||plan.sqlSha256!==createHash('sha256').update(sql).digest('hex')||plan.rollbackSha256!==createHash('sha256').update(rollback).digest('hex')
 ||execFileSync('git',['status','--porcelain'],{encoding:'utf8',windowsHide:true}).trim())throw Error('Regenerate the reviewed release plan');
const expected=['202611050001_funding_requests_notifications.sql','202611050002_withdrawal_details_and_request_contacts.sql','202611050003_withdrawal_notification_contacts.sql'];
if(plan.migrations?.map(row=>row.name).join(',')!==expected.join(','))throw Error('Unexpected release migrations');
for(const row of plan.migrations){
 const body=await readFile(new URL('../../supabase/migrations/'+row.name,import.meta.url));
 if(createHash('sha256').update(body).digest('hex')!==row.sha256)throw Error('Reviewed migration changed');
}
if(!process.argv.includes('--apply')){
 console.log(JSON.stringify({validated:true,writes:false,project:productionProject,sourceHead:head,migrations:expected.length}));
}else{
 const token=(await readFile('C:/Users/Lenovo/.supabase/access-token','utf8')).trim();
 const response=await fetch(`https://api.supabase.com/v1/projects/${productionProject}/database/query`,{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({query:sql}),signal:AbortSignal.timeout(90000),
 });
 const raw=await response.text();
 if(!response.ok){await writeFile(new URL('finance-production-error-private.txt',folder),raw);throw Error('Release response HTTP '+response.status+'; inspect journal before retrying');}
 const check=await fetch(`https://api.supabase.com/v1/projects/${productionProject}/database/query/read-only`,{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({query:"select version,statements[1] marker from supabase_migrations.schema_migrations where version>='202611050001' order by version"}),signal:AbortSignal.timeout(30000),
 });
 if(!check.ok)throw Error('Post-apply inspection failed; inspect journal before retrying');
 const installed=await check.json();
 if(installed.length!==expected.length||plan.migrations.some((row,index)=>installed[index]?.version!==row.name.slice(0,12)||installed[index]?.marker!=='-- OMCITE RELEASE SHA256: '+row.sha256))throw Error('Post-apply migration journal mismatch; do not blindly replay');
 await writeFile(new URL('finance-production-applied.json',folder),JSON.stringify({project:productionProject,sourceHead:head,appliedAt:new Date().toISOString(),sqlSha256:plan.sqlSha256,backupSha256:plan.backupSha256,migrations:plan.migrations,transactionProtectedDataVerified:true},null,2));
 console.log(JSON.stringify({applied:true,project:productionProject,migrations:installed.length,sourceHead:head}));
}
