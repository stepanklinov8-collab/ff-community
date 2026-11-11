// Explicitly restricted to the disposable test project; never production.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {stagingProject,assertTestDatabaseTarget} from '../../src/platform/environment.ts';
assertTestDatabaseTarget(`https://${stagingProject}.supabase.co`);
const token=(await readFile('C:/Users/Lenovo/.supabase/access-token','utf8')).trim();
async function query(query){
 const response=await fetch(`https://api.supabase.com/v1/projects/${stagingProject}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(120000)});
 if(!response.ok)throw Error(`Staging SQL HTTP ${response.status}`);return response.json();
}
const ready=(await query("select to_regclass('public.economy_value_cache') is not null ready"))[0].ready;
if(process.argv.includes('--sync-trigger')){
 assert.equal(ready,true);
 const sql=await readFile(new URL('../../supabase/migrations/202611110002_stored_economy_values.sql',import.meta.url),'utf8');
 const start=sql.indexOf('create function public.u8_economy_source_changed()');
 const end=sql.indexOf('end $$;',start)+'end $$;'.length;
 assert(start>=0&&end>start);
 await query('begin;'+sql.slice(start,end).replace('create function','create or replace function')+'commit;');
 console.log(JSON.stringify({project:stagingProject,stageSourceInvalidationUpdated:true}));process.exit(0);
}
if(process.argv.includes('--verify-rollback')){
 assert.equal(ready,true);
 const rollback=(await readFile(new URL('./rollback-stored-values.sql',import.meta.url),'utf8')).replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,'');
 await query(`begin;
 create temporary table expected_prices as select * from economy_value_cache;
 ${rollback}
 do $$begin
 if to_regclass('public.economy_value_cache') is not null then raise exception 'Rollback did not remove cache';end if;
 if exists(select 1 from expected_prices where exact_value is distinct from case when target_type='player' then u5_player_value_exact(target_id) else u5_organization_value_exact(target_id) end) then raise exception 'Rollback changed a price';end if;
 end $$;rollback;`);
 assert.equal((await query("select to_regclass('public.economy_value_cache') is not null ready"))[0].ready,true);
 console.log(JSON.stringify({project:stagingProject,manualRollbackVerified:true,testMigrationRemainsInstalled:true}));process.exit(0);
}
assert.equal(ready,false,'Staging migration already installed; do not replay');
const backup=await query("select pg_get_functiondef('u5_player_value_exact(uuid)'::regprocedure) player,pg_get_functiondef('u5_organization_value_exact(uuid)'::regprocedure) organization");
await writeFile(new URL('./artifacts/contracts/stored-values-staging-original-private.json',import.meta.url),JSON.stringify(backup));
const values=`select jsonb_object_agg(kind||':'||id,value::text) values from (select 'player' kind,id,u5_player_value_exact(id) value from profiles union all select 'team',id,u5_organization_value_exact(id) from teams) v`;
const protectedSql=`select md5(coalesce(string_agg(row_to_json(x)::text,'' order by row_to_json(x)::text),'')) hash from %TABLE% x`;
const protectedTables=['coin_accounts','coin_entries','profiles','teams','competition_ratings'];
const fingerprints=async()=>{const result={};for(const table of protectedTables)result[table]=(await query(protectedSql.replace('%TABLE%',table)))[0].hash;return result;};
// Some aggregate tables use composite keys, so order by their complete JSON.
const beforeValues=(await query(values))[0].values;
const before=await fingerprints();
const benchmark=async()=>{const samples=[];for(let i=0;i<3;i++){const data=await query("explain (analyze,format json) select u2_leaderboard('main','team',null,100,0,'rating')");samples.push(data[0]['QUERY PLAN'][0]['Execution Time']);}return samples;};
const beforeMs=await benchmark();
const migration=await readFile(new URL('../../supabase/migrations/202611110002_stored_economy_values.sql',import.meta.url),'utf8');
const body=migration.replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,'');
await query('begin;\n'+body+'\nrollback;');
assert.equal((await query("select to_regclass('public.economy_value_cache') is null rolled_back"))[0].rolled_back,true);
assert.deepEqual(await fingerprints(),before);
if(!process.argv.includes('--apply')){console.log(JSON.stringify({project:stagingProject,rollbackVerified:true,beforeMs,applied:false}));process.exit(0);}
await query(migration);
assert.deepEqual((await query(values))[0].values,beforeValues,'Every exact price must be unchanged');
assert.deepEqual(await fingerprints(),before,'Balances, ratings and profiles must be unchanged');
const afterMs=await benchmark();
const proof={project:stagingProject,appliedAt:new Date().toISOString(),rollbackVerified:true,exactPricesUnchanged:true,protectedTablesUnchanged:true,beforeMs,afterMs};
await writeFile(new URL('./artifacts/contracts/stored-values-staging-proof.json',import.meta.url),JSON.stringify(proof,null,2));
console.log(JSON.stringify(proof));
