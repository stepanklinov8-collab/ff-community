import assert from 'node:assert/strict';
export async function verifyBetting(db,id,base){
 const config=structuredClone(base);config.type='solo';config.rules={...config.rules,mode:'solo',criterion:'kills',nominations:['kills']};config.minPlayers=1;config.allowIndividualRegistration=true;
 config.sessions=[{...config.sessions[0],id:id(2300),groups:[{id:id(2301),name:'Solo',capacity:60,games:[{id:id(2302),map:'bermuda'}]}]},
 {...config.sessions[0],id:id(2303),startTime:new Date(Date.now()-86400000).toISOString(),endTime:new Date(Date.now()-82800000).toISOString(),groups:[{id:id(2304),name:'Past',capacity:60,games:[{id:id(2305),map:'bermuda'}]}]}];
 const event=(await db.query(`select public.u2_event_configuration($1,null,0,$2::jsonb) value`,[id(1),JSON.stringify(config)])).rows[0].value.eventId;
 await db.query(`insert into public.event_registrations(id,event_id,session_id,participant_user_id,roster_json) values($1,$2,$3,$4,'[]'),($5,$2,$3,$6,'[]')`,[id(2306),event,id(2300),id(2),id(2307),id(3)]);
 await db.query(`insert into public.betting_sources(id,event_id,enabled) values($1,$2,true)`,[id(2308),event]);
 await db.query(`insert into public.site_wallets(user_id,balance) values($1,100) on conflict(user_id) do update set balance=100`,[id(1)]);
 let request=2400;
 const quote=async(target=2,place='1',user=1)=>{
  const q=id(++request);await db.query(`insert into public.betting_quotes(id,user_id,source_id,event_id,game_id,subject_user_id,subject_team_name,mode,market_type,selection_value,raw_odds,offered_odds,locks_at,expires_at)
  values($1,$2,$3,$4,$5,$6,'Solo','solo','exact_place',$7,2,2,now()+interval '1 day',now()+interval '1 minute')`,[q,id(user),id(2308),event,id(2302),id(target),place]);return q;
 };
 const place=q=>db.query(`select public.place_dynamic_site_bet_for($1,$2,10) id`,[id(1),q]);
 const q1=await quote(),bet1=(await place(q1)).rows[0].id;
 assert.equal((await place(q1)).rows[0].id,bet1);
 assert.equal((await db.query(`select balance from public.site_wallets where user_id=$1`,[id(1)])).rows[0].balance,90);
 const own=await quote(2,'1',2);await assert.rejects(()=>db.query(`select public.place_dynamic_site_bet_for($1,$2,10)`,[id(2),own]),/own organization/);
 const stale=await quote(3);await db.query(`update public.events set frozen_at=now() where id=$1`,[event]);await assert.rejects(()=>place(stale),/Market is closed/);
 await db.query(`update public.events set frozen_at=null where id=$1`,[event]);
 await db.query(`update public.site_wallets set balance=-30 where user_id=$1`,[id(1)]);await assert.rejects(()=>place(stale),/Insufficient balance/);
 await db.query(`update public.site_wallets set balance=90 where user_id=$1`,[id(1)]);
 const bet2=(await place(stale)).rows[0].id,bet3=(await place(await quote(2,'2'))).rows[0].id;
 const document={rules:config.rules,mvps:[],rows:[2,3].map((user,i)=>({registrationId:id(2306+i),gameId:id(2302),groupId:id(2301),userId:id(user),teamId:null,name:'Solo',played:true,reason:'no_show',detail:'players',place:null,kills:5,points:5,rounds:null,fieldSize:2,players:[{id:id(user),userId:id(user),nickname:'Solo',played:true,kills:5,deaths:null,assists:null}]})),
 standings:[2,3].map((user,i)=>({registrationId:id(2306+i),groupId:id(2301),userId:id(user),teamId:null,name:'Solo',played:true,place:1,kills:5,points:5,wins:0,gamesPlayed:1,bonus:0}))};
 await db.query(`select public.u2_save_results($1,$2,0,(select configuration_revision from public.event_sessions where id=$2),$3,'tie-bets',$4::jsonb,$5::jsonb)`,[id(1),id(2300),id(++request),JSON.stringify({rows:document.rows,warnings:[],manualOrder:[]}),JSON.stringify(document)]);
 const payout=async(bet)=>(await db.query(`select payout from public.site_bets where id=$1`,[bet])).rows[0].payout;
 assert.equal(await payout(bet1),20);assert.equal(await payout(bet2),20);assert.equal(await payout(bet3),0);
 await assert.rejects(()=>quote().then(place),/Market is closed/);
 assert.equal((await db.query(`select odds,stake from public.site_bets where id=$1`,[bet1])).rows[0].stake,10);
 const rounds={rows:[{gameId:id(2500),teamId:id(110),played:true,rounds:7,place:1,kills:8},{gameId:id(2500),teamId:id(111),played:true,rounds:2,place:2,kills:2}],standings:[]};
 const outcome=async(game,selection)=>(await db.query(`select public.u2_round_market_outcome($1::jsonb,$2,$3,'exact_score',$4,null) value`,[JSON.stringify(rounds),id(110),game,selection])).rows[0].value;
 assert.equal(await outcome(null,'7:2'),'won');assert.equal(await outcome(id(2500),'7:2'),'won');assert.equal(await outcome(id(2501),'7:2'),'void');assert.equal(await outcome(null,'1:0'),'lost');
 const warning={id:id(2600),targetType:'team',targetId:id(110),reason:'No show test',penalty:5,duration:'week',source:'no_show',category:'event'};
 await db.query(`select public.u2_write_warning($1,$2,$3::jsonb)`,[id(1),id(101),JSON.stringify(warning)]);
 await db.query(`select public.u2_cancel_warning($1,$2,'Admin cancellation')`,[id(1),warning.id]);
 const normalized=(await db.query(`select public.u2_normalize_warning_ids($1::jsonb,$2) value`,[JSON.stringify({warnings:[{...warning,id:id(2601)}]}),id(101)])).rows[0].value;
 assert.equal(normalized.warnings[0].id,warning.id);
 await db.query(`select public.u2_write_warning($1,$2,$3::jsonb)`,[id(1),id(101),JSON.stringify(normalized.warnings[0])]);
 assert.ok((await db.query(`select cancelled_at from public.warnings where id=$1`,[warning.id])).rows[0].cancelled_at);
 console.log('PASS: per-game solo quotes, later session after earlier archive, self-bet/freeze/negative balance guards, idempotent stake, tied first-place payouts, unused game refund, legacy KV round score and no-show cancellation identity');
}
