import assert from 'node:assert/strict';
export async function verifyLifecycle(db,id,base){
 async function create(n){
  const config=structuredClone(base);config.organizerUserId=id(2);config.cost=0;
  config.sessions=[{...config.sessions[0],id:id(n),groups:[{id:id(n+1),name:'Lifecycle',capacity:12,games:[{id:id(n+2),map:'bermuda'}]}]}];
  return (await db.query(`select public.u2_event_configuration($1,null,0,$2::jsonb) value`,[id(1),JSON.stringify(config)])).rows[0].value.eventId;
 }
 const event=await create(2100);
 const historyBefore=(await db.query(`select status,roster_snapshot from public.event_registrations where session_id=$1 order by id`,[id(700)])).rows;
 const sanction=(await db.query(`select public.u2_apply_sanction('player',$1,null,array['events'],'Lifecycle test',$2) id`,[id(2),id(1)])).rows[0].id;
 assert.ok((await db.query(`select frozen_at from public.events where id=$1`,[event])).rows[0].frozen_at);
 assert.deepEqual((await db.query(`select status,roster_snapshot from public.event_registrations where session_id=$1 order by id`,[id(700)])).rows,historyBefore,'Sanctions do not mutate published future lineups');
 const act=async(actor,action,target)=>db.query(`select public.u2_event_lifecycle($1,$2,(select configuration_revision from public.events where id=$2),$3,$4,'Test decision')`,[id(actor),event,action,target?id(target):null]);
 await assert.rejects(()=>act(2,'transfer',3),/администратора/);
 await act(1,'transfer',3);
 assert.equal((await db.query(`select frozen_at from public.events where id=$1`,[event])).rows[0].frozen_at,null);
 await db.query(`select public.u2_lift_sanction($1,$2)`,[id(1),sanction]);
 await assert.rejects(()=>act(1,'transfer',2),/Обратную передачу/);
 await act(3,'transfer',2);
 const cancelled=await create(2110);
 await db.query(`insert into public.event_registrations(event_id,session_id,team_id,roster_json) values($1,$2,$3,'[]')`,[cancelled,id(2110),id(111)]);
 await db.query(`insert into public.betting_markets(id,event_id,game_id,mode) values($1,$2,$3,'tournament')`,[id(2120),cancelled,id(2112)]);
 await db.query(`insert into public.site_bets(id,user_id,market_id,stake,odds,potential_payout) values($1,$2,$3,10,2,20)`,[id(2121),id(2),id(2120)]);
 await db.query(`update public.site_wallets set balance=0 where user_id=$1`,[id(2)]);
 await db.query(`update public.events set frozen_at=now()-interval '2 minutes' where id=$1`,[cancelled]);
 await db.query(`update public.event_sessions set start_time=now()-interval '1 minute' where id=$1`,[id(2110)]);
 await db.query(`select public.u2_expire_moderation()`);
 assert.ok((await db.query(`select cancelled_at from public.events where id=$1`,[cancelled])).rows[0].cancelled_at);
 assert.equal((await db.query(`select status from public.event_registrations where session_id=$1`,[id(2110)])).rows[0].status,'cancelled');
 assert.equal((await db.query(`select balance from public.site_wallets where user_id=$1`,[id(2)])).rows[0].balance,10);
 await db.query(`select public.u2_expire_moderation()`);
 assert.equal((await db.query(`select balance from public.site_wallets where user_id=$1`,[id(2)])).rows[0].balance,10);
 const started=await create(2130);
 await db.query(`update public.event_sessions set start_time=now()-interval '2 hours' where id=$1`,[id(2130)]);
 await db.query(`update public.events set frozen_at=now()-interval '1 hour' where id=$1`,[started]);
 await db.query(`select public.u2_expire_moderation()`);
 assert.equal((await db.query(`select cancelled_at from public.events where id=$1`,[started])).rows[0].cancelled_at,null);
 console.log('PASS: organizer freeze, administrator replacement, consent on return, preserved publications, automatic cancellation/refund exactly once and started-event freeze');
}
