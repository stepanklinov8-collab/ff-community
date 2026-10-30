import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {defaultTerms} from '../../src/modules/contracts/model.ts';

export async function verifyContractTournamentLimits(db,id){
 const owner=id(16000),team=id(16001),players=[id(16010),id(16011),id(16012)],contracts=[id(16020),id(16021),id(16022)];
 const day=86400000,start=Math.floor(Date.now()/1000)*1000-20*day,iso=t=>new Date(t).toISOString();
 for(const user of [owner,...players]){await db.query('insert into auth.users(id) values($1)',[user]);await db.query('insert into profiles(id,nickname) values($1,$2)',[user,'Tournament cap '+user.slice(-4)]);}
 await db.query("insert into user_roles(user_id,role) values($1,'superadmin')",[owner]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
 await db.query("insert into teams(id,name,type,leader_id,verified) values($1,'Whole-tournament cap org','team',$2,true)",[team,owner]);
 const terms=[];
 for(let i=0;i<players.length;i++){
  await db.query("insert into team_members(team_id,user_id,role_in_team) values($1,$2,'main')",[team,players[i]]);
  const t=defaultTerms(new Date(start-day));t.limit={unit:'tournaments',count:1,completion:i===1?'event_payments':'contract'};
  t.financial.rates.perGame=10;t.financial.rates.perTournament=100;
  if(i===2)t.participation={mode:'minimum',games:2};
  terms.push(t);
  await db.query("insert into organization_contracts(id,organization_id,player_id,kind,created_by) values($1,$2,$3,'main',$4)",[contracts[i],team,players[i],owner]);
  await db.query("insert into organization_contract_versions(contract_id,revision,terms,created_by,status) values($1,1,$2::jsonb,$3,'offered')",[contracts[i],JSON.stringify(t),owner]);
  await db.query('insert into contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at) values($1,1,$2,$3,1,$4,$4)',[contracts[i],owner,players[i],iso(start-day)]);
 }
 await db.query("select u6_coin_action($1,$2,'adjust',$3::jsonb)",[owner,randomUUID(),JSON.stringify({kind:'organization',ownerId:team,amount:10000,reason:'Tournament cap test'})]);
 const otherTeam=id(16500);
 await db.query("insert into teams(id,name,type,leader_id,verified) values($1,'Another finalist','team',$2,true)",[otherTeam,owner]);
 const makeSession=async(n,event,stage,begins,eventType='tournament',organization=team)=>{
  const session=id(n),group=id(n+1),game=id(n+2),registration=id(n+3);
  await db.query("insert into event_sessions(id,event_id,start_time,end_time,stage) values($1,$2,now()+interval '1 day',now()+interval '1 day 1 hour',$3)",[session,event,stage]);
  await db.query("insert into event_groups(id,session_id,public_number,display_order,name,capacity) values($1,$2,1,1,'Main',12)",[group,session]);
  await db.query("insert into event_games(id,event_id,session_id,group_id,game_number,public_number,map_name) values($1,$2,$3,$4,1,1,'bermuda')",[game,event,session,group]);
  const roster=organization===team?players:[];
  await db.query('insert into event_registrations(id,event_id,session_id,team_id,group_id,roster_json) values($1,$2,$3,$4,$5,$6::jsonb)',[registration,event,session,organization,group,JSON.stringify(roster)]);
  let revision=0;
  const doc=played=>({rules:{mode:eventType,criterion:'points',ratingEnabled:false},mvps:[],rows:[{registrationId:registration,gameId:game,groupId:group,teamId:organization,userId:null,name:'Cap org',played:true,reason:'no_show',detail:'players',place:1,kills:played.length,points:10,fieldSize:2,rounds:null,players:roster.map(player=>({id:player,userId:player,nickname:'Cap player',played:played.includes(player),kills:played.includes(player)?1:0,deaths:0,assists:0}))}],standings:[{registrationId:registration,teamId:organization,userId:null,groupId:group,name:'Cap org',place:1,kills:played.length,points:10,placeSum:1,wins:1,gamesPlayed:1,bonus:0,manual:false}]});
  const publish=async(played)=>{
   const document=doc(played),config=(await db.query('select configuration_revision from event_sessions where id=$1',[session])).rows[0].configuration_revision;
   const result=(await db.query('select u2_save_results($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb) value',[owner,session,revision,config,randomUUID(),JSON.stringify(document),JSON.stringify({rows:document.rows,warnings:[],manualOrder:[],snapshots:[]}),JSON.stringify(document)])).rows[0].value;
   revision=result.revision;
  };
  return{session,begins,end:begins+3600000,publish};
 };
 const makeEvent=async(n,offset,eliminated=false)=>{
  const event=id(n);
  await db.query("insert into events(id,title,type,organizer_user_id,is_published,moderation_status,min_players) values($1,$2,'tournament',$3,true,'approved',1)",[event,'Tournament cap '+n,owner]);
  const qualifier=await makeSession(n+1,event,'qualification',start+offset*day),final=await makeSession(n+5,event,'final',start+(offset+1)*day,'tournament',eliminated?otherTeam:team);
  await db.query('update events set final_session_id=$2 where id=$1',[event,final.session]);
  for(const s of [qualifier,final])await db.query('update event_sessions set start_time=$2,end_time=$3 where id=$1',[s.session,iso(s.begins),iso(s.end)]);
  return{event,qualifier,final};
 };
 const first=await makeEvent(16100,0,true),second=await makeEvent(16200,3);
 const abandoned=await makeEvent(16400,-3);
 await db.query('update events set cancelled_at=clock_timestamp() where id=$1',[abandoned.event]);
 // No manual freeze: a real publication must discover earlier unentered
 // registered events even before the daily worker has visited them.
 const trainingEvent=id(16300);
 await db.query("insert into events(id,title,type,organizer_user_id,is_published,moderation_status,min_players) values($1,'Recurring trainings alongside tournament cap','training',$2,true,'approved',1)",[trainingEvent,owner]);
 const earlyTraining=await makeSession(16301,trainingEvent,'ordinary',start-3600000,'training'),lateTraining=await makeSession(16311,trainingEvent,'ordinary',start+7*day,'training');
 for(const s of [earlyTraining,lateTraining])await db.query('update event_sessions set start_time=$2,end_time=$3 where id=$1',[s.session,iso(s.begins),iso(s.end)]);
 const progress=async(i,rev=1)=>(await db.query('select contract_limit_progress($1,$2) value',[contracts[i],rev])).rows[0].value;
 const balance=async(i)=>Number((await db.query('select coalesce((select balance from coin_accounts where user_id=$1),0) value',[players[i]])).rows[0].value);
 const closure=async(i)=>(await db.query('select * from contract_limit_closures where contract_id=$1',[contracts[i]])).rows[0];
 await earlyTraining.publish(players);assert.equal(await balance(0),10,'training before the first tournament pays but does not consume a tournament');
 await lateTraining.publish(players);assert.equal(await balance(0),10,'another session in the same training event must obey its own date and wait');
 await second.qualifier.publish(players);await second.final.publish(players);
 assert.equal((await progress(0)).ready,false);assert.equal(await balance(0),10,'later event awaits the earlier tournament result');
 await first.qualifier.publish([players[0],players[2]]);
 assert.equal((await progress(0)).used,0,'qualifier alone does not consume a tournament');
 assert.equal(await balance(0),20,'confirmed first stages may be paid before the whole event finishes');
 assert.equal(await closure(0),undefined);
 const beforeFailure=(await db.query('select count(*)::int n from coin_entries')).rows[0].n;
 await db.exec(`create function test_tournament_cap_failure() returns trigger language plpgsql as $$begin raise exception 'TEST_TOURNAMENT_CAP_FAILURE';end $$;
 create trigger test_tournament_cap_failure before insert on contract_limit_closures for each row execute function test_tournament_cap_failure();`);
 try{await assert.rejects(()=>first.final.publish([]),/TEST_TOURNAMENT_CAP_FAILURE/);}finally{await db.exec('drop trigger test_tournament_cap_failure on contract_limit_closures;drop function test_tournament_cap_failure();');}
 assert.equal((await db.query('select count(*)::int n from coin_entries')).rows[0].n,beforeFailure);
 assert.equal((await db.query('select count(*)::int n from competition_publications where session_id=$1',[first.final.session])).rows[0].n,0);
 await first.final.publish([]);
 assert.equal((await db.query('select count(*)::int n from contract_session_terms where session_id=$1',[first.final.session])).rows[0].n,0,'eliminated organization has no terms in the final; its original anchor still closes its tournament cap');
 assert.equal((await progress(0)).used,1);assert.equal(await balance(0),120,'qualifier-only player receives one whole-tournament fee');
 const closed=await closure(0);assert.ok(closed);assert.equal(closed.session_id,first.final.session);assert.equal(Date.parse(closed.ends_at),first.final.end);
 assert.equal((await progress(1)).used,1);assert.equal(await closure(1),undefined,'event-only cap leaves the agreement alive');
 assert.equal(await balance(1),130,'first confirmed absence consumes zero; second tournament pays once');
 assert.equal(await balance(2),100,'minimum participation counts across stages, and only the second tournament qualifies');
 assert.equal((await closure(2)).session_id,second.final.session);
 const before=(await db.query('select count(*)::int n from coin_entries')).rows[0].n;
 await db.query('select contract_maintenance_run()');await second.final.publish(players);
 assert.equal((await db.query('select count(*)::int n from coin_entries')).rows[0].n,before,'worker and re-publication cannot double-pay');
 // Correct the earlier tournament: a natural closure remains irreversible,
 // but the event-payments policy can move its allocation after a correction.
 await first.qualifier.publish([players[1],players[2]]);
 assert.equal((await closure(0)).id,closed.id);assert.equal(await balance(0),10,'ended contract cannot move its remaining cap to a later tournament');
 assert.equal(await balance(1),120,'nonterminal cap moves once to corrected earlier participation and refunds later payment');
 await first.final.publish([]);assert.equal(await balance(1),120,'an eliminated player has no invented final-game payment');
 const entries=(await db.query('select count(*)::int n from coin_entries')).rows[0].n;
 await db.query('select contract_maintenance_run()');assert.equal((await db.query('select count(*)::int n from coin_entries')).rows[0].n,entries);
 assert.equal((await db.query('select count(*)::int n from contract_limit_runtime_cache')).rows[0].n,0);
 const renewal=structuredClone(terms[0]);renewal.startsAt=iso(Date.now()+day);renewal.limit.count=2;
 const mutate=async(actor,input)=>(await db.query('select contract_mutate($1,$2::jsonb) value',[actor,JSON.stringify({...input,requestId:randomUUID(),contractId:contracts[0]})])).rows[0].value;
 await mutate(owner,{action:'save',expectedRevision:1,organizationId:team,playerId:players[0],kind:'main',eventId:null,sessionId:null,terms:renewal});
 await mutate(owner,{action:'offer',revision:2});assert.equal((await mutate(players[0],{action:'accept',revision:2})).status,'signed','tournament-count contract supports real bilateral signature');
 assert.equal((await progress(0,2)).used,0);assert.equal((await progress(0,2)).remaining,2,'renewal resets the whole-tournament counter');
 await db.exec('set role service_role');
 try{
  await assert.rejects(()=>progress(0),/permission denied/);
  await assert.rejects(()=>db.query('select contract_tournament_limit_freeze_due($1)',[first.event]),/permission denied/);
 }finally{await db.exec('reset role');}
 console.log('PASS: whole-tournament caps, qualifier elimination, chronological pending results, no-show exclusion, immutable expiry, correction redistribution and private counter');
}
