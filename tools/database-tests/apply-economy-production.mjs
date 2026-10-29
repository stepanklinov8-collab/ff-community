import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
if(!process.argv.includes('--production'))throw Error('Explicit --production required');
const ref='ojtqdfdqicozzqlgjtnm',artifacts=new URL('./artifacts/economy-release/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('recovery-manifest.json',artifacts),'utf8'));
const backup=await readFile(new URL('recovery-snapshot-private.json',artifacts),'utf8');
assert.equal(manifest.project,ref);assert.equal(createHash('sha256').update(backup).digest('hex'),manifest.sha256);
assert.ok(Date.now()-Date.parse(manifest.capturedAt)<3600000,'Refresh recovery snapshot before production');
const rehearsal=JSON.parse(await readFile(new URL('production-data-rehearsal.json',artifacts),'utf8'));
assert.equal(rehearsal.sourceCapturedAt,manifest.capturedAt);
const staging=JSON.parse(await readFile(new URL('staging-rollback.json',artifacts),'utf8'));assert.equal(staging.passed,true);
const token=(await readFile('C:/Users/Lenovo/.supabase/access-token','utf8')).trim();
async function query(sql,readOnly=false){
 const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query${readOnly?'/read-only':''}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql}),signal:AbortSignal.timeout(180000)});
 if(!response.ok)throw Error(`Production SQL HTTP ${response.status}: ${(await response.text()).slice(0,900)}`);
 return response.json();
}
const history=await query('select version from supabase_migrations.schema_migrations order by version',true);
const versions=history.map(r=>r.version);
if(versions.includes('202610290001')||versions.includes('202610290002'))throw Error('Release already partly/applied; inspect before retrying');
assert.equal(versions.at(-1),'202610240001','Unexpected production migration history');
const snapshot=JSON.parse(backup);
const replaced=['recalculate_organization_rating(uuid)','u2_cost_for_target(text,uuid,text)','u3_awards_for_target(text,uuid)','u2_registration_guard()','cancel_session_registration(uuid,text)','u2_registration_action(uuid,uuid,integer,jsonb,uuid)'];
let rollback="begin;\nset local lock_timeout='5s';\nset local statement_timeout='150s';\n";
for(const [table,name] of [['event_registrations','u5_reserve_after_registration'],['event_sessions','u5_reserve_session_capacity'],['event_groups','u5_reserve_group_capacity']])rollback+=`drop trigger if exists ${name} on public.${table};\n`;
for(const signature of replaced){const fn=snapshot.functions.find(f=>f.signature===signature);assert.ok(fn,signature);rollback+=fn.definition+';\n';}
rollback+=`do $$declare entity uuid;begin
 for entity in select id from profiles loop perform recalculate_player_rating(entity);end loop;
 for entity in select id from teams loop perform recalculate_organization_rating(entity);end loop;
end $$;
alter table public.teams drop constraint teams_main_rating_range;
alter table public.teams add constraint teams_main_rating_range check(main_rating between 1 and 999);
alter table public.teams alter column main_rating set default ${snapshot.columns.find(c=>c.table_schema==='public'&&c.table_name==='teams'&&c.column_name==='main_rating')?.column_default??'null'};
update public.economy_settings set currency_name='${String(snapshot.data['public.economy_settings'][0]?.currency_name??'Монеты Арены').replaceAll("'","''")}' where singleton;
delete from supabase_migrations.schema_migrations where version in('202610290001','202610290002');
commit;`;
await writeFile(new URL('rollback-economy.sql',artifacts),rollback);
if(process.argv.includes('--prepare')){console.log('Prepared recovery SQL; production was read only');process.exit(0);}
let sql=`begin;set local lock_timeout='5s';set local statement_timeout='150s';
create temporary table economy_release_before as select
 (select jsonb_agg(to_jsonb(w) order by user_id) from public.site_wallets w) wallets,
 (select count(*) from public.currency_ledger) ledger,
 (select count(*) from public.competition_player_facts) player_facts,
 (select count(*) from public.competition_team_facts) team_facts,
 (select jsonb_agg(jsonb_build_array(target_id,exact_rating) order by target_id) from public.competition_ratings where target_type='player' and mode='main') player_ratings;
`;
const applied=[];
for(const file of ['202610290001_organization_values.sql','202610290002_registration_reserve.sql']){
 const content=await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8');
 assert.match(content,/^begin;/i);assert.match(content,/commit;\s*$/i);
 sql+=content.replace(/^begin;/i,'').replace(/commit;\s*$/i,'')+'\n';
 const version=file.slice(0,12),name=file.slice(13,-4);
 sql+=`insert into supabase_migrations.schema_migrations(version,name) values('${version}','${name}');\n`;
 applied.push({file,sha256:createHash('sha256').update(content).digest('hex')});
}
sql+=`do $$declare b record;begin select * into b from economy_release_before;
 if b.wallets is distinct from (select jsonb_agg(to_jsonb(w) order by user_id) from public.site_wallets w)
 or b.ledger<>(select count(*) from public.currency_ledger)
 or b.player_facts<>(select count(*) from public.competition_player_facts)
 or b.team_facts<>(select count(*) from public.competition_team_facts)
 or b.player_ratings is distinct from (select jsonb_agg(jsonb_build_array(target_id,exact_rating) order by target_id) from public.competition_ratings where target_type='player' and mode='main')
 then raise exception 'Unexpected change to sporting facts, player ratings or balances; abort release';end if;
end $$;commit;`;
await query(sql);
await writeFile(new URL('production-applied.json',artifacts),JSON.stringify({project:ref,appliedAt:new Date().toISOString(),applied,recoverySha256:manifest.sha256},null,2));
console.log(JSON.stringify({productionApplied:true,files:applied.map(x=>x.file)}));
