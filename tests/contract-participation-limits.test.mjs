import assert from 'node:assert/strict';
import test from 'node:test';
import {evaluateSessionLimit,participationLimitSchema} from '../src/modules/contracts/participation-limits.ts';

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const fact=(n,playedGames=3,patch={})=>({sessionId:id(n),startsAt:`2026-11-${String(n).padStart(2,'0')}T16:00:00Z`,endsAt:`2026-11-${String(n).padStart(2,'0')}T17:00:00Z`,eventType:'training',playedGames,cancelled:false,...patch});

test('actual sessions consume the limit; absence and cancellation do not',()=>{
 const result=evaluateSessionLimit({unit:'sessions',count:2,completion:'contract'},[fact(1,0),fact(2,3,{cancelled:true}),fact(3,1),fact(4,3),fact(5,3)]);
 assert.equal(result.ready,true);assert.equal(result.used,2);assert.equal(result.remaining,0);
 assert.deepEqual(result.sessions.map(row=>row.consumed),[0,0,1,1,0]);
 assert.equal(result.sessions[4].included,false);assert.equal(result.contractEndsAt,fact(4).endsAt);
});
test('the entire last session remains included when its games exceed the balance',()=>{
 const result=evaluateSessionLimit({unit:'games',count:4},[fact(1,3),fact(2,3),fact(3,1)]);
 assert.equal(result.ready,true);assert.equal(result.used,6);assert.equal(result.remaining,0);
 assert.deepEqual(result.sessions.map(row=>row.included),[true,true,false]);
 assert.equal(result.contractEndsAt,fact(2).endsAt);
});
test('the event-payments policy leaves the timed contract end independent',()=>{
 const result=evaluateSessionLimit({unit:'sessions',count:1,completion:'event_payments'},[fact(1),fact(2)]);
 assert.equal(result.ready,true);assert.equal(result.reachedAt,fact(1).endsAt);assert.equal(result.contractEndsAt,null);
 assert.equal(result.sessions[1].included,false);
});
test('a renewal starts a fresh counter when supplied only its revision facts',()=>{
 const old=evaluateSessionLimit({unit:'sessions',count:2},[fact(1),fact(2),fact(3)]);
 const renewal=evaluateSessionLimit({unit:'sessions',count:2},[fact(4)]);
 assert.equal(old.remaining,0);assert.equal(renewal.remaining,1);assert.equal(renewal.contractEndsAt,null);
});
test('missing earlier confirmed participation holds dependent later allocation',()=>{
 const waiting=evaluateSessionLimit({unit:'sessions',count:1},[fact(1,null),fact(2)]);
 assert.equal(waiting.ready,false);assert.equal(waiting.sessions[1].ready,false);assert.equal(waiting.used,0);
 const resolved=evaluateSessionLimit({unit:'sessions',count:1},[fact(1,0),fact(2)]);
 assert.equal(resolved.ready,true);assert.equal(resolved.sessions[1].included,true);
});
test('chronological session order is stable and training units count only trainings',()=>{
 const result=evaluateSessionLimit({unit:'trainings',count:1},[fact(3),fact(1,3,{eventType:'tournament'}),fact(2)]);
 assert.equal(result.ready,true);assert.deepEqual(result.sessions.map(row=>row.sessionId),[id(1),id(2),id(3)]);
 assert.deepEqual(result.sessions.map(row=>row.consumed),[0,1,0]);assert.equal(result.contractEndsAt,fact(2).endsAt);
});
test('tournament limits require whole-event completion evidence; inputs reject duplicate or malformed facts',()=>{
 assert.deepEqual(evaluateSessionLimit({unit:'tournaments',count:1},[fact(1)]),{ready:false,reason:'tournament_completion_required'});
 assert.throws(()=>evaluateSessionLimit({unit:'sessions',count:1},[fact(1),fact(1)]),/CONTRACT_LIMIT_DUPLICATE_SESSION/);
 for(const rule of [{unit:'sessions',count:0},{unit:'sessions',count:1,completion:'guess'},{unit:'sessions',count:1,script:'pay'}])assert.equal(participationLimitSchema.safeParse(rule).success,false);
 assert.throws(()=>evaluateSessionLimit({unit:'sessions',count:1},[fact(1,-1)]));
});
