import assert from 'node:assert/strict';
import {evaluateTournamentCompletion} from '../../src/modules/contracts/tournament-completion.ts';

export async function verifyContractTournamentCompletion(db,id){
 const owner=id(13000),event=id(13001),qualifier=id(13002),final=id(13003),cancelled=id(13004),single=id(13005),singleSession=id(13006);
 await db.query('insert into auth.users(id) values($1)',[owner]);await db.query("insert into profiles(id,nickname) values($1,'Tournament completion owner')",[owner]);
 for(const e of[event,single])await db.query("insert into events(id,title,type,organizer_user_id) values($1,'Whole tournament','tournament',$2)",[e,owner]);
 const sessions=[{id:qualifier,stage:'qualification',startsAt:'2026-10-01T16:00:00Z',endsAt:'2026-10-01T17:00:00Z',cancelled:false,published:true},
  {id:final,stage:'final',startsAt:'2026-10-02T16:00:00Z',endsAt:'2026-10-02T17:00:00Z',cancelled:false,published:false},
  {id:cancelled,stage:'semifinal',startsAt:'2026-10-01T18:00:00Z',endsAt:'2026-10-01T19:00:00Z',cancelled:true,published:false}];
 const input={id:event,type:'tournament',cancelled:false,finalSessionId:null,sessions};
 const publish=async(s)=>db.query("insert into competition_publications(session_id,revision,first_published_at,published,updated_by) values($1,1,now(),$2::jsonb,$3)",[s,JSON.stringify({rules:{mode:'tournament'},rows:[],standings:[],mvps:[]}),owner]);
 for(const s of sessions){await db.query('insert into event_sessions(id,event_id,start_time,end_time,stage,status) values($1,$2,$3,$4,$5,$6)',[s.id,event,s.startsAt,s.endsAt,s.stage,s.cancelled?'cancelled':'scheduled']);if(s.published)await publish(s.id);}
 const completion=async(e=event)=>(await db.query('select contract_tournament_completion($1) value',[e])).rows[0].value;
 assert.deepEqual(await completion(),evaluateTournamentCompletion(input));
 await publish(final);sessions[1].published=true;
 const completed=await completion(),preview=evaluateTournamentCompletion(input);
 for(const key of['ready','cancelled','eventId','finalSessionId','sessionIds'])assert.deepEqual(completed[key],preview[key]);
 assert.equal(Date.parse(completed.endsAt),Date.parse(preview.endsAt));
 await db.query('update events set final_session_id=$2 where id=$1',[event,cancelled]);input.finalSessionId=cancelled;
 assert.deepEqual(await completion(),evaluateTournamentCompletion(input));
 await db.query('update events set final_session_id=$2 where id=$1',[event,final]);input.finalSessionId=final;
 await db.query("update event_sessions set end_time=clock_timestamp()+interval '1 day' where id=$1",[final]);
 sessions[1].endsAt=new Date(Date.now()+86400000).toISOString();assert.deepEqual(await completion(),evaluateTournamentCompletion(input));
 await db.query('update event_sessions set end_time=$2 where id=$1',[final,'2026-10-02T17:00:00Z']);sessions[1].endsAt='2026-10-02T17:00:00Z';
 await db.query("update events set cancelled_at=now() where id=$1",[event]);input.cancelled=true;
 assert.deepEqual(await completion(),evaluateTournamentCompletion(input));
 await db.query("insert into event_sessions(id,event_id,start_time,end_time) values($1,$2,'2026-10-03T16:00:00Z','2026-10-03T17:00:00Z')",[singleSession,single]);
 await publish(singleSession);assert.equal((await completion(single)).ready,true);assert.equal((await completion(single)).finalSessionId,singleSession);
 await db.exec('set role service_role');try{await assert.rejects(()=>completion(),/permission denied/);}finally{await db.exec('reset role');}
 console.log('PASS: whole-tournament completion, unpublished final hold, cancelled stage exclusion, explicit final validation, future deadline and SQL/TS parity');
}
