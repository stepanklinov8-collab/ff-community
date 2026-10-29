import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {assertTestDatabaseTarget} from '../../src/platform/environment.ts';
const ref='swjdbeelqzdleefscuuc';
assertTestDatabaseTarget(`https://${ref}.supabase.co`);
const token=(await readFile('C:/Users/Lenovo/.supabase/access-token','utf8')).trim();
async function query(sql,readOnly=false){
 const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query${readOnly?'/read-only':''}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql}),signal:AbortSignal.timeout(180000)});
 if(!response.ok)throw Error(`Staging HTTP ${response.status}: ${(await response.text()).slice(0,900)}`);
 return response.json();
}
const stateSql=`select (select jsonb_agg(to_jsonb(t) order by id) from profiles t) profiles,
 (select jsonb_agg(to_jsonb(t) order by id) from teams t) teams,
 (select jsonb_agg(to_jsonb(t) order by target_type,target_id,mode) from competition_ratings t) ratings,
 (select jsonb_agg(to_jsonb(t) order by user_id) from site_wallets t) wallets,
 (select pg_get_functiondef('public.recalculate_organization_rating(uuid)'::regprocedure)) rating_function`;
const before=await query(stateSql,true);
let migrations='';
for(const file of ['202610290001_organization_values.sql','202610290002_registration_reserve.sql']){
 const sql=await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8');
 assert.match(sql,/^begin;/i);assert.match(sql,/commit;\s*$/i);
 migrations+=sql.replace(/^begin;/i,'').replace(/commit;\s*$/i,'')+'\n';
}
const recovery=await readFile(new URL('./artifacts/economy-release/rollback-economy.sql',import.meta.url),'utf8');
const recoveryBody=recovery.replace(/^begin;/i,'').replace(/commit;\s*$/i,'').replace(/delete from supabase_migrations.schema_migrations[^;]+;/,'');
// First prove the entire migration can be rolled back, including the historical recalculation.
await query(`begin; set local lock_timeout='5s'; set local statement_timeout='150s'; ${migrations}
do $$begin
 if abs(public.u5_utility_price(300)-45000000)>.001 then raise exception 'Curve anchor failed';end if;
 if public.u5_bonus_price(499,300000000)<>300000000 then raise exception 'Bonus limit failed';end if;
 if exists(select 1 from teams where main_rating<0 or main_rating>999) then raise exception 'Rating outside range';end if;
end $$; rollback;`);
assert.deepEqual(await query(stateSql,true),before,'Staging rollback restores data and function');
await query(`begin; set local lock_timeout='5s'; set local statement_timeout='150s'; ${migrations} ${recoveryBody} rollback;`);
assert.deepEqual(await query(stateSql,true),before,'Explicit recovery also runs safely inside the staging transaction');
console.log('STAGING PASS: both migrations, full transaction rollback and explicit recovery script');
await writeFile(new URL('./artifacts/economy-release/staging-rollback.json',import.meta.url),JSON.stringify({project:ref,checkedAt:new Date().toISOString(),passed:true,explicitRecovery:true}));
