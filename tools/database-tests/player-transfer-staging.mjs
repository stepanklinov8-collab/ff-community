// Dedicated staging integration only. The random, fictional fixture family is
// retained with its immutable audit history, never inserted into production.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {stagingProject,assertTestDatabaseTarget} from '../../src/platform/environment.ts';
import {verifyPlayerTransferWorkflow} from './player-transfer-workflow.mjs';
import {defaultTerms} from '../../src/modules/contracts/model.ts';
import {emptyTransferCancellation} from '../../src/modules/contracts/transfer-cancellation.ts';
assertTestDatabaseTarget(`https://${stagingProject}.supabase.co`);
if(!process.argv.includes('--run')){console.log('Dedicated staging integration: pass --run to create fictional fixtures and exercise concurrent transactions. Production is excluded.');process.exit(0);}
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
 if(!response.ok){const body=await response.json().catch(()=>({}));const message=String(body.message??body.error??`HTTP ${response.status}`);throw Error(message.slice(0,1000));}
 return response.json();
}
const db={query:async(sql,parameters=[])=>({rows:await request(sql.replace(/\$(\d+)/g,(_,n)=>{if(Number(n)>parameters.length)throw Error('Missing fixture parameter');return literal(parameters[Number(n)-1]);}))}),exec:sql=>request(sql)};
const prefix=randomUUID().slice(0,24),id=n=>prefix+n.toString(16).padStart(12,'0');
const createUser=user=>db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2::jsonb)',[user,JSON.stringify({
 nickname:'Twf-'+user.slice(0,6)+'-'+user.slice(-4),game_id:'9'+BigInt('0x'+user.replaceAll('-','')).toString().slice(-18),contact_social_url:'https://t.me/omcite_staging_'+prefix.slice(0,8),
})]);
const artifacts=new URL('./artifacts/contracts/',import.meta.url);await mkdir(artifacts,{recursive:true});
const path=new URL(`player-transfer-staging-${new Date().toISOString().replace(/[:.]/g,'-')}.json`,artifacts);
const before=(await request('select id,balance::text,reserved::text from public.coin_accounts order by id',true));
const evidence={project:stagingProject,prefix,status:'started',productionChanged:false,fixtureIds:[94000,94001,94002,94003,94004,94005,94006,94007,94010,94011,94020,94030,94031,94032,94033].map(id)};
await writeFile(path,JSON.stringify(evidence,null,2));
let grantedAdmin=null;let protectedOwner=null;
const promoteFixtureAdmin=async user=>{
 protectedOwner=(await db.query('select id from profiles where is_owner(id) limit 1')).rows[0]?.id;if(!protectedOwner)throw Error('Protected staging owner is required');
 grantedAdmin=user;await db.query("insert into user_roles(user_id,role) values($1,'admin') on conflict do nothing",[user]);
 await db.query('select u6_coin_action($1,$2,$3,$4::jsonb)',[protectedOwner,randomUUID(),'permission',JSON.stringify({userId:user,enabled:true})]);
};
try{
 const ready=(await request("select to_regprocedure('public.player_transfer_query(uuid,jsonb)') is not null ready",true))[0];assert.equal(ready.ready,true);
 await verifyPlayerTransferWorkflow(db,id,createUser,promoteFixtureAdmin);
 const employer=id(94002),org=id(94011),second=id(94006),third=id(94007),concurrentDeal=id(94032),raceDeal=id(94033);
 for(const player of [second,third]){await createUser(player);await db.query('insert into profiles(id,nickname) values($1,$2) on conflict(id) do update set nickname=excluded.nickname',[player,'Trace-'+player.slice(0,6)+'-'+player.slice(-4)]);}
 const mutate=(actor,input)=>db.query('select player_transfer_mutate($1,$2::jsonb) value',[actor,JSON.stringify(input)]);
 const act=(actor,action,dealId,requestId=randomUUID())=>mutate(actor,{action,requestId,dealId,revision:1});
 async function prepare(dealId,player,price){
  const terms=defaultTerms();terms.financial.transferCancellation=emptyTransferCancellation();
  await mutate(employer,{action:'player_save',requestId:randomUUID(),dealId,expectedRevision:0,playerId:player,destinationId:org,buyerUserId:null,buyerOrganizationId:org,price,
   expiresAt:new Date(Date.now()+7*86400000).toISOString(),newTerms:terms,compensationOverrides:[]});
  await act(employer,'offer',dealId);await act(player,'player_consent',dealId);await act(employer,'prepare_contract',dealId);
 }
 await prepare(concurrentDeal,second,200);await act(employer,'buyer_fund',concurrentDeal);
 const completion={action:'complete',requestId:randomUUID(),dealId:concurrentDeal,revision:1};
 // Materialization orders the mutation before the dependent delay. Its
 // transaction keeps wallet/roster locks while the other real connection runs.
 const concurrent=(actor,input)=>db.query('with run as materialized(select pg_backend_pid() backend,player_transfer_mutate($1,$2::jsonb) value) select run.backend,run.value from run cross join lateral(select pg_sleep(0.4) where run.backend>0) delay',[actor,JSON.stringify(input)]);
 const completed=await Promise.all([concurrent(second,completion),concurrent(second,completion)]);
 assert.deepEqual(completed[0].rows[0].value,completed[1].rows[0].value);
 const connections=new Set(completed.map(result=>result.rows[0].backend));assert.equal(connections.size,2,'concurrency evidence requires two real database connections');
 assert.equal((await db.query('select count(*)::int n from player_transfer_executions where deal_id=$1',[concurrentDeal])).rows[0].n,1);
 assert.equal((await db.query("select count(*)::int n from contract_signatures where contract_id=(select new_contract_id from market_versions where deal_id=$1 and revision=1) and party='player'",[concurrentDeal])).rows[0].n,1);
 assert.equal((await db.query('select balance::int from coin_accounts where user_id=$1',[second])).rows[0].balance,200);
 await prepare(raceDeal,third,100);
 const raced=await Promise.allSettled([
  concurrent(employer,{action:'buyer_fund',requestId:randomUUID(),dealId:raceDeal,revision:1}),
  concurrent(employer,{action:'cancel',requestId:randomUUID(),dealId:raceDeal,revision:1}),
 ]);
 for(const result of raced)if(result.status==='rejected')assert.match(result.reason.message,/MARKET_STATE/);
 assert.equal(raced[1].status,'fulfilled','cancellation must win eventually even when funding gets the lock first');
 assert.equal((await db.query('select status from market_versions where deal_id=$1 and revision=1',[raceDeal])).rows[0].status,'cancelled');
 assert.deepEqual((await db.query('select balance::int,reserved::int from coin_accounts where team_id=$1',[org])).rows[0],{balance:150,reserved:50});
 assert.equal((await db.query('select count(*)::int n from team_members where user_id=$1',[third])).rows[0].n,0);
 const after=await request('select id,balance::text,reserved::text from public.coin_accounts order by id',true);
 for(const account of before)assert.deepEqual(after.find(value=>value.id===account.id),account,'pre-existing account balances and holds must remain untouched');
 const originalIds=new Set(before.map(value=>value.id));const minted=after.filter(value=>!originalIds.has(value.id)).reduce((sum,value)=>sum+BigInt(value.balance),BigInt(0));
 assert.equal(minted,BigInt(1450),'only the explicit fictional fixture grants mint staging coins');
 await writeFile(path,JSON.stringify({...evidence,status:'verified',finishedAt:new Date().toISOString(),separateConnections:connections.size,duplicateCompletionVerified:true,fundingCancellationRaceVerified:true,existingAccountsPreserved:true,fixtureCoins:'1450'},null,2));
 console.log(JSON.stringify({project:stagingProject,separateConnections:connections.size,duplicateCompletionVerified:true,fundingCancellationRaceVerified:true,existingAccountsPreserved:true,productionChanged:false}));
}catch(cause){await writeFile(path,JSON.stringify({...evidence,status:'failed',error:String(cause.message).slice(0,1000)},null,2));throw cause;}
finally{
 if(grantedAdmin){
  try{
   await db.query('select u6_coin_action($1,$2,$3,$4::jsonb)',[protectedOwner,randomUUID(),'permission',JSON.stringify({userId:grantedAdmin,enabled:false})]);await db.query("delete from user_roles where user_id=$1 and role='admin'",[grantedAdmin]);
   assert.equal((await db.query('select u6_coin_admin($1) allowed',[grantedAdmin])).rows[0].allowed,false);
   await writeFile(path,JSON.stringify({...JSON.parse(await readFile(path,'utf8')),temporaryPermissionsRemoved:true},null,2));
  }catch(cause){await writeFile(path,JSON.stringify({...JSON.parse(await readFile(path,'utf8')),status:'cleanup-failed',cleanupError:String(cause.message).slice(0,1000)},null,2));throw cause;}
 }
}
