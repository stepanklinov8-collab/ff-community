// Restore the complete logical archive inside a single ROLLBACK transaction
// in the dedicated staging project. Existing staging fixtures remain intact.
import {readFile,writeFile,realpath,readdir} from 'node:fs/promises';
import {resolve,relative,join,isAbsolute} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {stagingProject,assertTestDatabaseTarget} from '../../src/platform/environment.ts';
assertTestDatabaseTarget(`https://${stagingProject}.supabase.co`);
const argument=process.argv.find(value=>value.startsWith('--backup='))?.slice(9);
if(!argument)throw Error('Select the local backup directory with --backup=...');
const root=await realpath(resolve('tools/database-tests/artifacts/release-backup')),directory=await realpath(resolve(argument));
if(relative(root,directory).startsWith('..')||directory===root||isAbsolute(relative(root,directory)))throw Error('Backup must be a captured release-backup child directory');
const manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8')),archive=join(directory,'database.dump');
const hash=createHash('sha256').update(await readFile(archive)).digest('hex');
if(manifest.sourceProject!=='ojtqdfdqicozzqlgjtnm'||manifest.sha256!==hash)throw Error('Backup project/hash mismatch');
const binaries=resolve('../ff-update-2/tools/database-tests/artifacts/postgresql18/pgsql/bin');
async function run(name,args,env=process.env){
 return new Promise((done,fail)=>{
  const child=spawn(join(binaries,name+'.exe'),args,{env,windowsHide:true,stdio:['ignore','pipe','pipe']});let out='',errors='';
  const phases=new Set();child.stdout.on('data',data=>{out+=data;for(const match of out.matchAll(/RESTORE_PHASE:[a-z_]+/g))if(!phases.has(match[0])){phases.add(match[0]);console.log(match[0]);}});child.stderr.on('data',data=>errors+=data);
  const timeout=setTimeout(()=>child.kill(),name==='psql'?600000:180000);
  child.once('error',error=>{clearTimeout(timeout);fail(error);});
  child.once('exit',async code=>{clearTimeout(timeout);try{await writeFile(join(directory,name+'-restore-private.log'),errors);if(code!==0)throw Error(`${name} failed (${code}); private diagnostic saved`);done(out);}catch(error){fail(error);}});
 });
}
const toc=await run('pg_restore',['--list',archive]);
await writeFile(join(directory,'toc.list'),toc);
const dataPath=join(directory,'all-data-private.sql');await run('pg_restore',['--data-only','--no-owner','--no-privileges','--file='+dataPath,archive]);
const identifier='(?:"(?:[^"]|"")*"|[a-z_][a-z0-9_$]*)',copyPattern=new RegExp('^COPY ('+identifier+')\\.('+identifier+') \\(');
const decode=value=>value.startsWith('"')?value.slice(1,-1).replaceAll('""','"'):value;
const quote=value=>'"'+value.replaceAll('"','""')+'"';
const counts=[];let current=null;
for(const line of(await readFile(dataPath,'utf8')).split('\n')){
 const value=line.replace(/\r$/,'');
 if(current){if(value==='\\.'){counts.push(current);current=null;}else current.rows++;}
 else{const match=copyPattern.exec(value);if(match)current={schema:decode(match[1]),table:decode(match[2]),rows:0};}
}
if(current||counts.length<20||!counts.some(row=>row.schema==='auth'&&row.table==='users'&&row.rows>0))throw Error('Archive data did not fully decode');
await writeFile(join(directory,'archive-table-counts.json'),JSON.stringify(counts,null,2));
const platformSchemas=new Set(['auth','storage','realtime','extensions','vault','graphql','graphql_public','pgbouncer','supabase_functions']);
// Target-managed service migration journals must match the target's running
// Auth/Storage/Realtime version, rather than importing a different service's
// installation history. They contain platform metadata, not user records.
const platformJournals=new Set(['auth.schema_migrations','storage.migrations','realtime.schema_migrations']);
// Realtime creates dated transport partitions independently in each project.
// Empty source partitions contain no chat history/user records to restore.
for(const row of counts)if(row.schema==='realtime'&&/^messages_\d{4}_\d{2}_\d{2}$/.test(row.table)&&row.rows===0)platformJournals.add(row.schema+'.'+row.table);
const restoredCounts=counts.filter(row=>!platformJournals.has(row.schema+'.'+row.table));
const rowCounts=new Map(counts.map(row=>[row.schema+'.'+row.table,row.rows]));
const customSchemas=new Set(['public']);
const selected=[];
for(const line of toc.split(/\r?\n/)){
 const entry=/^(\d+); \d+ \d+ (.+)$/.exec(line);if(!entry)continue;
 const body=entry[2],schema=/^SCHEMA - (\S+) /.exec(body);
 // Platform administrator defaults belong to the hosted service role and
 // cannot be reassigned by the project's postgres role. Application-owned
 // defaults and all selected object grants are still restored/tested.
 if(body.startsWith('DEFAULT ACL ')&&!body.endsWith(' postgres'))continue;
 if(schema&&!platformSchemas.has(schema[1])){customSchemas.add(schema[1]);selected.push(line);continue;}
 // All table data, including Auth/storage, is restored. The target already
 // supplies Supabase-managed definitions and extensions (official restore model).
 const tableData=/^TABLE DATA (\S+) (\S+) /.exec(body);
 if(tableData){const key=tableData[1]+'.'+tableData[2];if(!platformJournals.has(key)&&!(platformSchemas.has(tableData[1])&&rowCounts.get(key)===0))selected.push(line);continue;}
 // setval on an existing platform sequence is not transactional. Preserve
 // those live staging counters; the archive retains their recovery values.
 const sequence=/^SEQUENCE SET (\S+) /.exec(body);
 if(sequence){if(!platformSchemas.has(sequence[1]))selected.push(line);continue;}
 if([...customSchemas].some(name=>new RegExp('^(?!SCHEMA )(?:.+ )'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' ').test(body))){selected.push(line);continue;}
 // Custom Auth triggers depend on restored public functions and were removed
 // by DROP public CASCADE. Supabase-owned platform objects stay in place.
 if(/^TRIGGER auth \S+ \S+ postgres$/.test(body))selected.push(line);
}
const listPath=join(directory,'restore-selection.list');await writeFile(listPath,selected.join('\n')+'\n');
const sections=[];
for(const section of ['pre-data','data','post-data']){
 const restorePath=join(directory,'restore-'+section+'-private.sql');await run('pg_restore',['--use-list='+listPath,'--no-owner','--section='+section,'--file='+restorePath,archive]);sections.push(await readFile(restorePath,'utf8'));
}
const selectedSql=sections.map((sql,index)=>sql+`\nselect 'RESTORE_PHASE:${['pre_data','data','post_data'][index]}';\n`).join('\n');
if(/^(?:CREATE EXTENSION|CREATE DATABASE|ALTER DATABASE|\\connect)\b/im.test(selectedSql))throw Error('Unexpected database/platform mutation in the restore selection');
// New target-managed Storage bookkeeping may not yet exist on the staging
// service version. Only these named, empty source tables may be absent; never
// skip a populated platform table or any application table.
const targetManagedEmptyTables=['storage.bucket_lifecycle_states','storage.lifecycle_abandoned_artifacts'];
const checks=restoredCounts.map(row=>{
 const table=quote(row.schema)+'.'+quote(row.table),check=`if (select count(*) from ${table})<>${row.rows} then raise exception 'RESTORE_COUNT_MISMATCH';end if;`;
 return row.rows===0&&targetManagedEmptyTables.includes(row.schema+'.'+row.table)?`if to_regclass('${table.replaceAll("'","''")}') is not null then ${check} end if;`:check;
}).join('\n');
const tables=restoredCounts.filter(row=>platformSchemas.has(row.schema)&&row.rows>0).map(row=>quote(row.schema)+'.'+quote(row.table));
const preamble=`begin;set local lock_timeout='5s';set local statement_timeout='120s';set local session_replication_role=replica;\n`+
 [...customSchemas].map(schema=>`drop schema if exists ${quote(schema)} cascade;`).join('\n')+'\ncreate schema public;\n'+
 tables.map(table=>'delete from '+table+';').join('\n')+'\n';
