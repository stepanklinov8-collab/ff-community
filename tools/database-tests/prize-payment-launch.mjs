import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function prepareHistoricalPrizeLaunch(db,id){
 const owner=id(27901),event=id(27902),session=id(27903);
 await db.query('insert into auth.users(id) values($1)',[owner]);await db.query("insert into profiles(id,nickname) values($1,'Historical prize launch owner')",[owner]);await db.query("insert into user_roles(user_id,role) values($1,'superadmin')",[owner]);
 await db.query("insert into events(id,title,type,organizer_user_id,is_published,moderation_status,prize_plan,personal_prizes) values($1,'Historical unpaid prize','training',$2,true,'approved','[250,150,100]','{\"mvp\":20,\"maxKills\":10}')",[event,owner]);
 await db.query("insert into event_sessions(id,event_id,start_time,end_time) values($1,$2,'2026-11-08T20:00:00Z','2026-11-08T22:00:00Z')",[session,event]);
 const account=(await db.query("select u6_coin_account('player',$1) id",[owner])).rows[0].id;
 // Fixtures represent an old, never paid promise that already held funds.
 await db.query('update coin_accounts set balance=1000,reserved=530 where id=$1',[account]);
 await db.query("insert into event_prize_funds(session_id,account_id,plan,total,held) values($1,$2,'[250,150,100]',500,500)",[session,account]);
 await db.query("insert into personal_award_funds(event_id,session_id,account_id,plan,total,held) values($1,$2,$3,'{\"mvp\":20,\"maxKills\":10}',30,30)",[event,session,account]);
}
export async function verifyPrizePaymentLaunch(db,id){
 const historical=(await db.query('select balance::int,reserved::int from coin_accounts where user_id=$1',[id(27901)])).rows[0];
 assert.deepEqual(historical,{balance:1000,reserved:0},'rollout releases only old unpaid reserves without changing cash');
 assert.equal((await db.query('select cancelled,held::int from event_prize_funds where session_id=$1',[id(27903)])).rows[0].cancelled,true);
 assert.equal((await db.query('select cancelled_at is not null cancelled,held::int from personal_award_funds where session_id=$1',[id(27903)])).rows[0].cancelled,true);
 const owner=id(28001),team=id(28002),event=id(28003),old=id(28004),boundary=id(28005),later=id(28006),afterMidnight=id(28007);
 await db.query('insert into auth.users(id) values($1)',[owner]);await db.query("insert into profiles(id,nickname) values($1,'Prize launch owner')",[owner]);
 await db.query("insert into user_roles(user_id,role) values($1,'superadmin')",[owner]);
 await db.query("insert into teams(id,name,type,leader_id) values($1,'Prize launch team','team',$2)",[team,owner]);
 await db.query("insert into events(id,title,type,organizer_user_id,is_published,moderation_status,prize_plan,personal_prizes) values($1,'Prize launch training','training',$2,true,'approved','[250,150,100]','{\"mvp\":20,\"maxKills\":10}')",[event,owner]);
 for(const [s,time] of [[old,'2026-11-08T20:59:59Z'],[boundary,'2026-11-08T21:00:00Z'],[later,'2026-11-09T16:00:00Z'],[afterMidnight,'2026-11-08T20:00:00Z']]){
  await db.query("insert into event_sessions(id,event_id,start_time,end_time) values($1,$2,$3::timestamptz,$3::timestamptz+interval '2 hours')",[s,event,time]);
  await db.query("insert into event_groups(id,session_id,public_number,display_order,name,capacity) values($1,$2,1,1,'Main',12)",[randomUUID(),s]);
 }
 const eligible=async(s)=>(await db.query('select u7_session_prizes_payable($1) allowed',[s])).rows[0].allowed;
 assert.equal(await eligible(old),false);assert.equal(await eligible(boundary),true);assert.equal(await eligible(later),true);assert.equal(await eligible(afterMidnight),false,'starting before midnight remains old even if it ends on Nov 9');
 assert.equal(await eligible(id(28999)),false);
 await db.query("select u6_coin_action($1,$2,'adjust',$3::jsonb)",[owner,randomUUID(),JSON.stringify({kind:'player',ownerId:owner,amount:2000,reason:'Prize launch test'})]);
 await db.query('insert into site_wallets(user_id,balance) values($1,54321)',[owner]);
 const demo=async()=> (await db.query('select md5(row_to_json(w)::text) hash from site_wallets w where user_id=$1',[owner])).rows[0].hash;
 const demoBefore=await demo(),account=async()=>(await db.query('select balance::int,reserved::int from coin_accounts where user_id=$1',[owner])).rows[0];
 await db.query('select u6_reserve_session_prizes($1)',[old]);await db.query('select personal_award_reserve($1,$2)',[event,old]);
 assert.equal((await db.query('select count(*)::int n from event_prize_funds where session_id=$1',[old])).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from personal_award_funds where session_id=$1',[old])).rows[0].n,0);
 assert.deepEqual(await account(),{balance:2000,reserved:0});
 // Simulate a historical reserve created before rollout. Every settlement
 // entry point, including explicit closure's base mover, must stay blocked.
 const source=(await db.query('select id from coin_accounts where user_id=$1',[owner])).rows[0].id;
 await db.query("insert into event_prize_funds(session_id,account_id,plan,total,held) values($1,$2,'[250,150,100]',500,0)",[old,source]);
 const awards=JSON.stringify([{teamId:team,amount:250}]);
 await db.query('select u6_settle_session_prizes($1,$2::jsonb,$3,false)',[old,awards,owner]);
 await db.query('select u6_settle_prizes_before_contracts($1,$2::jsonb,$3,false)',[old,awards,owner]);
 await db.query('select u6_settle_session_prizes($1,$2::jsonb,$3,null)',[old,awards,owner]);
 await db.query('select u6_settle_prizes_before_contracts($1,$2::jsonb,$3,true)',[old,awards,owner]);
 const share=(await db.query('select contract_session_prize_settle($1) value',[old])).rows[0].value;
 assert.equal(share.reason,'before_prize_launch');assert.equal(share.ready,true);
 assert.equal((await db.query('select count(*)::int n from coin_accounts where team_id=$1',[team])).rows[0].n,0,'no prize wallet is created for old results');
 const fund=randomUUID();await db.query("insert into personal_award_funds(id,event_id,session_id,account_id,plan,total,held) values($1,$2,$3,$4,'{\"mvp\":20,\"maxKills\":10}',30,0)",[fund,event,old,source]);
 const paid=(await db.query('select personal_award_settle($1,true) value',[fund])).rows[0].value;assert.equal(paid.paid,0);assert.equal(paid.reason,'before_prize_launch');
 assert.deepEqual(await account(),{balance:2000,reserved:0});assert.equal(await demo(),demoBefore);
 // Same allocation is payable at the exact Moscow date boundary and later.
 await db.query('select u6_reserve_session_prizes($1)',[boundary]);assert.deepEqual(await account(),{balance:2000,reserved:500});
 await db.query('select u6_settle_session_prizes($1,$2::jsonb,$3,false)',[boundary,awards,owner]);
 assert.equal((await db.query('select balance::int from coin_accounts where team_id=$1',[team])).rows[0].balance,250);assert.deepEqual(await account(),{balance:1750,reserved:250});
 await db.query('select u6_settle_session_prizes($1,$2::jsonb,$3,false)',[boundary,awards,owner]);assert.deepEqual(await account(),{balance:1750,reserved:250},'duplicate settlement still cannot pay twice');
 await db.query('select u6_settle_session_prizes($1,$2::jsonb,$3,true)',[boundary,'[]',owner]);assert.deepEqual(await account(),{balance:2000,reserved:0},'ordinary cancellation and reversal remain operational');
 await db.query('select u6_reserve_session_prizes($1)',[later]);assert.deepEqual(await account(),{balance:2000,reserved:500});
 assert.equal((await db.query('select u7_personal_prizes_payable($1,null) allowed',[event])).rows[0].allowed,false,'whole-event awards use its first noncancelled session');
 assert.equal((await db.query('select u7_personal_prizes_payable($1,$2) allowed',[event,boundary])).rows[0].allowed,true,'recurring training uses its own session, not the age of the parent event');
 for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query("select has_function_privilege($1,'public.u7_session_prizes_payable(uuid)','EXECUTE') allowed",[role])).rows[0].allowed,false);
 assert.equal(await demo(),demoBefore);console.log('PASS: prize launch Moscow boundary, old reserves/payments/explicit base bypass blocked, new payouts/retries/cancellation intact, recurring sessions and demo isolation');
}
