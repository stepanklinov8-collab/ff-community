import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { defaultTerms } from '../../src/modules/contracts/model.ts';

export async function verifyContractRuntimeHooks(db,id) {
 const owner=id(9800),player=id(9802),team=id(9840),event=id(9841),session=id(9842),group=id(9843),game=id(9844),registration=id(9845),contract=id(9846);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
 await db.query('insert into teams(id,name,type,leader_id) values($1,$2,$3,$4)',[team,'Runtime hook team','team',owner]);
 await db.query("insert into team_members(team_id,user_id,role_in_team) values($1,$2,'main')",[team,player]);
 await db.query("insert into events(id,title,type,organizer_user_id,is_published,moderation_status) values($1,'Runtime hook training','training',$2,true,'approved')",[event,owner]);
 const start=new Date(Date.now()+60*60_000).toISOString(),end=new Date(Date.now()+2*60*60_000).toISOString();
 await db.query('insert into event_sessions(id,event_id,start_time,end_time,registration_open_time,registration_close_time) values($1,$2,$3,$4,$5,$6)',[session,event,start,end,new Date(Date.now()-86400000).toISOString(),new Date(Date.now()+30*60_000).toISOString()]);
 await db.query("insert into event_groups(id,session_id,public_number,display_order,name,capacity) values($1,$2,1,1,'Main',12)",[group,session]);
 await db.query("insert into event_games(id,event_id,session_id,group_id,game_number,public_number,map_name) values($1,$2,$3,$4,1,1,'bermuda')",[game,event,session,group]);
 await db.query('insert into event_registrations(id,event_id,session_id,team_id,group_id,roster_json) values($1,$2,$3,$4,$5,$6::jsonb)',[registration,event,session,team,group,JSON.stringify([player])]);
 const terms=defaultTerms(new Date(Date.now()-2*86400000));terms.financial.rates={perGame:10,perSession:20,perTournament:0,perKill:0,perMvp:0};
 const actorInput={action:'save',requestId:randomUUID(),contractId:contract,expectedRevision:0,organizationId:team,playerId:player,kind:'main',eventId:null,sessionId:null,terms};
 const mutate=async(actor,input)=>(await db.query('select contract_mutate($1,$2::jsonb) value',[actor,JSON.stringify(input)])).rows[0].value;
 await mutate(owner,actorInput);
 await mutate(owner,{action:'offer',requestId:randomUUID(),contractId:contract,revision:1});
 await mutate(player,{action:'accept',requestId:randomUUID(),contractId:contract,revision:1});
 const signedAt=(await db.query('select signed_at from contract_agreements where contract_id=$1 and revision=1',[contract])).rows[0].signed_at;
 await db.query("update event_sessions set start_time=$2::timestamptz+interval '1 second',end_time=$2::timestamptz+interval '1 hour' where id=$1",[session,signedAt]);
 await db.query("select u6_coin_action($1,$2,'adjust',$3::jsonb)",[owner,randomUUID(),JSON.stringify({kind:'organization',ownerId:team,amount:100,reason:'Runtime hook test'})]);
 const playerBalanceBefore=(await db.query('select balance::int from coin_accounts where user_id=$1',[player])).rows[0].balance;
 const configRevision=(await db.query('select configuration_revision from event_sessions where id=$1',[session])).rows[0].configuration_revision;
 const draft={warnings:[],manualOrder:[],snapshots:[{registrationId:registration,name:'Runtime hook team',roster:[{id:player,userId:player,nickname:'Signing player'}]}]};
 const row={registrationId:registration,gameId:game,groupId:group,teamId:team,userId:null,name:'Runtime hook team',played:true,place:1,kills:1,points:10,fieldSize:2,rounds:null,detail:'players',reason:'no_show',players:[{id:player,userId:player,nickname:'Signing player',played:true,kills:1,deaths:0,assists:0}]};
 const publication={rules:{mode:'training',criterion:'points',ratingEnabled:false},rows:[row],standings:[{registrationId:registration,teamId:team,userId:null,groupId:group,name:'Runtime hook team',place:1,kills:1,points:10,placeSum:1,wins:1,gamesPlayed:1,bonus:0,manual:false}],mvps:[]};
 const result=(await db.query('select u2_save_results($1,$2,0,$3,$4,$5,$6::jsonb,$7::jsonb) value',[owner,session,configRevision,randomUUID(),'runtime-hook-test',JSON.stringify(draft),JSON.stringify(publication)])).rows[0].value;
 assert.equal(result.published,true);
 assert.equal((await db.query('select count(*)::int n from contract_session_frames where session_id=$1',[session])).rows[0].n,1,'first confirmed publication freezes contractual inputs');
 assert.equal((await db.query('select count(*)::int n from contract_session_terms where session_id=$1 and contract_id=$2',[session,contract])).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int n from contract_session_settlement_runs where session_id=$1 and contract_id=$2',[session,contract])).rows[0].n,1,'results publication executes the confirmed accrual plan');
 assert.equal((await db.query('select balance::int from coin_accounts where user_id=$1',[player])).rows[0].balance,playerBalanceBefore+30,'published game and session fees pay exactly once');
 const lateSession=id(9847),lateGroup=id(9848),lateGame=id(9849),lateRegistration=id(9850);
 await db.query("insert into event_sessions(id,event_id,start_time,end_time,registration_open_time,registration_close_time) values($1,$2,now()+interval '1 hour',now()+interval '2 hours',now()-interval '1 day',now()+interval '30 minutes')",[lateSession,event]);
 await db.query("insert into event_groups(id,session_id,public_number,display_order,name,capacity) values($1,$2,1,1,'Late',12)",[lateGroup,lateSession]);
 await db.query("insert into event_games(id,event_id,session_id,group_id,game_number,public_number,map_name) values($1,$2,$3,$4,1,1,'bermuda')",[lateGame,event,lateSession,lateGroup]);
 await db.query("update event_sessions set start_time=now()-interval '1 second',end_time=now()+interval '1 hour' where id=$1",[lateSession]);
 await db.query('insert into event_registrations(id,event_id,session_id,team_id,group_id,roster_json) values($1,$2,$3,$4,$5,$6::jsonb)',[lateRegistration,event,lateSession,team,lateGroup,JSON.stringify([player])]);
 assert.deepEqual((await db.query('select registrations from contract_session_frames where session_id=$1',[lateSession])).rows[0].registrations,[],'first post-start roster mutation freezes the previous roster before applying the edit');
 assert.equal((await db.query("select contract_session_publish_settle($1) value",[id(999999)])).rows[0].value.ready,false);
 await db.exec('set role authenticated');
 try { await assert.rejects(()=>db.query('select contract_maintenance_run()'),/permission denied/); }
 finally { await db.exec('reset role'); }
 const maintenance=(await db.query('select contract_maintenance_run() value')).rows[0].value;
 assert.equal(typeof maintenance.frozenSessions,'number');assert.equal(typeof maintenance.processedSalaryPeriods,'number');
 await db.exec('set role service_role');
 try { await db.query('select contract_maintenance_run()'); }
 finally { await db.exec('reset role'); }
 console.log('PASS: real result publication freezes signed terms and settles once; private bounded salary/session maintenance worker');
}