const optimization=process.argv.includes('--rehearse-optimization'),finance=process.argv.includes('--rehearse-finance');
if(['--rehearse-optimization','--rehearse-finance','--rehearse-update'].filter(value=>process.argv.includes(value)).length>1)throw Error('Select one exact release boundary');
const updateFiles=finance?['202611050001_funding_requests_notifications.sql','202611050002_withdrawal_details_and_request_contacts.sql','202611050003_withdrawal_notification_contacts.sql']:optimization?['202611010001_user_activity_and_forecast_points.sql','202611020001_event_registration_counts.sql']:process.argv.includes('--rehearse-update')?(await readdir(resolve('supabase/migrations'))).filter(name=>/^\d{12}_.+\.sql$/.test(name)&&name>='202610290003'&&name<='202610310018_player_transfer_cancellation_penalty.sql').sort():[];
const updateSources=await Promise.all(updateFiles.map(async name=>({name,sql:await readFile(resolve('supabase/migrations',name),'utf8')})));
const updateBody=updateSources.map(({sql})=>sql.replace(/^begin;\s*$/mi,'').replace(/^commit;\s*$/mi,'')).join('\n');
const optimizationChecks=`set local session_replication_role=origin;set local search_path=public,extensions;set local check_function_bodies=on;set local row_security=on;
create temporary table optimization_before as select (select count(*) from profiles) profiles,(select count(*) from teams) organizations,(select count(*) from team_members) members,(select count(*) from event_registrations) registrations,(select coalesce(sum(balance),0)::numeric from coin_accounts) main,(select coalesce(sum(reserved),0)::numeric from coin_accounts) reserved,(select coalesce(sum(balance),0)::numeric from site_wallets) forecasts;
${optimization?updateBody:''}
do $$begin
 if exists(select 1 from optimization_before b where b.profiles<>(select count(*) from profiles) or b.organizations<>(select count(*) from teams) or b.members<>(select count(*) from team_members) or b.registrations<>(select count(*) from event_registrations) or b.main<>(select coalesce(sum(balance),0)::numeric from coin_accounts) or b.reserved<>(select coalesce(sum(reserved),0)::numeric from coin_accounts) or b.forecasts<>(select coalesce(sum(balance),0)::numeric from site_wallets)) then raise exception 'OPTIMIZATION_DATA_CHANGED';end if;
 if to_regprocedure('public.u5_event_registration_counts(uuid)') is null or not (select relrowsecurity from pg_class where oid='public.analytics_visits'::regclass) then raise exception 'OPTIMIZATION_SCHEMA';end if;
 if has_function_privilege('authenticated','public.analytics_report(uuid,timestamptz,timestamptz,text,integer,uuid)','execute') or has_function_privilege('anon','public.u5_event_registration_counts(uuid)','execute') then raise exception 'OPTIMIZATION_ACL';end if;
end $$;select 'RESTORE_PHASE:update_migrations';
`;
const financeChecks=`set local session_replication_role=origin;set local search_path=public,extensions;set local check_function_bodies=on;set local row_security=on;
create temporary table finance_before as select jsonb_build_object(
 'profiles',(select count(*) from profiles),'organizations',(select count(*) from teams),'members',(select count(*) from team_members),
 'registrations',(select count(*) from event_registrations),
 'main',(select md5(coalesce(string_agg(id||':'||balance||':'||reserved,',' order by id),'')) from coin_accounts),
 'forecasts',(select md5(coalesce(string_agg(user_id||':'||balance,',' order by user_id),'')) from site_wallets),
 'withdrawals',(select md5(coalesce(string_agg((to_jsonb(w)-'full_name_latin'-'transfer_country')::text,',' order by w.id),'')) from coin_withdrawals w)
) protected;
${finance?updateBody:''}
do $$begin
 if (select protected from finance_before)<>jsonb_build_object(
 'profiles',(select count(*) from profiles),'organizations',(select count(*) from teams),'members',(select count(*) from team_members),
 'registrations',(select count(*) from event_registrations),
 'main',(select md5(coalesce(string_agg(id||':'||balance||':'||reserved,',' order by id),'')) from coin_accounts),
 'forecasts',(select md5(coalesce(string_agg(user_id||':'||balance,',' order by user_id),'')) from site_wallets),
 'withdrawals',(select md5(coalesce(string_agg((to_jsonb(w)-'full_name_latin'-'transfer_country')::text,',' order by w.id),'')) from coin_withdrawals w)
 ) then raise exception 'FINANCE_PROTECTED_DATA_CHANGED';end if;
 if (select count(*) from coin_deposits)<>0 or(select count(*) from coin_request_deliveries)<>0 then raise exception 'FINANCE_UNEXPECTED_NEW_REQUESTS';end if;
 if not (select relrowsecurity from pg_class where oid='public.coin_deposits'::regclass) or has_table_privilege('authenticated','coin_deposits','select')
 or has_function_privilege('authenticated','coin_deposit_action(uuid,uuid,text,jsonb)','execute') then raise exception 'FINANCE_ACL';end if;
end $$;select 'RESTORE_PHASE:update_migrations';
`;
const updateChecks=finance?financeChecks:optimization?optimizationChecks:updateFiles.length?`set local session_replication_role=origin;
set local search_path=public,extensions;set local check_function_bodies=on;set local row_security=on;set local statement_timeout='150s';
create temporary table release_wallet_before as select sum(balance)::numeric total from public.site_wallets;
${updateBody}
do $$begin
 if (select count(*) from public.profiles)<>${counts.find(row=>row.schema==='public'&&row.table==='profiles').rows} then raise exception 'RELEASE_PROFILE_COUNT';end if;
 if (select count(*) from public.teams)<>${counts.find(row=>row.schema==='public'&&row.table==='teams').rows} then raise exception 'RELEASE_ORGANIZATION_COUNT';end if;
 if (select count(*) from public.team_members)<>${counts.find(row=>row.schema==='public'&&row.table==='team_members').rows} then raise exception 'RELEASE_MEMBERSHIP_COUNT';end if;
 if coalesce((select sum(balance)::numeric from public.site_wallets),0)+coalesce((select sum(balance)::numeric from public.coin_accounts),0)<>coalesce((select total from release_wallet_before),0) then raise exception 'RELEASE_COIN_CONSERVATION';end if;
 if exists(select 1 from public.teams where owner_user_id is null and owner_team_id is null) then raise exception 'RELEASE_OWNER_BACKFILL';end if;
end $$;
select 'RESTORE_PHASE:update_migrations';
` : '';
const script=preamble+selectedSql+`\ndo $$begin ${checks} end $$;\nselect 'RESTORE_VERIFIED_TABLES:${restoredCounts.length}';\n`+updateChecks+'\nrollback;\n';
const scriptPath=join(directory,'restore-rehearsal-private.sql');await writeFile(scriptPath,script);
console.log(JSON.stringify({prepared:true,project:stagingProject,archiveSha256:hash,tables:restoredCounts.length,rows:restoredCounts.reduce((sum,row)=>sum+row.rows,0),updateMigrations:updateFiles.length,rollbackOnly:true,targetManagedJournals:[...platformJournals]}));
if(!process.argv.includes('--run'))process.exit(0);
const token=(await readFile('C:/Users/Lenovo/.supabase/access-token','utf8')).trim();
async function management(path,body){const response=await fetch(`https://api.supabase.com/v1/projects/${stagingProject}/${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`Staging management request failed (${response.status})`);return response.json();}
const observed=`select (select count(*) from profiles) profiles,(select count(*) from auth.users) users,(select count(*) from teams) organizations,(select count(*) from team_members) members,(select sum(balance)::text from coin_accounts) balances,(select sum(reserved)::text from coin_accounts) reserved,(select md5(string_agg(oid::regprocedure::text||pg_get_functiondef(oid),',' order by oid)) from pg_proc where pronamespace='public'::regnamespace and prokind='f') functions`;
const before=await management('database/query/read-only',{query:observed});
const login=await management('cli/login-role',{read_only:false}),pool=(await management('config/database/pooler')).find(value=>value.database_type==='PRIMARY');
if(!pool?.db_host?.endsWith('.pooler.supabase.com'))throw Error('Unexpected staging pooler');
const env={...process.env,PGHOST:pool.db_host,PGPORT:'5432',PGUSER:`${login.role}.${stagingProject}`,PGPASSWORD:login.password,PGDATABASE:'postgres',PGSSLMODE:'require',PGCONNECT_TIMEOUT:'20',PGAPPNAME:'omcite_staging_restore_rollback'};
// SET ROLE is supplied as a separate psql command; no credential enters SQL.
const role=login.role.replace(/^cli_login_/,'');if(!/^[a-z_]+$/.test(role))throw Error('Unexpected restore role');
let out,restoreFailure;
try{out=await run('psql',['--no-psqlrc','--quiet','--tuples-only','--no-align','--set=ON_ERROR_STOP=1','--command=set role '+role,'--file='+scriptPath],env);}catch(error){restoreFailure=error;}
const after=await management('database/query/read-only',{query:observed});
if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Staging state was changed despite the restore rollback');
await writeFile(join(directory,'restore-attempt.json'),JSON.stringify({project:stagingProject,checkedAt:new Date().toISOString(),rollbackVerified:true,restored:!restoreFailure&&out?.includes(`RESTORE_VERIFIED_TABLES:${restoredCounts.length}`),error:restoreFailure?.message},null,2));
if(restoreFailure)throw restoreFailure;
if(!out.includes(`RESTORE_VERIFIED_TABLES:${restoredCounts.length}`))throw Error('Restore verification did not finish');
if(updateFiles.length&&!out.includes('RESTORE_PHASE:update_migrations'))throw Error('Migration rehearsal did not finish');
const proof={sourceProject:manifest.sourceProject,targetProject:stagingProject,sha256:hash,capturedAt:manifest.capturedAt,restoredAt:new Date().toISOString(),verified:true,tables:restoredCounts.length,rows:restoredCounts.reduce((sum,row)=>sum+row.rows,0),rollbackVerified:true,platformDefinitions:'target-managed',platformAdminDefaults:'target-managed; application-owned defaults restored',platformJournals:[...platformJournals],targetManagedEmptyTables:restoredCounts.filter(row=>row.rows===0&&targetManagedEmptyTables.includes(row.schema+'.'+row.table)).map(row=>row.schema+'.'+row.table),platformSequenceCounters:'preserved; original recovery values retained in archive',productionChanged:false};
if(updateFiles.length)proof.updateMigrations=updateSources.map(({name,sql})=>({name,sha256:createHash('sha256').update(sql).digest('hex')}));
await writeFile(join(directory,'restore-proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
