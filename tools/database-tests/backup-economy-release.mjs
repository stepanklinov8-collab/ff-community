import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

const source=resolve('../ff-update-2/tools/database-tests/artifacts');
const output=resolve('tools/database-tests/artifacts/economy-release');
await mkdir(output,{recursive:true});
const ref='ojtqdfdqicozzqlgjtnm';
const token=(await readFile('C:/Users/Lenovo/.supabase/access-token','utf8')).trim();
const loginResponse=await fetch(`https://api.supabase.com/v1/projects/${ref}/cli/login-role`,{
 method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
 body:JSON.stringify({read_only:false}),signal:AbortSignal.timeout(30000)});
if(!loginResponse.ok)throw new Error(`Temporary read-only login failed: HTTP ${loginResponse.status}`);
const credentials={ref,...await loginResponse.json()};
await writeFile(resolve(source,'backup-login-private.json'),JSON.stringify(credentials));
if(credentials.ref!=='ojtqdfdqicozzqlgjtnm')throw new Error('Unexpected backup project');
const archive=resolve(output,'database.dump');
const poolResponse=await fetch(`https://api.supabase.com/v1/projects/${ref}/config/database/pooler`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30000)});
if(!poolResponse.ok)throw new Error(`Pooler metadata failed: HTTP ${poolResponse.status}`);
const pool=(await poolResponse.json()).find(item=>item.database_type==='PRIMARY');
if(!pool?.db_host?.endsWith('.pooler.supabase.com'))throw new Error('Invalid pooler host');
const env={...process.env,PGHOST:pool.db_host,PGPORT:'5432',PGUSER:`${credentials.role}.${ref}`,
 PGPASSWORD:credentials.password,PGDATABASE:'postgres',PGSSLMODE:'require',PGCONNECT_TIMEOUT:'20',PGAPPNAME:'omcite_economy_release_backup',PGOPTIONS:'-c default_transaction_read_only=on'};
const binary=resolve(source,'postgresql18/pgsql/bin/pg_dump.exe');
const args=['--role='+credentials.role.replace('cli_login_',''),'--format=custom','--file='+archive,'--no-password','--lock-wait-timeout=15000'];
const stderr=await new Promise((done,fail)=>{
 const child=spawn(binary,args,{env,windowsHide:true,stdio:['ignore','ignore','pipe']});
 let errors='';child.stderr.on('data',chunk=>{errors+=chunk.toString();});
 const timeout=setTimeout(()=>child.kill(),180000);
 child.once('error',error=>{clearTimeout(timeout);fail(error);});
 child.once('exit',code=>{clearTimeout(timeout);if(code===0)done(errors);else fail(new Error(`pg_dump exited ${code}: ${errors.slice(-700)}`));});
});
const data=await readFile(archive);
if(data.length<1000)throw new Error('Backup archive is unexpectedly small');
const sha256=createHash('sha256').update(data).digest('hex');
await writeFile(resolve(output,'manifest.json'),JSON.stringify({sourceProject:credentials.ref,capturedAt:new Date().toISOString(),
 bytes:(await stat(archive)).size,sha256,format:'pg_dump custom archive'},null,2));
console.log(JSON.stringify({fullBackup:true,bytes:data.length,sha256,diagnosticLength:stderr.length}));
