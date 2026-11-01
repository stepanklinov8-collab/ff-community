import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {defaultTerms} from '../../src/modules/contracts/model.ts';

export async function verifyContractTournamentPayments(db,id){
 const owner=id(15000),team=id(15001),event=id(15002),players=Array.from({length:5},(_,i)=>id(15010+i)),contracts=players.map((_,i)=>id(15020+i));
 const day=86400000,cutoff=Math.floor(Date.now()/1000)*1000-5*day,iso=t=>new Date(t).toISOString();
 for(const user of[owner,...players]){await db.query('insert into auth.users(id) values($1)',[user]);await db.query('insert into profiles(id,nickname) values($1,$2)',[user,'Tournament pay '+user.slice(-4)]);}
 await db.query("insert into user_roles(user_id,role) values($1,'superadmin')",[owner]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
 await db.query("insert into teams(id,name,type,leader_id,verified) values($1,'Tournament paying org','team',$2,true)",[team,owner]);
 for(const player of players)await db.query("insert into team_members(team_id,user_id,role_in_team) values($1,$2,'main')",[team,player]);
 await db.query("insert into events(id,title,type,organizer_user_id,is_published,moderation_status,min_players) values($1,'Two-stage tournament fees','tournament',$2,true,'approved',1)",[event,owner]);
 const terms=[];
 for(let i=0;i<players.length;i++){
  const t=defaultTerms(new Date(cutoff-day));t.financial.rates.perTournament=120;
  if(i===3)t.participation={mode:'proportional'};if(i===4)t.participation={mode:'minimum',games:3};terms.push(t);
  await db.query("insert into organization_contracts(id,organization_id,player_id,kind,created_by) values($1,$2,$3,'main',$4)",[contracts[i],team,players[i],owner]);
  await db.query("insert into organization_contract_versions(contract_id,revision,terms,created_by,status,offered_at) values($1,1,$2::jsonb,$3,'offered',now())",[contracts[i],JSON.stringify(t),owner]);
  const effective=i===2?cutoff+day/2:cutoff-day;
  await db.query('insert into contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at,ended_at) values($1,1,$2,$3,1,$4,$4,$5)',[contracts[i],owner,players[i],iso(effective),i===1?iso(cutoff+day/2):null]);
 }
 const changed=structuredClone(terms[1]);changed.startsAt=iso(cutoff+day/2);changed.financial.rates.perTournament=999;
 await db.query("insert into organization_contract_versions(contract_id,revision,terms,created_by,status,offered_at) values($1,2,$2::jsonb,$3,'offered',now())",[contracts[1],JSON.stringify(changed),owner]);
 await db.query('insert into contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at) values($1,2,$2,$3,1,$4,$4)',[contracts[1],owner,players[1],changed.startsAt]);
 await db.query('update organization_contracts set current_revision=2 where id=$1',[contracts[1]]);
 const makeSession=async(n,stage,eventId=event)=>{
  const session=id(n),group=id(n+1),game=id(n+2),registration=id(n+3);
  await db.query("insert into event_sessions(id,event_id,start_time,end_time,stage) values($1,$2,now()+interval '1 day',now()+interval '1 day 1 hour',$3)",[session,eventId,stage]);
  await db.query("insert into event_groups(id,session_id,public_number,display_order,name,capacity) values($1,$2,1,1,'Main',12)",[group,session]);
  await db.query("insert into event_games(id,event_id,session_id,group_id,game_number,public_number,map_name) values($1,$2,$3,$4,1,1,'bermuda')",[game,eventId,session,group]);
  await db.query('insert into event_registrations(id,event_id,session_id,team_id,group_id,roster_json) values($1,$2,$3,$4,$5,$6::jsonb)',[registration,eventId,session,team,group,JSON.stringify(players)]);
  let revision=0;
  const doc=played=>({rules:{mode:'tournament',criterion:'points',ratingEnabled:false},mvps:[],rows:[{registrationId:registration,gameId:game,groupId:group,teamId:team,userId:null,name:'Tournament org',played:true,reason:'no_show',detail:'players',place:1,kills:played.length,points:10,fieldSize:2,rounds:null,players:players.map(player=>({id:player,userId:player,nickname:'Tournament player',played:played.includes(player),kills:played.includes(player)?1:0,deaths:0,assists:0}))}],standings:[{registrationId:registration,teamId:team,userId:null,groupId:group,name:'Tournament org',place:1,kills:played.length,points:10,placeSum:1,wins:1,gamesPlayed:1,bonus:0,manual:false}]});
  const publish=async(document,key=randomUUID(),expected=revision)=>{
   const config=(await db.query('select configuration_revision from event_sessions where id=$1',[session])).rows[0].configuration_revision;
   const result=(await db.query('select u2_save_results($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb) value',[owner,session,expected,config,key,JSON.stringify(document),JSON.stringify({rows:document.rows,warnings:[],manualOrder:[],snapshots:[]}),JSON.stringify(document)])).rows[0].value;
   revision=result.revision;return result;
  };
  return{session,doc,publish};
 };
 const qualifier=await makeSession(15030,'qualification'),final=await makeSession(15040,'final');
 await db.query('update events set final_session_id=$2 where id=$1',[event,final.session]);
 await db.query('update event_sessions set start_time=$2,end_time=$3 where id=$1',[qualifier.session,iso(cutoff),iso(cutoff+3600000)]);
 await db.query('update event_sessions set start_time=$2,end_time=$3 where id=$1',[final.session,iso(cutoff+day),iso(cutoff+day+3600000)]);
 const wallet=async(actor,action,input,key=randomUUID())=>(await db.query('select u6_coin_action($1,$2,$3,$4::jsonb) value',[actor,key,action,JSON.stringify(input)])).rows[0].value;
 await wallet(owner,'adjust',{kind:'organization',ownerId:team,amount:1000,reason:'Fund tournament fees'});
 const balance=async(player)=>(await db.query('select coalesce((select balance::int from coin_accounts where user_id=$1),0) value',[player])).rows[0].value;
 await qualifier.publish(qualifier.doc(players));assert.deepEqual(await Promise.all(players.map(balance)),[0,0,0,0,0],'qualifying stage is not a whole-tournament payment');
 const anchor=(await db.query('select revision,conditions from contract_tournament_terms where event_id=$1 and contract_id=$2',[event,contracts[1]])).rows[0];
 assert.equal(anchor.revision,1);assert.equal(anchor.conditions.perTournament,120,'a renewal between stages cannot replace the pre-tournament rate');
 assert.equal((await db.query('select count(*)::int n from contract_tournament_terms where event_id=$1 and contract_id=$2',[event,contracts[2]])).rows[0].n,0,'a contract signed after tournament start cannot obtain a backdated tournament fee');
 const finalDoc=final.doc([players[1],players[2],players[4]]),key=randomUUID();
 const oldEntries=(await db.query('select count(*)::int n from coin_entries')).rows[0].n;
 await db.exec(`create function test_tournament_fee_failure() returns trigger language plpgsql as $$begin if new.source_key like 'tournament:%' then raise exception 'TEST_TOURNAMENT_FEE_FAILURE';end if;return new;end $$;
 create trigger test_tournament_fee_failure before insert on contract_obligations for each row execute function test_tournament_fee_failure();`);
 try{await assert.rejects(()=>final.publish(finalDoc,key),/TEST_TOURNAMENT_FEE_FAILURE/);}finally{await db.exec('drop trigger test_tournament_fee_failure on contract_obligations;drop function test_tournament_fee_failure();');}
 assert.equal((await db.query('select count(*)::int n from competition_publications where session_id=$1',[final.session])).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from coin_entries')).rows[0].n,oldEntries);
 await final.publish(finalDoc,key);assert.deepEqual(await Promise.all(players.map(balance)),[120,120,0,60,0],'eliminated player qualifies, original terms survive renewal, proportional and minimum rules apply');
 const beforeRepeat=(await db.query('select count(*)::int n from coin_entries')).rows[0].n;
 await final.publish(finalDoc,key,0);await final.publish(finalDoc);await db.query('select contract_maintenance_run()');
 assert.equal((await db.query('select count(*)::int n from coin_entries')).rows[0].n,beforeRepeat,'publication retries and the scheduler cannot pay twice');
 const withdrawal=await wallet(players[0],'withdraw_request',{amount:100,note:'Protected tournament prize reserve'});
 await wallet(players[0],'transfer',{userId:owner,amount:20});
 const correction=qualifier.doc(players.slice(1));await qualifier.publish(correction);
 assert.equal((await db.query('select contract_player_debt_summary($1) value',[players[0]])).rows[0].value.total,120);
 assert.equal(await balance(players[0]),100,'correction cannot seize the protected withdrawal');
 const bFee=(await db.query("select o.id from contract_tournament_charges c join contract_obligations o on o.id=c.obligation_id where c.event_id=$1 and c.contract_id=$2 and o.cancelled_at is null",[event,contracts[1]])).rows[0].id;
 await db.query('select contract_obligation_cancel($1,$2,$3,$4)',[owner,randomUUID(),bFee,'Owner cancels tournament fee']);
 await final.publish(finalDoc);assert.equal(await balance(players[1]),0,'owner cancellation is not automatically revived');
 await qualifier.publish(qualifier.doc(players));assert.equal((await db.query('select contract_player_debt_summary($1) value',[players[0]])).rows[0].value.total,0);
 assert.equal(await balance(players[0]),100);await wallet(players[0],'withdraw_cancel',{withdrawalId:withdrawal.operationId});
 const secondEvent=id(15060);await db.query("insert into events(id,title,type,organizer_user_id,is_published,moderation_status,min_players) values($1,'Unfunded whole tournament','tournament',$2,true,'approved',1)",[secondEvent,owner]);
 const secondQualifier=await makeSession(15070,'qualification',secondEvent),secondFinal=await makeSession(15080,'final',secondEvent);
 await db.query('update events set final_session_id=$2 where id=$1',[secondEvent,secondFinal.session]);
 for(const[s,offset]of[[secondQualifier,2],[secondFinal,3]])await db.query('update event_sessions set start_time=$2,end_time=$3 where id=$1',[s.session,iso(cutoff+offset*day),iso(cutoff+offset*day+3600000)]);
 const orgBalance=(await db.query('select balance::int from coin_accounts where team_id=$1',[team])).rows[0].balance;
 await wallet(owner,'adjust',{kind:'organization',ownerId:team,amount:-orgBalance,reason:'Test fee debt without funds'});
 await secondQualifier.publish(secondQualifier.doc([players[3]]));await secondFinal.publish(secondFinal.doc([players[3]]));
 const latest=async()=>(await db.query('select o.id,o.amount::int,o.paid::int,o.held::int,o.due_at from contract_tournament_charges c join contract_obligations o on o.id=c.obligation_id where c.event_id=$1 and c.contract_id=$2 and o.cancelled_at is null',[secondEvent,contracts[3]])).rows[0];
 assert.equal((await latest()).amount,120);assert.equal((await latest()).paid,0);
 const originalDue=Date.parse((await latest()).due_at);
 await wallet(owner,'adjust',{kind:'organization',ownerId:team,amount:200,reason:'Later funds require manual old debt payment'});
 await secondFinal.publish(secondFinal.doc([players[3]]));await db.query('select contract_maintenance_run()');assert.equal((await latest()).paid,0);
 await secondQualifier.publish(secondQualifier.doc([]));const reduced=await latest();assert.equal(reduced.amount,60);assert.equal(reduced.paid,0);assert.equal(reduced.held,0);assert.equal(Date.parse(reduced.due_at),originalDue);
 await db.query('select contract_debt_pay($1,$2,$3,60)',[owner,randomUUID(),reduced.id]);
 assert.equal((await latest()).paid,60);assert.equal(await balance(players[3]),120);
 await db.query('update events set cancelled_at=now() where id=$1',[secondEvent]);assert.equal(await balance(players[3]),60,'tournament cancellation reverses its own fee once');
 const earlyEvent=id(15090);await db.query("insert into events(id,title,type,organizer_user_id,is_published,moderation_status,min_players) values($1,'Early published tournament','tournament',$2,true,'approved',1)",[earlyEvent,owner]);
 const early=await makeSession(15100,'ordinary',earlyEvent);await early.publish(early.doc([players[0]]));
 const earlyCutoff=(await db.query('select f.cutoff_at,cp.first_published_at from contract_tournament_frames f join event_sessions s on s.event_id=f.event_id join competition_publications cp on cp.session_id=s.id where f.event_id=$1',[earlyEvent])).rows[0];
 assert.equal(Date.parse(earlyCutoff.cutoff_at),Date.parse(earlyCutoff.first_published_at),'early result publication freezes the event before any later signature');
 assert.equal((await db.query('select contract_tournament_accrual_plan($1,$2) value',[earlyEvent,contracts[0]])).rows[0].value.reason,'sessions_not_finished');
 await assert.rejects(()=>db.query('update contract_tournament_terms set conditions=$3::jsonb where event_id=$1 and contract_id=$2',[event,contracts[0],JSON.stringify({perTournament:999})]),/CONTRACT_IMMUTABLE/);
 await db.exec('set role service_role');try{await assert.rejects(()=>db.query('select contract_tournament_settle($1,$2)',[event,contracts[0]]),/permission denied/);}finally{await db.exec('reset role');}
 console.log('PASS: pre-tournament fixed fee, qualifying elimination, original rate across renewal, post-start exclusion, proportional/minimum participation, atomic publication rollback, correction debt and owner cancellation');
}
