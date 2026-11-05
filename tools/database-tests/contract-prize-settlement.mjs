import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {defaultTerms} from '../../src/modules/contracts/model.ts';

export async function verifyContractPrizeSettlement(db,id){
 const owner=id(17000),team=id(17001),event=id(17002),players=[id(17010),id(17011),id(17012)],contracts=[id(17020),id(17021),id(17022)];
 const day=86400000,now=Math.floor(Date.now()/1000)*1000,iso=t=>new Date(t).toISOString();
 for(const user of [owner,...players]){await db.query('insert into auth.users(id) values($1)',[user]);await db.query('insert into profiles(id,nickname) values($1,$2)',[user,'Prize share '+user.slice(-4)]);}
 await db.query("insert into user_roles(user_id,role) values($1,'superadmin')",[owner]);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
 await db.query("insert into teams(id,name,type,leader_id,verified) values($1,'Prize-sharing organization','team',$2,true)",[team,owner]);
 await db.query("insert into events(id,title,type,organizer_user_id,is_published,moderation_status,min_players,prize_plan) values($1,'Funded contract training','training',$2,true,'approved',1,'[250,150,100]')",[event,owner]);
 for(let i=0;i<3;i++){
  await db.query("insert into team_members(team_id,user_id,role_in_team) values($1,$2,'main')",[team,players[i]]);
  const terms=defaultTerms(new Date(now-10*day));if(i===1)terms.participation={mode:'proportional'};if(i===2)terms.trainingShareBps=7000;
  await db.query("insert into organization_contracts(id,organization_id,player_id,kind,created_by) values($1,$2,$3,'main',$4)",[contracts[i],team,players[i],owner]);
  await db.query("insert into organization_contract_versions(contract_id,revision,terms,created_by,status) values($1,1,$2::jsonb,$3,'offered')",[contracts[i],JSON.stringify(terms),owner]);
  const signed=now-(i===2?2:10)*day;
  await db.query('insert into contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at) values($1,1,$2,$3,1,$4,$4)',[contracts[i],owner,players[i],iso(signed)]);
 }
 const wallet=async(actor,action,input)=>(await db.query('select u6_coin_action($1,$2,$3,$4::jsonb) value',[actor,randomUUID(),action,JSON.stringify(input)])).rows[0].value;
 await wallet(owner,'adjust',{kind:'player',ownerId:owner,amount:2000,reason:'Prize reserve funding'});
 const makeSession=async(n,start)=>{
  const session=id(n),group=id(n+1),registration=id(n+2),games=[id(n+3),id(n+4),id(n+5)];
  await db.query("insert into event_sessions(id,event_id,start_time,end_time) values($1,$2,now()+interval '1 day',now()+interval '1 day 1 hour')",[session,event]);
  await db.query("insert into event_groups(id,session_id,public_number,display_order,name,capacity) values($1,$2,1,1,'Main',12)",[group,session]);
  for(let i=0;i<3;i++)await db.query("insert into event_games(id,event_id,session_id,group_id,game_number,public_number,map_name) values($1,$2,$3,$4,$5,$5,'bermuda')",[games[i],event,session,group,i+1]);
  await db.query('insert into event_registrations(id,event_id,session_id,team_id,group_id,roster_json) values($1,$2,$3,$4,$5,$6::jsonb)',[registration,event,session,team,group,JSON.stringify(players)]);
  await db.query('select u6_reserve_session_prizes($1)',[session]);
  await db.query('update event_sessions set start_time=$2,end_time=$3 where id=$1',[session,iso(start),iso(start+3600000)]);
  const doc=({complete=true,absent=false,all=false,place=1}={})=>{
   const rows=games.map((game,index)=>{
    const stats=players.map((player,i)=>({id:player,userId:player,nickname:'Prize player',played:i===0?!absent:i!==1||index===0||all,kills:i===0&&absent||i===1&&index>0&&!all?0:1,deaths:0,assists:0}));
    return{registrationId:registration,gameId:game,groupId:group,teamId:team,userId:null,name:'Prize org',played:true,reason:'no_show',detail:complete?'players':'team',place,kills:stats.reduce((n,p)=>n+p.kills,0),points:10,fieldSize:3,rounds:null,players:complete?stats:[]};
   });
   return{rules:{mode:'training',criterion:'points',ratingEnabled:false},mvps:[],rows,standings:[{registrationId:registration,teamId:team,userId:null,groupId:group,name:'Prize org',place,kills:rows.reduce((n,r)=>n+r.kills,0),points:30,placeSum:place*3,wins:place===1?3:0,gamesPlayed:3,bonus:0,manual:false}]};
  };
  let revision=0;
  const publish=async(document=doc())=>{
   const config=(await db.query('select configuration_revision from event_sessions where id=$1',[session])).rows[0].configuration_revision;
   const result=(await db.query('select u2_save_results($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb) value',[owner,session,revision,config,randomUUID(),JSON.stringify(document),JSON.stringify({rows:document.rows,warnings:[],manualOrder:[],snapshots:[]}),JSON.stringify(document)])).rows[0].value;
   revision=result.revision;
  };
  return{session,doc,publish};
 };
 const first=await makeSession(17030,now-5*day);
 const org=async()=>(await db.query('select balance::int,reserved::int from coin_accounts where team_id=$1',[team])).rows[0];
 const balance=async(i)=>Number((await db.query('select coalesce((select balance from coin_accounts where user_id=$1),0) value',[players[i]])).rows[0].value);
 const entries=async()=>(await db.query('select count(*)::int n from coin_entries')).rows[0].n;
 await first.publish(first.doc({complete:false}));
 assert.deepEqual(await org(),{balance:250,reserved:250},'uncertain prize shares remain earmarked in the organization account');
 assert.equal(await balance(0),0);await assert.rejects(()=>wallet(owner,'transfer',{teamId:team,userId:owner,amount:1}),/Недостаточно/);
 const missingGuestStats=first.doc();missingGuestStats.rows[0].players.pop();
 await first.publish(missingGuestStats);assert.deepEqual(await org(),{balance:250,reserved:250},'missing statistics of an unsigned participant also hold distribution');
 const beforeFailure=await entries();
 await db.exec(`create function test_prize_share_failure() returns trigger language plpgsql as $$begin if new.kind='prize' then raise exception 'TEST_PRIZE_SHARE_FAILURE';end if;return new;end $$;
 create trigger test_prize_share_failure before insert on contract_obligations for each row execute function test_prize_share_failure();`);
 try{await assert.rejects(()=>first.publish(),/TEST_PRIZE_SHARE_FAILURE/);}finally{await db.exec('drop trigger test_prize_share_failure on contract_obligations;drop function test_prize_share_failure();');}
 assert.equal(await entries(),beforeFailure);assert.deepEqual(await org(),{balance:250,reserved:250},'failed payout restores earmarked funds and the old result');
 await first.publish();assert.deepEqual(await org(),{balance:184,reserved:0});assert.deepEqual(await Promise.all(players.map((_,i)=>balance(i))),[50,16,0]);
 const repeat=await entries();await first.publish();assert.equal(await entries(),repeat,'same publication cannot pay twice');
 const obligations=(await db.query("select o.* from contract_prize_charges c join contract_obligations o on o.id=c.obligation_id where c.session_id=$1 and o.cancelled_at is null order by o.contract_id",[first.session])).rows;
 assert.deepEqual(obligations.map(o=>Number(o.amount)),[50,16]);
 assert.equal((await db.query('select count(*)::int n from contract_session_terms where session_id=$1 and contract_id=$2',[first.session,contracts[2]])).rows[0].n,0,'post-start signing cannot take historical prizes');
 const withdrawal=await wallet(players[0],'withdraw_request',{fullNameLatin:'Test Player',transferCountry:'Россия',amount:50,note:'Protect all prize coins'});
 await first.publish(first.doc({absent:true}));assert.equal(await balance(0),50);assert.equal((await org()).balance,184);
 assert.equal((await db.query('select contract_player_debt_summary($1) value',[players[0]])).rows[0].value.total,50);
 await db.query('select contract_obligation_cancel($1,$2,$3,$4)',[owner,randomUUID(),obligations[1].id,'Owner cancels player prize share']);
 await first.publish(first.doc({absent:true}));assert.equal(await balance(1),0,'an owner-waived prize share is not recreated');
 await wallet(players[0],'withdraw_cancel',{withdrawalId:withdrawal.operationId});
 assert.equal(await balance(0),0);assert.equal((await org()).balance,250,'released reserve repays the remaining return claim');
 await first.publish(first.doc({absent:true,place:3}));assert.deepEqual(await org(),{balance:100,reserved:0},'podium correction changes the actual source award');
 await db.query("update event_sessions set status='cancelled' where id=$1",[first.session]);assert.deepEqual(await org(),{balance:0,reserved:0});
 const excessive=await makeSession(17050,now-day),priorEntries=await entries();
 await assert.rejects(()=>excessive.publish(excessive.doc({all:true})),/CONTRACT_TOTAL_SHARE/);
 assert.equal(await entries(),priorEntries);assert.equal((await db.query('select count(*)::int n from competition_publications where session_id=$1',[excessive.session])).rows[0].n,0,'oversubscription rolls back publication and every money movement');
 const ledger=(await db.query("select sum(e.amount)::bigint total from coin_entries e join coin_operations o on o.id=e.operation_id where o.action in('contract_payment','contract_return','prize_payout','prize_reversal') and (e.account_id in(select id from coin_accounts where user_id=any($1::uuid[]) or team_id=$2))",[[owner,...players],team])).rows[0];
 assert.equal(Number(ledger.total),0,'prize distribution and all corrections conserve actual coins');
 await db.exec('set role service_role');try{await assert.rejects(()=>db.query('select contract_session_prize_plan($1,$2)',[first.session,team]),/permission denied/);}finally{await db.exec('reset role');}
 console.log('PASS: funded contractual prize shares, proportional rounding, unsigned exclusion, incomplete-statistics reserve, atomic failure, idempotency, protected player funds, owner cancellation, corrected podium, cancellation and conservation');
}
