// Real PostgreSQL rehearsal, hard-bound to the dedicated fictional test project.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {stagingProject,assertTestDatabaseTarget} from '../../src/platform/environment.ts';
import {verifyPlayerTransferExecution} from './player-transfer-execution.mjs';
import {verifyPlayerTransferReversal} from './player-transfer-reversal.mjs';
assertTestDatabaseTarget(`https://${stagingProject}.supabase.co`);
if(!process.argv.includes('--run')){console.log('Pass --run for the isolated staging reversal rehearsal. Production is excluded.');process.exit(0);}
const token=(await readFile('C:/Users/Lenovo/.supabase/access-token','utf8')).trim();
function literal(value){
 if(value===null)return'null';if(typeof value==='boolean')return value?'true':'false';
 if(typeof value==='number'){if(!Number.isSafeInteger(value))throw Error('Unsafe fixture number');return String(value);}
 if(Array.isArray(value))return value.length?'array['+value.map(literal).join(',')+']':"'{}'";
 if(typeof value!=='string'||value.includes('\0'))throw Error('Unsupported fixture parameter');
 return "E'"+value.replaceAll('\\','\\\\').replaceAll("'","''")+"'";
}
async function request(sql,readOnly=false){
 const response=await fetch(`https://api.supabase.com/v1/projects/${stagingProject}/database/query${readOnly?'/read-only':''}`,{
  method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql}),signal:AbortSignal.timeout(60000),
 });
 if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(String(data.message??data.error??`HTTP ${response.status}`).slice(0,1000));}return response.json();
}
const db={query:async(sql,parameters=[])=>({rows:await request(sql.replace(/\$(\d+)/g,(_,n)=>{if(Number(n)>parameters.length)throw Error('Missing fixture parameter');return literal(parameters[Number(n)-1]);}))}),exec:sql=>request(sql)};
const prefix=randomUUID().slice(0,24),id=n=>prefix+n.toString(16).padStart(12,'0');
const createUser=user=>db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2::jsonb)',[user,JSON.stringify({nickname:'Rev-'+user.slice(0,6)+'-'+user.slice(-4),game_id:'9'+BigInt('0x'+user.replaceAll('-','')).toString().slice(-18),contact_social_url:'https://t.me/omcite_staging_'+prefix.slice(0,8)})]);
const artifacts=new URL('./artifacts/contracts/',import.meta.url);await mkdir(artifacts,{recursive:true});
const path=new URL(`player-reversal-staging-${new Date().toISOString().replace(/[:.]/g,'-')}.json`,artifacts);
const before=await request('select id,balance::text,reserved::text from coin_accounts order by id',true);
const evidence={project:stagingProject,prefix,status:'started',productionChanged:false};await writeFile(path,JSON.stringify(evidence,null,2));
let grantedAdmin=null;const protectedOwner=(await db.query('select id from profiles where is_owner(id) limit 1')).rows[0]?.id;
if(!protectedOwner)throw Error('Protected staging owner required');
async function promote(user){
 grantedAdmin=user;await db.query("insert into user_roles(user_id,role) values($1,'admin') on conflict do nothing",[user]);
 await db.query('select u6_coin_action($1,$2,$3,$4::jsonb)',[protectedOwner,randomUUID(),'permission',JSON.stringify({userId:user,enabled:true})]);
}
async function demote(user){
 await db.query('select u6_coin_action($1,$2,$3,$4::jsonb)',[protectedOwner,randomUUID(),'permission',JSON.stringify({userId:user,enabled:false})]);
 await db.query("delete from user_roles where user_id=$1 and role='admin'",[user]);
 assert.equal((await db.query('select u6_coin_admin($1) allowed',[user])).rows[0].allowed,false);
}
try{
 await verifyPlayerTransferExecution(db,id,createUser,promote);
 await verifyPlayerTransferReversal(db,id,demote,promote,async()=>{
  const action=async(action,extra)=>(await db.query('select player_transfer_mutate($1,$2::jsonb) value',[id(93000),JSON.stringify({action,requestId:randomUUID(),dealId:id(93030),revision:1,...extra})])).rows[0].value;
  const proposal=await action('reverse_review',{cause:'player_fault',reason:'Resolved transfer dispute'});
  const result=await action('reverse_complete',{proposalId:proposal.proposalId});
  assert.equal((await db.query('select mode from player_return_jobs where id=$1',[result.jobId])).rows[0].mode,'fixed');return result;
 });
 const after=await request('select id,balance::text,reserved::text from coin_accounts order by id',true);
 for(const account of before)assert.deepEqual(after.find(value=>value.id===account.id),account);
 const original=new Set(before.map(value=>value.id));assert.equal(after.filter(value=>!original.has(value.id)).reduce((sum,value)=>sum+BigInt(value.balance),BigInt(0)),BigInt(10690));
 await writeFile(path,JSON.stringify({...evidence,status:'verified',finishedAt:new Date().toISOString(),existingAccountsPreserved:true,fixtureCoins:'10690',signedReturn:50,oldContractNotRestored:true,lateFailureRollbackVerified:true},null,2));
 console.log(JSON.stringify({project:stagingProject,existingAccountsPreserved:true,signedReturn:50,oldContractNotRestored:true,lateFailureRollbackVerified:true,productionChanged:false}));
}catch(cause){await writeFile(path,JSON.stringify({...evidence,status:'failed',error:String(cause.message).slice(0,1000)},null,2));throw cause;}
finally{
 if(grantedAdmin)try{await demote(grantedAdmin);await writeFile(path,JSON.stringify({...JSON.parse(await readFile(path,'utf8')),temporaryPermissionsRemoved:true},null,2));}
 catch(cause){await writeFile(path,JSON.stringify({...JSON.parse(await readFile(path,'utf8')),status:'cleanup-failed',cleanupError:String(cause.message).slice(0,1000)},null,2));throw cause;}
}
