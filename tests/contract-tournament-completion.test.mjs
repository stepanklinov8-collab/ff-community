import assert from 'node:assert/strict';
import test from 'node:test';
import {evaluateTournamentCompletion} from '../src/modules/contracts/tournament-completion.ts';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const session=(n,stage='ordinary',patch={})=>({id:id(n),stage,startsAt:'2026-10-01T16:00:00Z',endsAt:'2026-10-01T17:00:00Z',cancelled:false,published:true,...patch});
const event=(sessions,patch={})=>({id:id(100),type:'tournament',cancelled:false,finalSessionId:null,sessions,...patch});
const now=new Date('2026-10-30T00:00:00Z');
test('a single ordinary event completes only after end and published results',()=>{
 assert.equal(evaluateTournamentCompletion(event([session(1)]),now).ready,true);
 assert.equal(evaluateTournamentCompletion(event([session(1,'ordinary',{published:false})]),now).reason,'unpublished_sessions');
 assert.equal(evaluateTournamentCompletion(event([session(1)]),new Date('2026-10-01T16:30:00Z')).reason,'sessions_not_finished');
});
test('a qualifying result is not the whole tournament; every active stage must finish',()=>{
 const input=event([session(1,'qualification'),session(2,'final',{published:false})]);
 assert.equal(evaluateTournamentCompletion(input,now).reason,'unpublished_sessions');
 input.sessions[1].published=true;
 assert.deepEqual(evaluateTournamentCompletion(input,now),{ready:true,cancelled:false,eventId:id(100),finalSessionId:id(2),sessionIds:[id(1),id(2)],endsAt:'2026-10-01T17:00:00.000Z'});
 assert.equal(evaluateTournamentCompletion(event([session(1,'qualification')]),now).reason,'missing_final_session');
});
test('ambiguous finals require an explicitly selected final; cancelled stages do not delay completion',()=>{
 const input=event([session(1,'qualification'),session(2,'final'),session(3,'final',{cancelled:true,published:false})]);
 assert.equal(evaluateTournamentCompletion(input,now).ready,true);
 input.sessions[2].cancelled=false;assert.equal(evaluateTournamentCompletion(input,now).reason,'missing_final_session');
 input.finalSessionId=id(2);assert.equal(evaluateTournamentCompletion(input,now).reason,'unpublished_sessions');
 input.sessions[2].published=true;assert.equal(evaluateTournamentCompletion(input,now).ready,true);
});
test('cancellation, missing end and unrelated event types cannot fabricate completion',()=>{
 assert.deepEqual(evaluateTournamentCompletion(event([session(1)],{cancelled:true}),now),{ready:true,cancelled:true,eventId:id(100)});
 assert.equal(evaluateTournamentCompletion(event([session(1)],{type:'training'}),now).reason,'not_tournament');
 assert.equal(evaluateTournamentCompletion(event([],{}),now).reason,'no_active_sessions');
 assert.equal(evaluateTournamentCompletion(event([session(1)],{finalSessionId:id(9)}),now).reason,'invalid_final_session');
 assert.equal(evaluateTournamentCompletion(event([session(1,'ordinary',{endsAt:null})]),now).reason,'invalid_session_end');
 assert.throws(()=>evaluateTournamentCompletion(event([session(1),session(1)]),now),/CONTRACT_EVENT_DUPLICATE_SESSION/);
});
