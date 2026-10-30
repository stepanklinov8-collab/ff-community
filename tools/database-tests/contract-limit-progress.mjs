import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {defaultTerms} from '../../src/modules/contracts/model.ts';
import {evaluateSessionLimit} from '../../src/modules/contracts/participation-limits.ts';

export async function verifyContractLimitProgress(db,id){
 const owner=id(11000),team=id(11001),training=id(11002),tournament=id(11003);
 const players=[id(11004),id(11005),id(11006)],contracts=[id(11007),id(11008),id(11009)];
 for(const user of [owner,...players]){await db.query('insert into auth.users(id) values($1)',[user]);await db.query('insert into profiles(id,nickname) values($1,$2)',[user,'Limit '+user.slice(-4)]);}
 await db.query("insert into teams(id,name,type,leader_id) values($1,'Limit organization','team',$2)",[team,owner]);
 for(const [event,type] of [[training,'training'],[tournament,'tournament']])await db.query('insert into events(id,title,type,organizer_user_id) values($1,$2,$3,$4)',[event,'Limit '+type,type,owner]);
 const policies=[{unit:'sessions',count:2,completion:'contract'},{unit:'games',count:4,completion:'event_payments'},{unit:'trainings',count:2,completion:'contract'}];
 const termsByContract=[];
 for(let i=0;i<players.length;i++){
  const terms=defaultTerms(new Date('2026-10-01T00:00:00Z'));terms.endsAt='2026-10-10T00:00:00Z';terms.limit=policies[i];termsByContract.push(terms);
  await db.query('select contract_validate_terms($1::jsonb)',[JSON.stringify(terms)]);
  await db.query("insert into organization_contracts(id,organization_id,player_id,kind,created_by) values($1,$2,$3,'main',$4)",[contracts[i],team,players[i],owner]);
  for(const revision of [1,2]){
   const version=structuredClone(terms);if(revision===2){version.startsAt='2026-10-10T00:00:00Z';version.endsAt=null;}
   await db.query("insert into organization_contract_versions(contract_id,revision,terms,created_by,status,offered_at) values($1,$2,$3::jsonb,$4,'offered',now())",[contracts[i],revision,JSON.stringify(version),owner]);
   await db.query('insert into contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at,ended_at) values($1,$2,$3,$4,1,$5,$6,$7)',[contracts[i],revision,owner,players[i],revision===1?'2026-09-30T00:00:00Z':'2026-10-09T00:00:00Z',version.startsAt,version.endsAt]);
  }
 }
 const sessions=[];
 const make=async(n,day,revision,played,published=true,type='training')=>{
  const session=id(n),group=id(n+1),registration=id(n+2),games=[id(n+3),id(n+4),id(n+5)],event=type==='training'?training:tournament;
  const startsAt=`2026-10-${String(day).padStart(2,'0')}T16:00:00Z`,endsAt=`2026-10-${String(day).padStart(2,'0')}T17:00:00Z`;
  await db.query('insert into event_sessions(id,event_id,start_time,end_time) values($1,$2,$3,$4)',[session,event,startsAt,endsAt]);
  const gameRows=games.map((g,i)=>({id:g,groupId:group,map:'bermuda',number:i+1}));
  await db.query('insert into contract_session_frames(session_id,event_id,event_type,cutoff_at,ends_at,games,registrations) values($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)',[session,event,type,startsAt,endsAt,JSON.stringify(gameRows),JSON.stringify([{id:registration,organizationId:team,groupId:group,roster:players}])]);
  for(let i=0;i<contracts.length;i++){
   const terms=structuredClone(termsByContract[i]);if(revision===2){terms.startsAt='2026-10-10T00:00:00Z';terms.endsAt=null;}
   const conditions=(await db.query('select contract_event_conditions($1::jsonb,$2) value',[JSON.stringify(terms),event])).rows[0].value;
   await db.query("insert into contract_session_terms(session_id,contract_id,revision,organization_id,player_id,kind,terms,conditions) values($1,$2,$3,$4,$5,'main',$6::jsonb,$7::jsonb)",[session,contracts[i],revision,team,players[i],JSON.stringify(terms),JSON.stringify(conditions)]);
  }
  const document={rules:{mode:type,criterion:'points',ratingEnabled:false},standings:[],mvps:[],rows:games.map(game=>({registrationId:registration,gameId:game,groupId:group,teamId:team,played:played>0,detail:'players',reason:'no_show',kills:played>0?players.length:0,players:played>0?players.map(player=>({id:player,userId:player,played:true,kills:1})):[]}))};
  const publish=()=>db.query('insert into competition_publications(session_id,revision,first_published_at,published,updated_by) values($1,1,now(),$2::jsonb,$3)',[session,JSON.stringify(document),owner]);
  if(published)await publish();
  const fact={sessionId:session,startsAt,endsAt,eventType:type,playedGames:published?played:null,cancelled:false};sessions.push({fact,revision});
  return{publish,session};
 };
 await make(11020,1,1,3,true,'tournament');await make(11030,2,1,0);await make(11040,3,1,3);
 const pending=await make(11050,4,1,3,false);await make(11060,5,1,3);await make(11070,11,2,3);
 const progress=async(i,revision=1)=>(await db.query('select contract_limit_progress($1,$2) value',[contracts[i],revision])).rows[0].value;
 for(let i=0;i<contracts.length;i++){
  const sql=await progress(i),preview=evaluateSessionLimit(policies[i],sessions.filter(row=>row.revision===1).map(row=>row.fact));
  for(const key of ['ready','unit','maximum','used','remaining','sessions'])assert.deepEqual(sql[key],preview[key],`${policies[i].unit} SQL/TS ${key}`);
  assert.equal(sql.reachedAt?Date.parse(sql.reachedAt):null,preview.reachedAt?Date.parse(preview.reachedAt):null);
 }
 assert.equal((await progress(2)).ready,false,'unpublished earlier training holds later training allocation');
 assert.equal((await progress(0)).ready,true,'an already reached limit does not depend on later unpublished sessions');
 await pending.publish();sessions.find(row=>row.fact.sessionId===pending.session).fact.playedGames=3;
 assert.equal((await progress(2)).ready,true);assert.equal((await progress(2)).used,2);
 assert.equal((await progress(0,2)).used,1,'renewal has its own revision counter');
 assert.equal((await progress(0,2)).remaining,1);
 const tournamentTerms=structuredClone(termsByContract[0]);tournamentTerms.startsAt='2026-11-01T00:00:00Z';tournamentTerms.endsAt=null;tournamentTerms.limit={unit:'tournaments',count:1,completion:'contract'};
 await db.query("insert into organization_contract_versions(contract_id,revision,terms,created_by,status,offered_at) values($1,3,$2::jsonb,$3,'offered',now())",[contracts[0],JSON.stringify(tournamentTerms),owner]);
 await db.query('update organization_contracts set current_revision=3 where id=$1',[contracts[0]]);
 const acceptance={action:'accept',requestId:randomUUID(),contractId:contracts[0],revision:3};
 await assert.rejects(()=>db.query('select contract_mutate($1,$2::jsonb)',[owner,JSON.stringify(acceptance)]),/CONTRACT_FORBIDDEN/);
 await assert.rejects(()=>db.query('select contract_mutate($1,$2::jsonb)',[players[0],JSON.stringify(acceptance)]),/CONTRACT_LIMIT_EXECUTION_PENDING/);
 assert.equal((await db.query('select count(*)::int n from contract_financial_starts where contract_id=$1',[contracts[0]])).rows[0].n,0,'previewing a limited agreement cannot start incomplete payroll');
 await db.exec('set role service_role');
 try{await assert.rejects(()=>progress(0),/permission denied/);}finally{await db.exec('reset role');}
 for(const limit of [{unit:'sessions',count:1,completion:'invalid'},{unit:'sessions',count:1,extra:'text'},{unit:'sessions',count:0}]){
  await assert.rejects(()=>db.query('select contract_validate_terms($1::jsonb)',[JSON.stringify({...termsByContract[0],limit})]),/CONTRACT_/);
 }
 console.log('PASS: session/game/training counters, no-show exclusion, complete last session, pending prior results, revision reset, SQL/TS parity and private preview');
}
