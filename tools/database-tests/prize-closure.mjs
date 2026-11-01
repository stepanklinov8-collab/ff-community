import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function verifyPrizeClosure(db,id){
 const owner=id(19900),player=id(19901),admin=id(19902),team=id(19903),event=id(19904),session=id(19905),group=id(19906),game=id(19907),reg=id(19908);
 for(const user of [owner,player,admin]){await db.query('insert into auth.users(id) values($1)',[user]);await db.query('insert into profiles(id,nickname) values($1,$2)',[user,'Closure '+user.slice(-4)]);}
 await db.query("insert into user_roles(user_id,role) values($1,'superadmin'),($2,'admin')",[owner,admin]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
 await db.query("insert into teams(id,name,type,leader_id,verified) values($1,'Closure organization','team',$2,true)",[team,owner]);
 await db.query("insert into events(id,title,type,organizer_user_id,is_published,moderation_status,min_players,prize_plan,personal_prizes) values($1,'Fund closure training','training',$2,true,'approved',1,'[250,150,100]','{\"mvp\":20,\"maxKills\":0}')",[event,owner]);
 await db.query("insert into event_sessions(id,event_id,start_time,end_time) values($1,$2,now()+interval '1 day',now()+interval '1 day 1 hour')",[session,event]);
 await db.query("insert into event_groups(id,session_id,public_number,display_order,name,capacity) values($1,$2,1,1,'Main',12)",[group,session]);
 await db.query("insert into event_games(id,event_id,session_id,group_id,game_number,public_number,map_name) values($1,$2,$3,$4,1,1,'bermuda')",[game,event,session,group]);
 await db.query('insert into event_registrations(id,event_id,session_id,team_id,group_id,roster_json) values($1,$2,$3,$4,$5,$6::jsonb)',[reg,event,session,team,group,JSON.stringify([player])]);
 await db.query("insert into teams(id,name,type,leader_id,verified) values($1,'Other closure organization','team',$2,true)",[id(19909),owner]);
 await db.query('insert into event_registrations(id,event_id,session_id,team_id,group_id,roster_json) values($1,$2,$3,$4,$5,$6::jsonb)',[id(19911),event,session,id(19909),group,JSON.stringify([admin])]);
 const wallet=async(action,input)=>(await db.query('select u6_coin_action($1,$2,$3,$4::jsonb) value',[owner,randomUUID(),action,JSON.stringify(input)])).rows[0].value;
 const source=async()=>(await db.query('select balance::int,reserved::int from coin_accounts where user_id=$1',[owner])).rows[0];
 const target=async()=>Number((await db.query('select coalesce((select balance from coin_accounts where team_id=$1),0) n',[team])).rows[0].n);
 await wallet('adjust',{kind:'player',ownerId:owner,amount:1000,reason:'Fund closure source'});
 await db.query('select u6_reserve_session_prizes($1)',[session]);await db.query('select personal_award_reserve($1,$2)',[event,session]);
 assert.deepEqual(await source(),{balance:1000,reserved:520});
 await db.query("update event_sessions set start_time=now()-interval '2 day',end_time=now()-interval '1 day' where id=$1",[session]);
 let revision=0;
 const publish=async(place,second=false)=>{
  const row={registrationId:reg,gameId:game,groupId:group,teamId:team,userId:null,name:'Closure organization',played:true,detail:'players',reason:'no_show',place,kills:1,points:10,fieldSize:3,rounds:null,players:[{id:player,userId:player,nickname:'Player',played:true,kills:1,deaths:0,assists:0}]};
  const doc={rules:{mode:'training',criterion:'points',ratingEnabled:false},mvps:[player],rows:[row],standings:[{registrationId:reg,teamId:team,userId:null,groupId:group,name:'Closure organization',place,kills:1,points:10,placeSum:place,wins:place===1?1:0,gamesPlayed:1,bonus:0,manual:false}]};
  doc.rows.push({...row,registrationId:id(19911),teamId:id(19909),name:'Other organization',played:second,place:second?2:null,kills:0,players:[{id:admin,userId:admin,nickname:'Other player',played:second,kills:0,deaths:0,assists:0}]});doc.standings.push({...doc.standings[0],registrationId:id(19911),teamId:id(19909),name:'Other organization',place:2,kills:0,wins:0,gamesPlayed:second?1:0});
  const config=(await db.query('select configuration_revision from event_sessions where id=$1',[session])).rows[0].configuration_revision;
  const answer=(await db.query('select u2_save_results($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb) value',[owner,session,revision,config,randomUUID(),JSON.stringify(doc),JSON.stringify({rows:doc.rows,warnings:[],manualOrder:[],snapshots:[]}),JSON.stringify(doc)])).rows[0].value;revision=answer.revision;
 };
 const query=async(actor=owner)=>(await db.query('select podium_fund_query($1,$2) value',[actor,session])).rows[0].value;
 const action=async(kind,actor=owner,key=randomUUID(),expected=null)=>(await db.query('select podium_fund_action($1,$2,$3,$4,$5) value',[actor,key,session,kind,expected??(await query(actor)).fingerprint])).rows[0].value;
 await publish(1);assert.deepEqual(await source(),{balance:730,reserved:250});assert.equal(await target(),250);
 await assert.rejects(()=>query(player),/CONTRACT_FORBIDDEN/);
 await assert.rejects(()=>action('close'),/PERSONAL_AWARD_PENDING/,'podium cannot close before promised personal awards');
 const personal=(await db.query('select personal_award_query($1,$2,$3) value',[owner,event,session])).rows[0].value;
 await db.query("select personal_award_action($1,$2,$3,'close',$4,null,null)",[owner,randomUUID(),personal.fund.id,personal.fingerprint]);
 const closeKey=randomUUID(),closeQuote=(await query()).fingerprint;
 await action('close',owner,closeKey,closeQuote);await action('close',owner,closeKey,closeQuote);
 assert.deepEqual(await source(),{balance:730,reserved:0});assert.ok((await query()).fund.closed_at);
 await publish(2);assert.equal(await target(),250,'closed monetary podium does not change automatically');assert.equal((await query()).fund.last_error,'closed_results_changed');
 await assert.rejects(()=>action('reopen',admin),/CONTRACT_FINANCE/);
 await action('reopen');assert.equal(await target(),150);assert.deepEqual(await source(),{balance:830,reserved:100},'reversal restores only actually returned coins, not already released budget');
 await action('close');assert.deepEqual(await source(),{balance:830,reserved:0});
 await wallet('adjust',{kind:'player',ownerId:owner,amount:-830,reason:'No money available for larger corrected podium'});
 await publish(1);assert.equal((await query()).additionalReserve,100);
 await assert.rejects(()=>action('reopen'),/CONTRACT_FUNDS/);assert.ok((await query()).fund.closed_at);assert.equal(await target(),150);assert.deepEqual(await source(),{balance:0,reserved:0});
 await wallet('adjust',{kind:'player',ownerId:owner,amount:100,reason:'Explicit funding for corrected podium'});
 await action('reopen');assert.equal(await target(),250);assert.deepEqual(await source(),{balance:0,reserved:0});
 await publish(1,true);assert.equal((await query()).fund.last_error,'additional_funding_required');assert.equal((await query()).additionalReserve,150);
 assert.equal(await target(),250);assert.deepEqual(await source(),{balance:0,reserved:0},'ordinary result publication cannot replenish an already released budget');
 await assert.rejects(()=>action('close',admin),/CONTRACT_FINANCE/);await assert.rejects(()=>action('close'),/CONTRACT_FUNDS/);
 await wallet('adjust',{kind:'player',ownerId:owner,amount:150,reason:'Explicit new podium funding'});await action('close');
 assert.equal(Number((await db.query('select balance from coin_accounts where team_id=$1',[id(19909)])).rows[0].balance),150);
 await db.query("update event_sessions set status='cancelled' where id=$1",[session]);
 assert.equal(await target(),0);assert.deepEqual(await source(),{balance:420,reserved:0},'cancellation after closure reverses 400 podium + 20 personal coins and never releases missing reserves');
 await db.exec('set role authenticated');try{await assert.rejects(()=>db.query('select podium_fund_action($1,$2,$3,$4,$5)',[owner,randomUUID(),session,'close','x']),/permission denied/);}finally{await db.exec('reset role');}
 console.log('PASS: final podium closure after personal awards, unused reserve release, closed correction hold, administrative ACL, actual-fund reopening, insufficient funding rollback and cancellation after closure');
}
