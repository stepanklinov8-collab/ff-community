// Recovery snapshot through the Management API. This is not a full pg_dump archive.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const ref='ojtqdfdqicozzqlgjtnm';
const token=(await readFile('C:/Users/Lenovo/.supabase/access-token','utf8')).trim();
const output=new URL('./artifacts/economy-release/',import.meta.url);
await mkdir(output,{recursive:true});
async function query(sql){
 const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query/read-only`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql}),signal:AbortSignal.timeout(120000)});
 if(!response.ok)throw Error(`Snapshot HTTP ${response.status}: ${(await response.text()).slice(0,300)}`);
 return response.json();
}
const quote=name=>'"'+name.replaceAll('"','""')+'"';
const tables=await query("select n.nspname schema,c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','auth','storage','supabase_migrations') and c.relkind in('r','p') and not c.relispartition order by 1,2");
const data=await query(`select transaction_timestamp() captured_at,(select jsonb_object_agg(name,rows) from (${tables.map(t=>`select '${t.schema}.${t.name}' name,coalesce(jsonb_agg(to_jsonb(r)),'[]') rows from ${quote(t.schema)}.${quote(t.name)} r`).join(' union all ')}) contents) data,
 (select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f') functions,
 (select jsonb_agg(jsonb_build_object('table',t.tgrelid::regclass::text,'name',t.tgname,'definition',pg_get_triggerdef(t.oid))) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname='public') triggers,
 (select jsonb_agg(to_jsonb(c)) from information_schema.columns c where table_schema in('public','auth','storage','supabase_migrations')) columns,
 (select jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,'definition',pg_get_constraintdef(c.oid))) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public') constraints,
 (select jsonb_agg(to_jsonb(p)) from pg_policies p where schemaname='public') policies`);
const snapshot={project:ref,...data[0]};
const body=JSON.stringify(snapshot);await writeFile(new URL('recovery-snapshot-private.json',output),body);
const summary={project:ref,capturedAt:snapshot.captured_at,bytes:Buffer.byteLength(body),sha256:createHash('sha256').update(body).digest('hex'),tableCount:tables.length,
 rows:Object.fromEntries(Object.entries(snapshot.data).map(([name,rows])=>[name,rows.length])),fullPgDump:false};
await writeFile(new URL('recovery-manifest.json',output),JSON.stringify(summary,null,2));
console.log(JSON.stringify({saved:true,bytes:summary.bytes,tableCount:summary.tableCount,profiles:summary.rows['public.profiles'],fullPgDump:false}));
