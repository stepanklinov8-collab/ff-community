import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite(),id=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create table events(id uuid primary key,max_teams int);create table event_sessions(id uuid primary key,event_id uuid,max_teams int);create table event_registrations(id uuid,session_id uuid,event_id uuid,status text);
 insert into events values('${id(1)}',12),('${id(2)}',15);insert into event_sessions values('${id(10)}','${id(1)}',null),('${id(11)}','${id(1)}',8),('${id(12)}','${id(2)}',null);
 insert into event_registrations values('${id(20)}','${id(10)}','${id(1)}','confirmed'),('${id(21)}','${id(10)}','${id(1)}','waiting'),('${id(22)}','${id(10)}','${id(1)}','cancelled'),('${id(23)}','${id(12)}','${id(2)}','confirmed');`);
 await db.exec(await readFile(new URL('../../supabase/migrations/202611020001_event_registration_counts.sql',import.meta.url),'utf8'));
 const rows=(await db.query('select * from u5_event_registration_counts($1) order by session_id',[id(1)])).rows;
 assert.deepEqual(rows.map(row=>[row.session_id,Number(row.registered),Number(row.waiting),row.capacity]),[[id(10),1,1,12],[id(11),0,0,8]]);
 for(const role of ['anon','authenticated'])assert.equal((await db.query("select has_function_privilege($1,'u5_event_registration_counts(uuid)','execute') ok",[role])).rows[0].ok,false);
 assert.equal((await db.query("select has_function_privilege('service_role','u5_event_registration_counts(uuid)','execute') ok")).rows[0].ok,true);
 assert.equal((await db.query('select count(*)::int n from event_registrations')).rows[0].n,4);
 console.log('PASS: server-only aggregate counts, empty sessions, overrides, cancelled registrations, event isolation and unchanged registrations');
}finally{await db.close();}
