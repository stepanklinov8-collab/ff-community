// This release only materializes derived prices. It never pays or resets money.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const project='ojtqdfdqicozzqlgjtnm',version='202611110002';
const args=process.argv.slice(2);if(args.some(a=>!['--prepare','--apply','--inspect'].includes(a))||args.length!==1)throw Error('Select --inspect, --prepare or --apply');
const folder=new URL('./artifacts/performance-release/',import.meta.url);await mkdir(folder,{recursive:true});
const sql=(await readFile(new URL('../../supabase/migrations/202611110002_stored_economy_values.sql',import.meta.url),'utf8')).replaceAll('\r\n','\n');
const hash=createHash('sha256').update(sql).digest('hex'),body=sql.replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,'');
const token=(await readFile('C:/Users/Lenovo/.supabase/access-token','utf8')).trim();
const literal=value=>"'"+value.replaceAll("'","''")+"'";
async function query(query,readOnly=false){const r=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query${readOnly?'/read-only':''}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(120000)});if(!r.ok){await writeFile(new URL('production-error-private.txt',folder),await r.text());throw Error('Production SQL HTTP '+r.status+'; inspect state before replay');}return r.json();}
const tables=['coin_accounts','coin_operations','coin_entries','site_wallets','currency_ledger','event_prize_funds','personal_award_funds','competition_publications','competition_player_facts','competition_team_facts','organization_contracts','organization_contract_versions','profiles','teams','team_members','competition_ratings'];
const snapshot=`jsonb_build_object(${tables.map(t=>literal(t)+`,(select md5(coalesce(string_agg(to_jsonb(x)::text,',' order by to_jsonb(x)::text),'')) from public.${t} x)`).join(',')})`;
const signatureSql="'public.u5_player_value_exact(uuid)'::regprocedure,'public.u5_organization_value_exact(uuid)'::regprocedure";
const definitions=()=>query(`select oid::regprocedure::text signature,pg_get_functiondef(oid) definition,proacl::text acl from pg_proc where oid in(${signatureSql}) order by oid::regprocedure::text`,true);
const installed=(await query(`select to_regclass('public.economy_value_cache') is not null installed,(select statements[1] from supabase_migrations.schema_migrations where version='${version}') marker`,true))[0];
if(args.includes('--inspect')){console.log(JSON.stringify({project,...installed}));process.exit(0);}
assert.equal(installed.installed,false,'Already installed: inspect the journal; never replay');assert.equal(installed.marker,null,'Unexpected migration marker');
const locks=['profiles','teams','team_members','competition_ratings','competition_publications','competition_player_facts','competition_team_facts','player_stats','organization_participation_history','competition_award_entries','competition_game_forecasts','rating_event_settings','events','event_sessions','event_games','economy_settings'];
const start=`begin;set local lock_timeout='5s';set local statement_timeout='75s';lock table ${locks.map(t=>'public.'+t).join(',')} in share row exclusive mode;
 create temporary table protected_economy_before as select ${snapshot} value;
 create temporary table exact_values_before as select 'player'::text kind,id,u5_player_value_exact(id) value from profiles union all select 'team',id,u5_organization_value_exact(id) from teams;`;
const verify=`do $guard$begin
 if (select value from protected_economy_before) is distinct from ${snapshot} then raise exception 'PROTECTED_SPORTING_OR_FINANCIAL_DATA_CHANGED';end if;
 if exists(select 1 from exact_values_before v left join economy_value_cache c on c.target_type=v.kind and c.target_id=v.id where c.exact_value is distinct from v.value) then raise exception 'EXACT_PRICE_CHANGED';end if;
 if (select count(*) from economy_value_cache)<>(select count(*) from exact_values_before) then raise exception 'PRICE_COVERAGE';end if;
 if exists(select 1 from economy_value_refresh_queue) then raise exception 'PENDING_PRICE_JOBS';end if;
 end $guard$;`;
if(args.includes('--prepare')){
 const prior=await definitions();assert.equal(prior.length,2);
 const before=(await query(`select ${snapshot} value`,true))[0].value;
 const rollback=(await readFile(new URL('./rollback-stored-values.sql',import.meta.url),'utf8')).replaceAll('\r\n','\n').replace(/^commit;\s*$/m,`delete from supabase_migrations.schema_migrations where version='${version}';\ncommit;`);
 await writeFile(new URL('rollback-stored-values.sql',folder),rollback);
 await query(start+'\n'+body+'\n'+verify+'\nrollback;');
 assert.deepEqual(await definitions(),prior,'Rollback must restore exact formulas and ACLs');
 assert.deepEqual((await query(`select ${snapshot} value`,true))[0].value,before,'Rollback must preserve the live data');
 const journal=`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','stored_economy_values',array[${literal('-- OMCITE RELEASE SHA256: '+hash)}]);`;
 const apply=start+'\n'+body+'\n'+verify+'\n'+journal+'\ncommit;';
 await writeFile(new URL('apply-stored-values-private.sql',folder),apply);
 const plan={project,capturedAt:new Date().toISOString(),sha256:hash,applySha256:createHash('sha256').update(apply).digest('hex'),prior,before,rollbackVerified:true};
 await writeFile(new URL('production-plan-private.json',folder),JSON.stringify(plan,null,2));
 console.log(JSON.stringify({project,prepared:true,rollbackVerified:true,protectedDataUnchanged:true}));
}else{
 const plan=JSON.parse(await readFile(new URL('production-plan-private.json',folder),'utf8'));
 const apply=await readFile(new URL('apply-stored-values-private.sql',folder),'utf8');
 assert.equal(plan.project,project);assert.equal(plan.sha256,hash);assert.equal(plan.rollbackVerified,true);assert(Date.now()-Date.parse(plan.capturedAt)<3600000);assert.equal(createHash('sha256').update(apply).digest('hex'),plan.applySha256);assert.deepEqual(await definitions(),plan.prior);
 await query(apply);
 const rows=await query(`select (select statements[1] from supabase_migrations.schema_migrations where version='${version}') marker,(select count(*) from economy_value_cache) prices,(select count(*) from economy_value_refresh_queue) jobs,${snapshot} protected`);
 assert.equal(rows[0].marker,'-- OMCITE RELEASE SHA256: '+hash);assert.equal(Number(rows[0].jobs),0);
 // The transaction itself verifies protected data against its current locked
 // snapshot; users may legitimately change data after it commits.
 const proof={project,appliedAt:new Date().toISOString(),sha256:hash,prices:Number(rows[0].prices),jobs:0,exactPricesPreserved:true,protectedDataVerifiedInTransaction:true,rollbackPrepared:true};
 await writeFile(new URL('production-applied.json',folder),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}
