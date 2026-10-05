import test from 'node:test';
import assert from 'node:assert/strict';
import {trainingDates,addTrainingSessions,sessionHasEnded,moscowDate,trainingMapsForSession} from '../src/lib/competition/training-schedule.ts';
const now=Date.parse('2026-10-05T08:00:00Z');
const session={id:'old-session',startTime:'2026-10-04T16:00:00Z',endTime:'2026-10-04T17:00:00Z',maxTeams:15,
 registrationOpenTime:null,registrationCloseTime:null,responsibleUserId:null,description:'Practice',stage:'ordinary',sourceSessionId:null,
 qualification:{mode:'general',count:1,transfer:'none',value:0},reminderMinutes:[60],
 groups:[{id:'old-group',name:'A',capacity:15,roomId:'private',roomPassword:'secret',roomNote:'old room',games:[{id:'old-game',map:'solara'}]}]};
test('Moscow schedule covers Monday Tuesday Thursday Sunday and respects occupied dates and current time',()=>{
 assert.equal(moscowDate('2026-10-04T22:00:00Z'),'2026-10-05');
 assert.deepEqual(trainingDates('2026-10-05',[],now),['2026-10-05','2026-10-06','2026-10-08','2026-10-11','2026-10-12','2026-10-13','2026-10-15','2026-10-18']);
 assert.ok(!trainingDates('2026-10-05',[{...session,startTime:'2026-10-06T17:00:00Z'}],now).includes('2026-10-06'));
 assert.ok(!trainingDates('2026-10-05',[],Date.parse('2026-10-05T16:00:00Z')).includes('2026-10-05'));
});
test('new sessions preserve template settings, get unique identities and empty room credentials; originals are unchanged',()=>{
 const before=structuredClone(session);
 const result=addTrainingSessions([session],['2026-10-05','2026-10-06']);
 assert.deepEqual(session,before);assert.strictEqual(result[0],session);
 assert.equal(result[1].registrationOpenTime,'2026-10-05T10:00:00+03:00');
 assert.equal(result[1].registrationCloseTime,'2026-10-05T18:59:00+03:00');
 assert.equal(result[1].startTime,'2026-10-05T19:00:00+03:00');
 assert.equal(result[1].endTime,'2026-10-05T20:00:00+03:00');
 const ids=result.flatMap(s=>[s.id,...s.groups.flatMap(g=>[g.id,...g.games.map(game=>game.id)])]);
 assert.equal(new Set(ids).size,13);
 assert.deepEqual(result[1].groups[0].games.map(g=>g.map),['bermuda','nexterra','solara']);
 assert.equal(result[1].groups[0].capacity,15);
 assert.equal(result[1].groups[0].roomPassword,'');
 assert.equal(result[1].groups[0].roomId,'');
 assert.equal(addTrainingSessions([{...session,startTime:'',endTime:''}],['2026-10-05']).length,1);
});
test('five sessions play each allowed map three times, without duplicates, and continue across weekly batches',()=>{
 const counts=new Map();
 for(let position=0;position<5;position++){
  const maps=trainingMapsForSession(position);assert.equal(new Set(maps).size,3);
  for(const map of maps)counts.set(map,(counts.get(map)??0)+1);
 }
 assert.deepEqual([...counts].sort(),[['bermuda',3],['kalahari',3],['nexterra',3],['purgatory',3],['solara',3]]);
 const batch=addTrainingSessions([session],['2026-10-05','2026-10-06','2026-10-08','2026-10-11']);
 const continued=addTrainingSessions(batch,['2026-10-12']);
 assert.equal(continued.at(-1).trainingRotationPosition,4);
 assert.deepEqual(continued.at(-1).groups[0].games.map(g=>g.map),['solara','purgatory','kalahari']);
});
test('sessions remain visible while ongoing and become past at their end, with legacy start fallback',()=>{
 const active={start_time:'2026-10-05T16:00:00Z',end_time:'2026-10-05T17:00:00Z'};
 assert.equal(sessionHasEnded(active,Date.parse('2026-10-05T16:59:59Z')),false);
 assert.equal(sessionHasEnded(active,Date.parse('2026-10-05T17:00:00Z')),true);
 assert.equal(sessionHasEnded({...active,end_time:null},Date.parse(active.start_time)),true);
});
