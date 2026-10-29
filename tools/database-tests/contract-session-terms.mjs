import assert from 'node:assert/strict';
import {defaultTerms} from '../../src/modules/contracts/model.ts';
import {resolveEventConditions} from '../../src/modules/contracts/financial-terms.ts';

export async function verifyContractSessionTerms(db,id){
 const owner=id(9610),player=id(9611),team=id(9620),guild=id(9621),event=id(9622),otherEvent=id(9623),session=id(9624),group=id(9625);
 for(const user of [owner,player]){await db.query('insert into auth.users(id) values($1)',[user]);await db.query('insert into profiles(id,nickname) values($1,$2)',[user,`Session terms ${user.slice(-4)}`]);}
 for(const org of [team,guild])await db.query('insert into teams(id,name,leader_id) values($1,$2,$3)',[org,`Terms org ${org.slice(-4)}`,owner]);
 for(const e of [event,otherEvent])await db.query("insert into events(id,title,type,organizer_user_id) values($1,'Terms event','training',$2)",[e,owner]);
 const day=86400000,cutoff=Date.now()-day,iso=t=>new Date(t).toISOString();
 const makeSession=async(s,start)=>db.query("insert into event_sessions(id,event_id,start_time,end_time) values($1,$2,$3,$4)",[s,event,iso(start),iso(start+3600000)]);
 await makeSession(session,Date.now()+day);
 await db.query("insert into event_groups(id,session_id,public_number,display_order,name,capacity) values($1,$2,1,1,'Main',12)",[group,session]);
 await db.query("insert into event_games(id,event_id,session_id,group_id,game_number,public_number,map_name) values($1,$2,$3,$4,1,1,'bermuda'),($5,$2,$3,$4,2,2,'solara')",[id(9626),event,session,group,id(9627)]);
 await db.query('insert into event_registrations(id,event_id,session_id,group_id,team_id,roster_json) values($1,$2,$3,$4,$5,$6::jsonb)',[id(9628),event,session,group,team,JSON.stringify([player])]);
 await db.query('update event_sessions set start_time=$2,end_time=$3 where id=$1',[session,iso(cutoff),iso(cutoff+3600000)]);
 let n=9630;
 const create=async(org=team,kind='main',eventId=null)=>{
  const c=id(n++);await db.query('insert into organization_contracts(id,organization_id,player_id,kind,event_id,created_by) values($1,$2,$3,$4,$5,$6)',[c,org,player,kind,eventId,owner]);return c;
 };
 const terms=defaultTerms(new Date(cutoff-5*day));
 terms.financial.rates={perGame:20,perSession:100,perTournament:300,perKill:5,perMvp:50};
 terms.financial.eventOverrides=[{eventId:event,values:{trainingShareBps:3000,perKill:0}},{eventId:otherEvent,values:{perMvp:999}}];
 const version=async(c,rev,t=terms)=>db.query('insert into organization_contract_versions(contract_id,revision,terms,created_by) values($1,$2,$3::jsonb,$4)',[c,rev,JSON.stringify(t),owner]);
 const sign=async(c,rev,signed=cutoff-day,effective=signed,end=null)=>db.query('insert into contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at,ended_at) values($1,$2,$3,$4,1,$5,$6,$7)',[c,rev,owner,player,iso(signed),iso(effective),end===null?null:iso(end)]);
 const freeze=async(s=session)=>db.query('select contract_session_freeze($1)',[s]);
 const rows=async(s=session)=>(await db.query('select contract_id,revision,organization_id,conditions from contract_session_terms where session_id=$1 order by contract_id',[s])).rows;
 const main=await create();await version(main,1);await sign(main,1);
 const mainGuild=await create(guild);await version(mainGuild,1);await sign(mainGuild,1);
 const late=await create();await version(late,1);await sign(late,1,cutoff+1000);
 const future=await create();await version(future,1);await sign(future,1,cutoff-day,cutoff+day);
 const expired=await create();await version(expired,1);await sign(expired,1,cutoff-day,cutoff-day,cutoff);
 const unrelated=await create(team,'guest',otherEvent);await version(unrelated,1);await sign(unrelated,1);
 const unsigned=await create();await version(unsigned,1);
 const minimum=await create(),minimumTerms=structuredClone(terms);minimumTerms.participation={mode:'minimum',games:2};minimumTerms.financial.eventOverrides=[];
 minimumTerms.financial.noShowPenalty={kind:'combined',amount:350,basisPoints:1000,selection:'maximum'};
 await version(minimum,1,minimumTerms);await sign(minimum,1);
 const proportional=await create(),proportionalTerms=structuredClone(minimumTerms);proportionalTerms.participation={mode:'proportional'};
 await version(proportional,1,proportionalTerms);await sign(proportional,1);
 const changed=structuredClone(terms);changed.financial.rates.perGame=999;
 await version(main,2,changed);await sign(main,2,cutoff-1000,cutoff+day);
 await version(main,3,changed);await db.query('update organization_contracts set current_revision=3 where id=$1',[main]);
 // Cancelling a different override event must not invalidate stored conditions.
 await db.query('update events set cancelled_at=now() where id=$1',[otherEvent]);
 const expected=resolveEventConditions(terms,event);
 assert.deepEqual((await db.query('select contract_event_conditions($1::jsonb,$2) value',[JSON.stringify(terms),event])).rows[0].value,expected);
 await freeze();const frozen=await rows();
 assert.deepEqual(frozen.map(r=>r.contract_id),[main,mainGuild,minimum,proportional]);
 assert.equal(frozen[0].revision,1);assert.deepEqual(frozen[0].conditions,expected);
 assert.equal(frozen[0].conditions.trainingShareBps,3000);assert.equal(frozen[0].conditions.perKill,0);
 const frame=(await db.query('select * from contract_session_frames where session_id=$1',[session])).rows[0];
 assert.equal(frame.games.length,2);assert.equal(frame.registrations.length,1);
 assert.equal(new Date(frame.cutoff_at).getTime(),cutoff);
 await db.query('update event_sessions set start_time=$2 where id=$1',[session,iso(Date.now()+day)]);
 await freeze();assert.deepEqual(await rows(),frozen,'repeat or later rescheduling cannot replace frozen terms with current drafts');
 await assert.rejects(()=>db.query("update contract_session_terms set conditions='{}' where session_id=$1",[session]),/CONTRACT_IMMUTABLE/);
 await assert.rejects(()=>db.query('delete from contract_session_frames where session_id=$1',[session]),/CONTRACT_IMMUTABLE/);
 await assert.rejects(()=>db.query("update contract_agreements set end_reason='changed later' where contract_id=$1 and revision=1",[main]),/CONTRACT_IMMUTABLE/);
 await assert.rejects(()=>db.query('update contract_agreements set ended_at=$2 where contract_id=$1 and revision=1',[main,iso(cutoff-1000)]),/CONTRACT_BACKDATED_END/);
 const notStarted=id(9670);await makeSession(notStarted,Date.now()+day);
 await assert.rejects(()=>freeze(notStarted),/CONTRACT_SESSION_NOT_STARTED/);
 const empty=id(9671);await makeSession(empty,cutoff-10*day);await freeze(empty);assert.deepEqual(await rows(empty),[]);
 const early=id(9675);await makeSession(early,Date.now()+day);
 await db.query("insert into competition_publications(session_id,revision,first_published_at,published,updated_by) values($1,1,$2,$3::jsonb,$4)",[early,iso(cutoff),JSON.stringify({rules:{mode:'training',criterion:'points',ratingEnabled:false},rows:[],standings:[],mvps:[]}),owner]);
 await freeze(early);
 assert.equal(new Date((await db.query('select cutoff_at from contract_session_frames where session_id=$1',[early])).rows[0].cutoff_at).getTime(),cutoff,'early publication sets the earlier cutoff');
 // Invalid overlapping signed revisions cause an atomic failure, not selection
 // of whichever row happens to be returned first.
 const ambiguous=id(9672);await makeSession(ambiguous,Date.now()+day);
 await db.query("insert into event_groups(id,session_id,public_number,display_order,name,capacity) values($1,$2,1,1,'Main',12)",[id(9674),ambiguous]);
 await db.query('insert into event_registrations(id,event_id,session_id,team_id,group_id,roster_json) values($1,$2,$3,$4,$5,$6::jsonb)',[id(9673),event,ambiguous,team,id(9674),JSON.stringify([player])]);
 await db.query('update event_sessions set start_time=$2,end_time=$3 where id=$1',[ambiguous,iso(cutoff+100),iso(cutoff+3600000)]);
 await version(mainGuild,2);await sign(mainGuild,2);
 await assert.rejects(()=>freeze(ambiguous),/CONTRACT_AMBIGUOUS_VERSION/);
 assert.equal((await db.query('select count(*)::int n from contract_session_frames where session_id=$1',[ambiguous])).rows[0].n,0);
 const plan=async(c=main)=>(await db.query('select contract_session_accrual_plan($1,$2) value',[session,c])).rows[0].value;
 assert.equal((await plan()).reason,'unpublished');
 const document={rules:{mode:'training',criterion:'points',ratingEnabled:false},mvps:[player],standings:[],rows:[0,1].map((i)=>({
  registrationId:id(9628),gameId:id(9626+i),groupId:group,teamId:team,userId:null,name:'Terms org',played:true,place:1,kills:i===0?2:0,points:10,fieldSize:2,rounds:null,detail:'players',reason:'no_show',
  players:[{id:player,userId:player,nickname:'Same nickname',played:i===0,kills:i===0?2:0,deaths:0,assists:0}]
 }))};
 const publish=async(doc)=>db.query('insert into competition_publications(session_id,revision,first_published_at,published,updated_by) values($1,1,now(),$2::jsonb,$3) on conflict(session_id) do update set published=excluded.published,revision=competition_publications.revision+1',[session,JSON.stringify(doc),owner]);
 await publish(document);
 const mainPlan=await plan();assert.equal(mainPlan.ready,true);assert.equal(mainPlan.playedGames,1);assert.equal(mainPlan.totalGames,2);
 assert.equal(mainPlan.entries.reduce((sum,r)=>sum+r.amount,0),170,'zero kill-rate override replaces base rate; full session fee for any participation');
 assert.deepEqual(await plan(),mainPlan,'recalculation cannot mint or repeat payments');
 const minPlan=await plan(minimum);assert.equal(minPlan.participationFailed,true);assert.deepEqual(minPlan.entries,[],'minimum failure removes ALL session payments, including game, kills and MVP');
 const fine=async(c=minimum)=>(await db.query('select contract_session_no_show_assessment($1,$2,2501) value',[session,c])).rows[0].value;
 assert.equal((await fine()).applies,false,'partial participation is not a no-show, even if below the contractual minimum');
 const propPlan=await plan(proportional);assert.equal(propPlan.entries.reduce((sum,r)=>sum+r.amount,0),130,'actual game + kills + half session fee + earned MVP');
 assert.equal((await plan(mainGuild)).eligible,false,'other main organization terms do not create an appearance for that organization');
 let modified=structuredClone(document);modified.rows[1].players[0].played=true;modified.rows[1].players[0].kills=3;modified.rows[1].kills=3;
 await publish(modified);
 const completed=await plan(minimum);assert.equal(completed.participationFailed,false);
 assert.equal(completed.entries.reduce((sum,r)=>sum+r.amount,0),215,'per-tournament fee is NOT paid again for a session');
 assert.equal(new Set(completed.entries.map(r=>r.kind+':'+r.source)).size,completed.entries.length);
 modified=structuredClone(document);modified.rows[0].players[0].kills=null;await publish(modified);assert.equal((await plan()).reason,'incomplete_player_statistics');
 modified=structuredClone(document);modified.rows[0].detail='team';await publish(modified);assert.equal((await plan()).ready,false);
 modified=structuredClone(document);modified.rows.pop();await publish(modified);assert.equal((await plan()).reason,'incomplete_games');
 modified=structuredClone(document);modified.rows.push(structuredClone(modified.rows[0]));await publish(modified);await assert.rejects(()=>plan(),/CONTRACT_RESULT_AMBIGUOUS/);
 modified=structuredClone(document);modified.rows[0].players[0].userId=null;await publish(modified);assert.deepEqual((await plan()).entries,[],'a guest with the same nickname is not this registered player');
 assert.equal((await fine()).amount,350,'a declared absent account is assessed independently of a same-nickname guest');
 assert.equal((await fine(main)).amount,0,'no clause means no fine');
 modified=structuredClone(document);modified.rows.forEach(r=>{r.played=false;r.reason='technical';});await publish(modified);
 assert.equal((await fine()).applies,false,'technical interruption is not proof of failing to attend');
 await db.query('select contract_validate_terms($1::jsonb)',[JSON.stringify({...minimumTerms,financial:{...minimumTerms.financial,eventOverrides:[]}})]);
 for(const rule of [{kind:'fixed',amount:-1},{kind:'combined',amount:1,basisPoints:100},{kind:'none',note:'arbitrary'}])
  await assert.rejects(()=>db.query('select contract_validate_no_show_penalty($1::jsonb)',[JSON.stringify(rule)]),/CONTRACT_INPUT/);
 assert.equal((await db.query('select contract_no_show_amount($1::jsonb,2501)::int amount',[JSON.stringify({...minimumTerms.financial.noShowPenalty,selection:'minimum'})])).rows[0].amount,250);
 await assert.rejects(()=>db.query("select contract_accrual_line('kill','test',1000000000001)"),/CONTRACT_ACCRUAL_AMOUNT/);
 await db.query('update events set cancelled_at=now() where id=$1',[event]);assert.equal((await plan()).cancelled,true);
 await db.exec('set role service_role');
 try{
  await assert.rejects(()=>freeze(),/permission denied/);
  await assert.rejects(()=>db.query('select * from contract_session_terms'),/permission denied/);
  await assert.rejects(()=>sign(unsigned,1),/permission denied/);
  await assert.rejects(()=>plan(),/permission denied/);
  await assert.rejects(()=>fine(),/permission denied/);
 }finally{await db.exec('reset role');}
 console.log('PASS: immutable session contract terms, signed/effective cutoff, main team + guild history, scoped guest events, unsigned/late exclusion, explicit zero overrides, SQL/TS parity, empty freeze and atomic overlap rejection');
 console.log('PASS: confirmed session accrual plans, all-or-nothing minimum participation, proportional session fees, actual kills/MVP, incomplete-statistics hold, duplicate rejection, nickname isolation and no repeated tournament fee');
}
