import assert from 'node:assert/strict';
import {utilityPrice,bonusPrice,prizePrice} from '../../src/lib/economy/valuation.ts';

export async function verifyEconomyValues(db,id,base){
 const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
 const close=(a,b,message)=>assert.ok(Math.abs(Number(a)-b)<Math.max(.000001,Math.abs(b)*1e-12),`${message}: ${a} vs ${b}`);
 for(const level of [0,.25,1,2,3,4,10.5,100,300,498.9,499,500,999]){
  close(await scalar('select u5_utility_price($1)',[level]),utilityPrice(level),'SQL/TS utility agreement');
  close(await scalar('select u5_bonus_price($1)',[level]),bonusPrice(level),'SQL/TS bonus agreement');
 }
 close(await scalar('select u5_utility_price(300)'),45000000,'Agreed curve midpoint');
 close(await scalar('select u5_utility_price(999)+u5_bonus_price(499)'),100000000,'Player rating price maximum');
 close(await scalar('select u5_utility_price(999,700000000)+u5_bonus_price(499,300000000)'),1000000000,'Organization rating price maximum');
 close(await scalar('select u5_bonus_price(.5)'),50,'Fraction below first level');
 close(await scalar('select u5_prize_price(10000)'),prizePrice(10000),'Prize curve');
 const team=id(98001),opponent=id(98002),session=id(98003),group=id(98004),reg=id(98005),otherReg=id(98006);
 const users=[98010,98011,98012,98013,98014].map(id);
 await db.query("insert into teams(id,name) values($1,'Economy'),($2,'Economy rival')",[team,opponent]);
 assert.equal(Number(await scalar('select main_rating from teams where id=$1',[team])),0,'New organization starts at zero');
 for(const [i,user] of users.entries()){
  await db.query('insert into auth.users(id) values($1)',[user]);
  await db.query('insert into profiles(id,nickname) values($1,$2)',[user,`Economy ${i}`]);
  await db.query("insert into competition_ratings(target_type,target_id,mode,exact_rating,display_rating) values('player',$1,'main',100,100)",[user]);
  await db.query('insert into team_members(team_id,user_id) values($1,$2)',[team,user]);
 }
 close(await scalar('select base from u5_organization_components($1)',[team]),100,'Only best four, fifth does not dilute');
 const memberCost=Number(await scalar('select sum(u5_player_value_exact(user_id)) from team_members where team_id=$1',[team]));
 close(memberCost,5*utilityPrice(100),'All five members contribute to price');
 const config=structuredClone(base);config.type='training';config.minPlayers=1;config.rules={...base.rules,mode:'training',mvpEnabled:false};
 const startTime=new Date(Date.now()+86400000).toISOString();
 config.sessions=[{...base.sessions[0],id:session,startTime,endTime:new Date(Date.parse(startTime)+3600000).toISOString(),groups:[{id:group,name:'Economy',capacity:12,games:Array.from({length:10},(_,i)=>({id:id(98030+i),map:'bermuda'}))}]}];
 const event=(await scalar('select u2_event_configuration($1,null,0,$2::jsonb)',[id(1),JSON.stringify(config)])).eventId;
 await db.query("insert into event_registrations(id,event_id,session_id,group_id,team_id,roster_json) values($1,$2,$3,$4,$5,$6::jsonb),($7,$2,$3,$4,$8,'[]')",[reg,event,session,group,team,JSON.stringify(users.slice(0,3)),otherReg,opponent]);
 const guest=id(98020);
 const rows=config.sessions[0].groups[0].games.flatMap(g=>[
  {registrationId:reg,gameId:g.id,groupId:group,teamId:team,userId:null,name:'Economy',played:true,place:1,kills:10,points:23,detail:'players',fieldSize:2,players:[...users.slice(0,3),guest].map((uid,i)=>({id:uid,userId:i===3?null:uid,nickname:`P${i}`,played:true,kills:[5,3,0,2][i],deaths:0,assists:0}))},
  {registrationId:otherReg,gameId:g.id,groupId:group,teamId:opponent,userId:null,name:'Rival',played:true,place:2,kills:0,points:1,detail:'players',fieldSize:2,players:[{id:id(98021),userId:null,nickname:'Other guest',played:true,kills:0,deaths:0,assists:0}]}
 ]);
 const doc={rules:config.rules,rows,standings:[{registrationId:reg,teamId:team,groupId:group,place:1,gamesPlayed:10},{registrationId:otherReg,teamId:opponent,groupId:group,place:2,gamesPlayed:10}],mvps:[],prizes:[{registrationId:reg,amount:250}]};
 // Publish through the real mutation path: prize corrections must refresh ratings as well as prices.
 let operation=98100;
 const publish=async document=>db.query('select u2_save_results($1,$2,coalesce((select revision from competition_publications where session_id=$2),0),(select configuration_revision from event_sessions where id=$2),$3,$4,$5::jsonb,$6::jsonb)',[id(1),session,id(operation++),`economy-${operation}`,JSON.stringify({rows:document.rows,warnings:[],manualOrder:[],prizes:document.prizes}),JSON.stringify(document)]);
 const wallets=await scalar('select coalesce(jsonb_agg(to_jsonb(w) order by user_id),\'[]\') from site_wallets w');
 await publish(doc);
 assert.equal(await scalar('select u4_complete_rating_session($1)',[session]),true);
 for(const [i,expected] of [125,75,0].entries())close(await scalar('select u5_player_prizes($1)',[users[i]]),expected,'Guest keeps own 20% of prize');
 close(await scalar('select prizes from u5_organization_components($1)',[team]),250,'Organization gets full confirmed prize');
 const before=await scalar('select recalculate_organization_rating($1)',[team]);await publish(doc);
 close(await scalar('select exact_rating from competition_ratings where target_type=\'team\' and target_id=$1 and mode=\'main\'',[team]),Number(before),'Idempotent publication');
 const changed=structuredClone(doc);changed.prizes[0].amount=1000;await publish(changed);
 close(await scalar('select prizes from u5_organization_components($1)',[team]),1000,'Correction replaces rather than adds prize');
 const computed=Number(await scalar('select base+bonus from u5_organization_components($1)',[team]));
 close(await scalar("select exact_rating from competition_ratings where target_type='team' and target_id=$1 and mode='main'",[team]),Math.min(999,computed),'Stored rating refreshed by prize correction');
 const zero=structuredClone(doc);zero.rows.forEach(r=>{r.kills=0;r.players.forEach(p=>p.kills=0);});await publish(zero);
 for(const user of users.slice(0,3))close(await scalar('select u5_player_prizes($1)',[user]),62.5,'Zero team kills divides equally including guest');
 await db.query('update rating_event_settings set hidden_coefficient=1.2 where event_id=$1',[event]);
 close(await scalar('select u5_player_prizes($1)',[users[0]]),75,'Current event weight revalues all earned shares');
 const incomplete=structuredClone(doc);incomplete.rows[0].detail='team';incomplete.rows[0].players=[];await publish(incomplete);
 close(await scalar('select u5_player_prizes($1)',[users[0]]),0,'Incomplete session defers all personal allocation');
 close(await scalar('select prizes from u5_organization_components($1)',[team]),250,'Confirmed team prize remains');
 await publish(doc);
 await db.query("update event_sessions set status='cancelled' where id=$1",[session]);
 close(await scalar('select u5_player_prizes($1)',[users[0]]),0,'Cancelled session does not retain earned value');
 close(await scalar('select prizes from u5_organization_components($1)',[team]),0,'Cancelled team prize removed');
 assert.deepEqual(await scalar('select coalesce(jsonb_agg(to_jsonb(w) order by user_id),\'[]\') from site_wallets w'),wallets,'Valuation never transfers wallet funds');
 await db.query("update events set type='tournament' where id=$1",[event]);
 await db.query("update event_sessions set status='completed',stage='qualification' where id=$1",[session]);
 assert.equal(await scalar('select u5_session_prizes_allowed($1)',[session]),false,'Multi-stage prize allocation deferred');
 for(const uid of users)await db.query("update competition_ratings set exact_rating=999,display_rating=999 where target_type='player' and target_id=$1 and mode='main'",[uid]);
 close(await scalar('select recalculate_organization_rating($1)',[team]),999,'Four max players guarantee max organization');
 assert.equal(await scalar("select has_function_privilege('authenticated','u5_player_prizes(uuid)','execute')"),false);
 console.log('PASS: valuation curves, fractional levels, all roster members, guest and zero-kill prize shares, weights, correction refresh, incomplete/cancelled sessions, wallet preservation and maximum organization');
}
