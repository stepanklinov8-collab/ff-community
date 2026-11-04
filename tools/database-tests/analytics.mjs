import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite(),id=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
try{
 await db.exec(`create schema auth;create role anon;create role authenticated;create role service_role;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table profiles(id uuid primary key,nickname text);create table user_roles(user_id uuid,role text);
 create function is_full_admin(p_user uuid)returns boolean language sql stable as $$select exists(select 1 from user_roles where user_id=p_user and role in('admin','superadmin'))$$;
 create table economy_settings(singleton boolean,currency_name text);insert into economy_settings values(true,'OMCITE Coins');
 create table site_wallets(user_id uuid,balance bigint);create table coin_accounts(user_id uuid,balance bigint);
 insert into profiles values('${id(1)}','Admin'),('${id(2)}','Player'),('${id(3)}','Other');insert into user_roles values('${id(1)}','admin');
 insert into site_wallets values('${id(2)}',900);insert into coin_accounts values('${id(2)}',1000000);`);
 await db.exec(await readFile(new URL('../../supabase/migrations/202611010001_user_activity_and_forecast_points.sql',import.meta.url),'utf8'));
 const touch=(visit,view,path='/wallet',active=true)=>db.query('select analytics_touch($1,$2,$3,$4,$5)',[id(visit),id(view),path,active,'mobile']);
 await assert.rejects(()=>touch(10,20),/AUTH_REQUIRED/);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(2)]);await touch(10,20);
 // Simulate one active interval without waiting or depending on a client clock.
 await db.exec(`update analytics_user_clock set last_active_at=clock_timestamp()-interval '26 seconds';update analytics_page_views set last_seen_at=clock_timestamp()-interval '26 seconds';`);
 await touch(10,20);
 let seconds=Number((await db.query('select active_seconds from analytics_visits where id=$1',[id(10)])).rows[0].active_seconds);assert.ok(seconds>=26&&seconds<=27);
 await touch(10,20);assert.equal(Number((await db.query('select active_seconds from analytics_visits where id=$1',[id(10)])).rows[0].active_seconds),seconds);
 await touch(11,21);assert.equal(Number((await db.query('select sum(active_seconds) n from analytics_visits')).rows[0].n),seconds,'a second tab cannot add the same active interval');
 await db.exec("update analytics_user_clock set last_active_at=clock_timestamp()-interval '10 minutes';update analytics_page_views set last_seen_at=clock_timestamp()-interval '26 seconds'");await touch(10,20);assert.equal(Number((await db.query('select sum(active_seconds) n from analytics_visits')).rows[0].n),seconds,'long offline time is not credited');
 await assert.rejects(()=>touch(10,22,'/wallet?token=secret'),/INVALID_ACTIVITY/);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(3)]);await assert.rejects(()=>touch(10,23),/VISIT_OWNER/);await assert.rejects(()=>touch(12,20),/VIEW_OWNER/);
 await assert.rejects(()=>db.query("select analytics_report($1,now()-interval '1 day',now()+interval '1 day')",[id(2)]),/ADMIN_REQUIRED/);
 const report=(await db.query("select analytics_report($1,now()-interval '1 day',now()+interval '1 day','',0,$2) r",[id(1),id(2)])).rows[0].r;
 assert.equal(report.summary.users,1);assert.equal(report.summary.visits,2);assert.equal(report.summary.views,2);assert.equal(report.history.length,2);
 assert.equal((await db.query("select has_table_privilege('authenticated','analytics_page_views','select') allowed")).rows[0].allowed,false);
 assert.equal((await db.query("select has_function_privilege('authenticated','analytics_report(uuid,timestamptz,timestamptz,text,integer,uuid)','execute') allowed")).rows[0].allowed,false);
 await db.exec("update analytics_page_views set last_seen_at=now()-interval '91 days';update analytics_visits set last_seen_at=now()-interval '91 days';select analytics_cleanup();");assert.equal((await db.query('select count(*)::int n from analytics_page_views')).rows[0].n,0);
 assert.equal(Number((await db.query('select balance from site_wallets')).rows[0].balance),900);assert.equal(Number((await db.query('select balance from coin_accounts')).rows[0].balance),1000000);
 console.log('PASS: authenticated-only activity, overlap deduplication, idle bounds, private reports, retention and independent balances');
}finally{await db.close();}
