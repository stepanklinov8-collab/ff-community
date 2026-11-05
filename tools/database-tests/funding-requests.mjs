import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function verifyFundingRequests(db,id){
 const owner=id(999601),alice=id(999602),bob=id(999603),admin=id(999604),org=id(999605);
 for(const [user,name] of [[owner,'Funding owner'],[alice,'Funding player'],[bob,'Other'],[admin,'Funding admin']]){
  await db.query('insert into auth.users(id) values($1)',[user]);await db.query('insert into profiles(id,nickname) values($1,$2)',[user,name]);
 }
 await db.query("insert into user_roles(user_id,role) values($1,'superadmin'),($2,'admin')",[owner,admin]);
 await db.query("insert into teams(id,name,type,leader_id,owner_user_id,ultimate_owner_user_id) values($1,'Funding organization','team',$2,$2,$2)",[org,alice]);
 const act=async(actor,action,input,key=randomUUID())=>(await db.query('select coin_deposit_action($1,$2,$3,$4::jsonb) result',[actor,key,action,JSON.stringify(input)])).rows[0].result;
 const balance=async(team=false)=>Number((await db.query(`select balance from coin_accounts where ${team?'team_id':'user_id'}=$1`,[team?org:alice])).rows[0]?.balance??0);
 const demoBefore=(await db.query('select coalesce(sum(balance),0)::text total from site_wallets')).rows[0].total;
 const key=randomUUID(),input={amount:250};
 await act(alice,'deposit_request',input,key);await act(alice,'deposit_request',input,key);
 assert.equal(await balance(),0);assert.equal((await db.query('select count(*)::int n from coin_deposits where id=$1',[key])).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int n from coin_request_deliveries where request_id=$1',[key])).rows[0].n,2);
 await assert.rejects(()=>act(alice,'deposit_request',{amount:251},key),/Конфликт/);
 await assert.rejects(()=>act(admin,'deposit_credit',{depositId:key,reason:'Paid'}),/Нет прав/);
 await assert.rejects(()=>act(bob,'deposit_cancel',{depositId:key}),/Нет прав/);
 const approval=randomUUID();await act(owner,'deposit_credit',{depositId:key,reason:'Manual payment confirmed'},approval);
 await act(owner,'deposit_credit',{depositId:key,reason:'Manual payment confirmed'},approval);assert.equal(await balance(),250);
 await assert.rejects(()=>act(owner,'deposit_credit',{depositId:key,reason:'Duplicate approval'}),/уже/);
 const teamKey=randomUUID();await act(alice,'deposit_request',{amount:150,teamId:org},teamKey);
 await assert.rejects(()=>act(bob,'deposit_cancel',{depositId:teamKey}),/Нет прав/,'NULL personal account field must not bypass organization authorization');
 await assert.rejects(()=>act(bob,'deposit_request',{amount:1,teamId:org}),/Нет прав/);
 assert.equal((await db.query('select coin_deposits_list($1) result',[bob])).rows[0].result.length,0);
 await assert.rejects(()=>db.query('select coin_deposits_list($1,true)',[admin]),/Нет прав/);
 await act(owner,'deposit_credit',{depositId:teamKey,reason:'Organization payment received'});assert.equal(await balance(true),150);assert.equal(await balance(),250);
 for(const outcome of ['deposit_cancel','deposit_reject']){
  const k=randomUUID();await act(alice,'deposit_request',{amount:100},k);await act(outcome==='deposit_cancel'?alice:owner,outcome,{depositId:k,reason:'Not paid'});assert.equal(await balance(),250);
 }
 const pending=randomUUID();await act(alice,'deposit_request',{amount:100},pending);
 await db.query("update coin_request_deliveries set next_attempt_at=now()+interval '1 day' where request_id<>$1",[pending]);
 const lease=randomUUID(),second=randomUUID();
 const claims=(await db.query('select * from coin_notifications_claim($1,$2)',[['vk'],lease])).rows;
 assert.equal(claims.length,1);assert.equal(claims[0].request_id,pending);
 assert.equal((await db.query('select * from coin_notifications_claim($1,$2)',[['vk'],second])).rows.length,0);
 await db.query('select coin_notifications_finish($1,$2,null)',[claims[0].id,second]);
 assert.equal((await db.query('select delivered_at from coin_request_deliveries where id=$1',[claims[0].id])).rows[0].delivered_at,null);
 await db.query("select coin_notifications_finish($1,$2,'VK_901')",[claims[0].id,lease]);
 assert.equal((await db.query('select delivered_at from coin_request_deliveries where id=$1',[claims[0].id])).rows[0].delivered_at,null);
 await db.query("update coin_request_deliveries set next_attempt_at=now()-interval '1 second' where id=$1",[claims[0].id]);
 const retried=(await db.query('select * from coin_notifications_claim($1,$2)',[['vk'],second])).rows;assert.equal(retried[0].id,claims[0].id);
 await db.query('select coin_notifications_finish($1,$2,null)',[claims[0].id,second]);
 assert.ok((await db.query('select delivered_at from coin_request_deliveries where id=$1',[claims[0].id])).rows[0].delivered_at);
 for(const role of ['anon','authenticated']){
  for(const table of ['coin_deposits','coin_funding_actions','coin_request_deliveries'])assert.equal((await db.query('select has_table_privilege($1,$2,\'select\') ok',[role,table])).rows[0].ok,false);
  assert.equal((await db.query("select has_function_privilege($1,'coin_deposit_action(uuid,uuid,text,jsonb)','execute') ok",[role])).rows[0].ok,false);
 }
 assert.equal((await db.query('select coalesce(sum(balance),0)::text total from site_wallets')).rows[0].total,demoBefore);
 console.log('PASS: manual deposit approval, idempotent credit, private organization requests, cancellation/rejection, demo isolation and durable leased notification retries');
}
