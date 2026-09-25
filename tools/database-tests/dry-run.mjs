// Local only. This program has no network client and never reads credentials.
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const directory=resolve(process.argv[2]??'tools/database-tests/artifacts/live-copy');
const snapshot=JSON.parse(await readFile(resolve(directory,'snapshot.json'),'utf8'));
const schema=JSON.parse(await readFile(resolve(directory,'rest-schema.json'),'utf8'));
const db=new PGlite();
const quote=s=>'"'+s.replaceAll('"','""')+'"';
const tableCounts={};const applied=[];
try{
 await db.exec(await readFile(new URL('./baseline.sql',import.meta.url),'utf8'));
 const dynamic=await readFile(new URL('../../supabase/migrations/202609060005_dynamic_betting.sql',import.meta.url),'utf8');
 await db.exec(dynamic.slice(dynamic.indexOf('create table if not exists public.betting_sources'),dynamic.indexOf('create or replace function public.place_dynamic_site_bet_for(')));
 // REST metadata augments the fixture with the actual exported column types.
 // It does not expose the complete production constraints, triggers or RLS.
 const formats=new Set(['uuid','text','integer','bigint','smallint','numeric','boolean','jsonb','json','timestamp with time zone','timestamp without time zone','date','double precision','character varying']);
 for(const [table,rows] of Object.entries(snapshot.tables)){
  if(!(await db.query('select to_regclass($1) name',['public.'+table])).rows[0].name)await db.exec(`create table public.${quote(table)} ()`);
  const existing=new Set((await db.query(`select column_name from information_schema.columns where table_schema='public' and table_name=$1`,[table])).rows.map(r=>r.column_name));
  for(const [column,property] of Object.entries(schema.definitions[table].properties)){
   if(existing.has(column))continue;
   let type=property.format;
   if(property.type==='array')type=(property.items?.format??'text')+'[]';
   if(!formats.has(type)&&!['uuid[]','text[]','integer[]'].includes(type))throw new Error(`Unsupported exported type: ${table}.${column} ${type}`);
   await db.exec(`alter table public.${quote(table)} add column ${quote(column)} ${type}`);
  }
  tableCounts[table]=rows.length;
 }
 // Auth identities are local stubs, not copied authentication records.
 const identities=new Set();
 for(const [table,rows] of Object.entries(snapshot.tables))for(const row of rows){
  if(table==='profiles')identities.add(row.id);
  for(const [key,value] of Object.entries(row))if(typeof value==='string'&&/^(user_id|created_by|recorded_by|responsible_user_id|organizer_user_id|submitted_by|cancelled_by)$/.test(key))identities.add(value);
 }
 for(const id of identities)await db.query('insert into auth.users(id) values($1) on conflict do nothing',[id]);
 for(const [table,rows] of Object.entries(snapshot.tables))for(const row of rows){
  const columns=Object.keys(row),values=columns.map(c=>schema.definitions[table].properties[c].format?.startsWith('json')?JSON.stringify(row[c]):row[c]);
  try{await db.query(`insert into public.${quote(table)} (${columns.map(quote)}) values(${columns.map((_,i)=>'$'+(i+1))})`,values);}
  catch(error){throw new Error(`Local import ${table}: ${error.message}`);}
 }
 const legacy=await readFile(new URL('../../supabase/migrations/202609060001_competitive_economy.sql',import.meta.url),'utf8');
 const functionSQL=name=>{const start=legacy.indexOf('create or replace function public.'+name+'(');return legacy.slice(start,legacy.indexOf('end $$;',start)+9);};
 await db.exec(functionSQL('recalculate_organization_results'));
 const security=await readFile(new URL('../../supabase/migrations/202609060002_competitive_security.sql',import.meta.url),'utf8');
 await db.exec(security.slice(security.indexOf('create or replace function public.audit_organization_history()'),security.indexOf('create or replace function public.apply_reputation_review(')));
 for(const [name,table,event] of [['refresh_player_rating_from_stats','player_stats','after insert or update or delete'],['refresh_organization_rating_from_player','profiles','after update of main_rating'],['refresh_organization_rating_from_history','organization_participation_history','after insert or update or delete']]){
  await db.exec(functionSQL(name));await db.exec(`create trigger ${name}_fixture ${event} on public.${table} for each row execute function public.${name}()`);
 }
 for(const name of (await readdir(new URL('../../supabase/migrations/',import.meta.url))).filter(n=>n.startsWith('20260922')).sort()){
  try{await db.exec(await readFile(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8'));applied.push(name);console.log('Migration OK:',name);}
  catch(error){throw new Error(`${name}: ${error.message}; ${error.where??''}`);}
 }
 for(const [table,count] of Object.entries(tableCounts))assert.equal(Number((await db.query(`select count(*) n from public.${quote(table)}`)).rows[0].n),count,`Row retention: ${table}`);
 // Migration must not settle old bets, change balances, or fabricate game facts.
 for(const table of ['site_wallets','site_bets','event_game_results','event_team_results','player_stats'])for(const original of snapshot.tables[table]){
  const key=table==='site_wallets'?'user_id':'id';
  const row=(await db.query(`select * from public.${quote(table)} where ${key}=$1`,[original[key]])).rows[0];
  for(const [column,value] of Object.entries(original)){
   const format=schema.definitions[table].properties[column].format;
   if(value!==null&&format?.startsWith('timestamp'))assert.equal(new Date(row[column]).toISOString(),new Date(value).toISOString());
   else if(value!==null&&['numeric','bigint'].includes(format))assert.equal(Number(row[column]),Number(value));
   else assert.deepEqual(row[column],value,`${table}.${column} retained`);
  }
 }
 assert.equal(Number((await db.query('select count(*) n from competition_player_facts')).rows[0].n),0);
 assert.equal(Number((await db.query('select count(*) n from competition_publications where first_published_at is not null')).rows[0].n),0);
 const reviews=await db.query('select reason,count(*)::integer count from competition_migration_review group by reason order by reason');
 const unfilled=await db.query('select count(*)::integer count from event_registrations where roster_snapshot is null or name_snapshot is null');
 assert.equal(unfilled.rows[0].count,0,'All registration snapshots captured');
 const ratingsBefore=(await db.query('select id,main_rating from profiles order by id')).rows;
 await db.exec(await readFile(new URL('../../supabase/update-2/recalculate.sql',import.meta.url),'utf8'));
 const ratingsAfter=(await db.query('select id,main_rating from profiles order by id')).rows;
 const teamsAfter=(await db.query('select id,main_rating from teams order by id')).rows;
 const originals=new Map(snapshot.tables.teams.map(t=>[t.id,t.main_rating]));
 const changedTeams=teamsAfter.filter(t=>Number(t.main_rating)!==Number(originals.get(t.id))).length;
 const distribution=rows=>{const values=rows.map(r=>Number(r.main_rating)).sort((a,b)=>a-b);return {min:values[0],median:values[Math.floor(values.length/2)],max:values.at(-1),bins:[1,20,40,60,80].map((min,i)=>({min,max:[20,40,60,80,101][i],count:values.filter(v=>v>=min&&v<[20,40,60,80,101][i]).length}))};};
 const changed=ratingsAfter.filter((row,i)=>Number(row.main_rating)!==Number(ratingsBefore[i].main_rating)).length;
 const report={capturedAt:snapshot.capturedAt,verifiedAt:new Date().toISOString(),localOnly:true,sourceTableCounts:tableCounts,migrations:applied,
  checks:{allSourceRowsRetained:true,balancesAndBetsUnchanged:true,legacyResultsUnchanged:true,noInventedPersonalFacts:true,noAutomaticPublications:true,registrationSnapshotsComplete:true},
  reviewReasons:reviews.rows,recalculation:{players:ratingsAfter.length,changedPlayers:changed,teams:teamsAfter.length,changedTeams,playersBefore:distribution(ratingsBefore),playersAfter:distribution(ratingsAfter),teamsBefore:distribution(snapshot.tables.teams),teamsAfter:distribution(teamsAfter)},
  limitations:['Local PGlite fixture plus REST column metadata and selected original repository triggers. This is not a full PostgreSQL schema dump.','Authentication identities are stubs; production RLS and Storage require a separate staging check before deployment.','Export is an allowlisted data copy; omitted free-text fields and credentials are not part of this check.']};
 await writeFile(resolve(directory,'dry-run-report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}catch(error){console.error('DRY RUN FAILED:',error.message);process.exitCode=1;}finally{await db.close();}
