import {registerHooks} from 'node:module';
import {extname} from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
registerHooks({resolve(specifier,context,next){return next(context.parentURL?.endsWith('.ts')&&specifier.startsWith('.')&&!extname(specifier)?specifier+'.ts':specifier,context);}});
const {emptyDraft,publishResults,mayEditResults,draftSchema,defaultPlacePoints}=await import('../../src/lib/competition/model.ts');
const {mainRating,withReputation,organizationRating,soloRating,compareLeaderboard,teamDuelRating,playerDuelRating}=await import('../../src/lib/competition/ratings.ts');
const {parseCsv,tabularRecords,importRecords,mergeRecognizedRows}=await import('../../src/lib/competition/import.ts');
const {eventConfiguration}=await import('../../src/lib/competition/event-schema.ts');
const {competitionCost,competitionOrganizationCost}=await import('../../src/lib/competition/cost.ts');
const {archiveCards}=await import('../../src/lib/competition/archive.ts');
const {replaceWithGuest}=await import('../../src/lib/competition/result-editor.ts');
const {deliverPushTokens}=await import('../../src/lib/firebase/delivery.ts');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('1024 push recipients: provider limit, deduplication and invalid-token indexes across batches',async()=>{
 const tokens=Array.from({length:1024},(_,i)=>`device-${i}`),calls=[];
 const result=await deliverPushTokens([...tokens,tokens[0],tokens[500],''],async batch=>{
  assert.ok(batch.length<=500);calls.push(batch);
  const responses=batch.map(token=>token==='device-500'?{success:false,error:{code:'messaging/registration-token-not-registered'}}:token==='device-1000'?{success:false,error:{code:'messaging/server-unavailable'}}:{success:true});
  return {responses,successCount:responses.filter(r=>r.success).length,failureCount:responses.filter(r=>!r.success).length};
 });
 assert.deepEqual(calls.map(c=>c.length),[500,500,24]);assert.deepEqual(calls.flat(),tokens);
 assert.deepEqual(result,{successCount:1022,failureCount:2,invalidTokens:['device-500']});
 assert.deepEqual(await deliverPushTokens([],()=>{throw Error('Provider must not run without recipients');}),{successCount:0,failureCount:0,invalidTokens:[]});
});
function fixture({mode='tournament',criterion='points',count=3,games=2,groups=1,winsRequired=1}={}){
 const context={rules:{mode,criterion,placePoints:defaultPlacePoints,killPoints:1,bonuses:{},nominations:['points'],ratingEnabled:true,winsRequired},entrants:[],games:[]};
 for(let group=0;group<groups;group++){
  for(let n=0;n<count;n++)context.entrants.push({id:id(100+group*100+n),groupId:id(10+group),teamId:mode==='solo'?null:id(1000+group*100+n),userId:mode==='solo'?id(2000+group*100+n):null,name:`Team ${group}-${n}`,organizationType:'team',roster:[{id:id(2000+group*100+n),nickname:`Player ${group}-${n}`,gameId:String(50000+group*100+n)}],registeredAt:'2026-01-01T00:00:00Z'});
  for(let n=0;n<games;n++)context.games.push({id:id(500+group*100+n),groupId:id(10+group),number:n+1,map:'bermuda',publicId:`123-01-${String(group+1).padStart(2,'0')}-${String(n+1).padStart(2,'0')}`});
 }
 const draft=emptyDraft(context);for(const row of draft.rows){const index=context.entrants.findIndex(e=>e.id===row.registrationId)%count;row.played=true;row.place=index+1;row.kills=0;row.players.forEach(p=>{p.kills=0;p.deaths=0;p.assists=0;});}
 return {context,draft};
}
test('K1–K2: missing rows and blank kills block full publication; explicit zero is valid',()=>{
 const {context,draft}=fixture();assert.equal(publishResults(context,draft,true).rows.length,6);
 const missing=structuredClone(draft);missing.rows.pop();assert.throws(()=>publishResults(context,missing,true),/заполните игру/);
 draft.rows[0].players[0].kills=null;assert.throws(()=>publishResults(context,draft,true),/Заполните показатели/);
});
test('configured group capacity accepts a recorded place beyond confirmed registrations',()=>{
 const {context,draft}=fixture({count:2,games:1});context.groupCapacities={[context.entrants[0].groupId]:10};
 draft.rows[0].place=10;draft.rows[1].place=1;
 const results=publishResults(context,draft,true);assert.equal(results.rows[0].fieldSize,10);assert.equal(results.rows[0].place,10);
});

test('K2/K53: one, three and five games; full validation includes the 1024th participant',()=>{
 for(const games of [1,3,5]){const {context,draft}=fixture({games});assert.equal(publishResults(context,draft,true).rows.length,3*games);}
 const {context,draft}=fixture({count:12,groups:86,games:1});context.entrants=context.entrants.slice(0,1024);
 const ids=new Set(context.entrants.map(e=>e.id));draft.rows=draft.rows.filter(row=>ids.has(row.registrationId));draft.manualOrder=context.entrants.map(e=>e.id);
 assert.equal(publishResults(context,draft,true).standings.length,1024);
 draft.rows.pop();assert.throws(()=>publishResults(context,draft,true),/заполните игру/);
});
test('K3–K6: unlimited guests count for team, absent roster players have no personal play',()=>{
 const {context,draft}=fixture({games:1});const row=draft.rows[1];row.players[0].kills=5;
 for(let i=0;i<15;i++)row.players.push({id:id(3000+i),userId:null,played:true,kills:i===0?6:0,deaths:null,assists:null});
 row.players.push({id:id(3030),userId:null,played:true,kills:3,deaths:null,assists:null});
 const result=publishResults(context,draft,true).rows.find(r=>r.registrationId===row.registrationId);assert.equal(result.kills,14);assert.equal(result.points,23);assert.equal(result.players.filter(p=>p.userId).reduce((n,p)=>n+p.kills,0),5);
 row.players[0].played=false;const absent=publishResults(context,draft,true).rows.find(r=>r.registrationId===row.registrationId);assert.equal(absent.players[0].played,false);assert.equal(absent.players[0].kills,0);
});
test('K10: team-only publication never fabricates personal statistics',()=>{
 const {context,draft}=fixture();for(const row of draft.rows){row.detail='team';row.kills=3;}assert.ok(publishResults(context,draft,true).rows.every(r=>r.players.length===0&&r.kills===3));
});

test('K5/K6: every roster player accepts statistics and guest replacement affects only that game',()=>{
 const {context}=fixture({games:2});const entrant=context.entrants[1];
 entrant.roster=Array.from({length:4},(_,i)=>({id:id(9500+i),nickname:`Roster ${i}`,gameId:String(9500+i)}));
 const draft=emptyDraft(context);for(const row of draft.rows){row.played=true;row.place=context.entrants.findIndex(e=>e.id===row.registrationId)+1;row.players.forEach(p=>{p.kills=0;});}
 const index=draft.rows.findIndex(row=>row.registrationId===entrant.id&&row.gameId===context.games[0].id);
 const next=structuredClone(draft.rows.find(row=>row.registrationId===entrant.id&&row.gameId===context.games[1].id));
 draft.rows[index].players.forEach((p,i)=>{p.kills=[5,2,1,99][i];});
 draft.rows[index]=replaceWithGuest(draft.rows[index],draft.rows[index].players[3].id,id(9510));
 assert.throws(()=>publishResults(context,draft,true),/Заполните показатели/,'Replacement guest still requires an explicit result');
 draft.rows[index].players.find(p=>!p.userId).kills=6;
 const result=publishResults(context,draft,true).rows.find(row=>row.registrationId===entrant.id&&row.gameId===context.games[0].id);
 assert.equal(result.kills,14);assert.equal(result.points,23);
 assert.deepEqual(result.players.filter(p=>p.userId&&p.played).map(p=>p.kills),[5,2,1]);
 assert.equal(result.players.find(p=>p.userId===id(9503)).played,false);
 assert.equal(result.players.find(p=>p.userId===id(9503)).kills,0);
 assert.deepEqual(draft.rows.find(row=>row.registrationId===entrant.id&&row.gameId===context.games[1].id),next);
 assert.equal(entrant.roster.length,4);
});
test('K11: equal points, wins and kills compare games in reverse order',()=>{
 const {context,draft}=fixture({count:2});for(const row of draft.rows)if(row.gameId===context.games[1].id)row.place=3-row.place;
 const results=publishResults(context,draft,true);assert.equal(results.standings[0].registrationId,context.entrants[1].id);
});
test('K11: equal groups require organizer manual order',()=>{
 const {context,draft}=fixture({count:2,games:1,groups:2});assert.throws(()=>publishResults(context,draft,true),/Организатор/);
 draft.manualOrder=context.entrants.map(e=>e.id).reverse();assert.equal(publishResults(context,draft,true).standings[0].registrationId,context.entrants[2].id);
 assert.throws(()=>publishResults(context,draft,false),/Организатор/);
});
test('K12: solo kills ties are 1,1,3 regardless of wins, places or manual order',()=>{
 const {context,draft}=fixture({mode:'solo',criterion:'kills',games:1});draft.rows[0].players[0].kills=10;draft.rows[1].players[0].kills=10;draft.rows[2].players[0].kills=2;
 assert.deepEqual(publishResults(context,draft,true).standings.map(r=>r.place),[1,1,3]);
});
test('K12: solo absence contributes group N+1 to comparison but no sporting place',()=>{
 const {context,draft}=fixture({mode:'solo',criterion:'places'});const row=draft.rows.find(r=>r.registrationId===context.entrants[0].id&&r.gameId===context.games[1].id);row.played=false;row.place=null;row.reason='technical';
 const results=publishResults(context,draft,true),standing=results.standings.find(s=>s.userId===context.entrants[0].userId);
 assert.equal(standing.placeSum,5);assert.equal(standing.gamesPlayed,1);assert.equal(results.rows.find(r=>r.gameId===row.gameId&&r.registrationId===row.registrationId).place,null);
});
test('K13: no-show may publish without a warning; an optional warning remains unique and complete',()=>{
 const {context,draft}=fixture({count:2});for(const row of draft.rows)if(row.registrationId===context.entrants[1].id)row.played=false;
 assert.equal(publishResults(context,draft,true).standings[1].gamesPlayed,0);
 const warning={id:id(4000),targetType:'team',targetId:context.entrants[1].teamId,source:'no_show',gameId:null,reason:'Неявка',duration:null,penalty:null};draft.warnings.push(warning);
 assert.ok(draftSchema.safeParse(draft).success);assert.throws(()=>publishResults(context,draft,true),/причину, срок/);
 warning.duration='week';warning.penalty=4;assert.equal(publishResults(context,draft,true).standings[1].gamesPlayed,0);
 draft.warnings.push({...warning,id:id(4001)});assert.throws(()=>publishResults(context,draft,true),/ровно одно/);
});
test('K15/K18: edit clocks exclude the exact deadline and administrator has no deadline',()=>{
 const first='2026-09-01T12:00:00Z',time=Date.parse(first);
 assert.ok(mayEditResults('responsible',first,time+15*60000-1));assert.equal(mayEditResults('responsible',first,time+15*60000),false);
 assert.equal(mayEditResults('organizer',first,time+7*86400000),false);assert.ok(mayEditResults('admin',first,time+365*86400000));
});
test('K26: a best-of-three series ends at two wins and unused decider is not a no-show',()=>{
 const {context,draft}=fixture({mode:'bo',count:2,games:3,winsRequired:2});for(const row of draft.rows){row.rounds=row.registrationId===context.entrants[0].id?7:5;if(row.gameId===context.games[2].id)row.played=null;}
 const results=publishResults(context,draft,true);assert.equal(results.rows.length,4);assert.equal(results.standings[0].wins,2);assert.ok(results.rows.every(r=>r.points===0));
 draft.rows.find(r=>r.gameId===context.games[2].id).played=true;assert.throws(()=>publishResults(context,draft,true),/лишние игры/);
});
test('K26: technical forfeit is a win without a fabricated 7:0 score',()=>{
 const {context,draft}=fixture({mode:'kv',count:2,games:1});const loser=context.entrants[1];for(const row of draft.rows){row.detail='team';row.kills=0;row.rounds=null;if(row.registrationId===loser.id)row.played=false;}
 draft.warnings.push({id:id(4050),targetId:loser.teamId,targetType:'team',reason:'Неявка',source:'no_show',gameId:null,penalty:1,duration:'week'});
 const results=publishResults(context,draft,true);assert.equal(results.standings[0].place,1);assert.equal(results.standings[0].wins,0);assert.equal(results.standings[0].gamesPlayed,0);assert.equal(results.rows[0].rounds,null);assert.deepEqual(results.mvps,[]);
});
test('main rating is weighted and reputation applied to full precision',()=>{
 const perfect=Array.from({length:12},()=>({kills:9,place:1,fieldSize:12,weight:1}));assert.equal(mainRating(perfect).exact,100);assert.equal(mainRating(perfect,1).exact,97);
 const ordinary=mainRating([{kills:4,place:2,fieldSize:12,weight:1}]);assert.ok(ordinary.exact>ordinary.display-0.1&&ordinary.exact<ordinary.display+0.1);
 assert.ok(mainRating([{kills:4,place:2,fieldSize:12,weight:.2}]).exact<ordinary.exact);
 assert.equal(withReputation(50,100),51.5);assert.equal(mainRating([]).exact,1);
 const example=Array.from({length:20},(_,i)=>({kills:4,place:i<4?1:i<12?3:4,fieldSize:12,weight:1}));
 assert.ok(Math.abs(mainRating(example).game-56.32)<1e-10);assert.equal(mainRating(example,100).display,58);
});

test('XLSX and CSV data enter the same validated result model after dependency updates',async()=>{
 const {default:ExcelJS}=await import('exceljs');
 const {context}=fixture({games:1});
 const records=[['game_id','registration_id','place','kills','played','detail'],[context.games[0].publicId,context.entrants[0].id,1,0,1,'team']];
 const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('Results');sheet.addRows(records);
 // Exercises ExcelJS uuid v4 integration, including its conditional-format extension.
 sheet.addConditionalFormatting({ref:'D2',rules:[{type:'dataBar',minLength:0,maxLength:100,cfvo:[{type:'min'},{type:'max'}],color:{argb:'FF00CCAA'}}]});
 const buffer=await workbook.xlsx.writeBuffer(),read=new ExcelJS.Workbook();await read.xlsx.load(buffer);
 const rows=[];read.getWorksheet('Results').eachRow(row=>rows.push(records[0].map((_,i)=>row.getCell(i+1).text)));
 assert.deepEqual(importRecords(context,tabularRecords(rows)),importRecords(context,tabularRecords(parseCsv(records.map(row=>row.join(',')).join('\n')))));
});
test('organization picks top four full ratings after personal reputation effects',()=>{
 const players=[withReputation(90,1),88,87,86,85];const expected=.98*(.6*(players.slice(0,4).reduce((a,b)=>a+b,0)/4)+.3*50+.1*50)+.02*50;
 assert.equal(organizationRating(players,50,50,50).exact,expected);assert.equal(soloRating(Array.from({length:5},()=>({place:1,participants:10,weight:1}))),100);
 assert.ok(compareLeaderboard({exact:50.04,wins:0,games:1},{exact:50.03,wins:5,games:10})<0);
 assert.ok(compareLeaderboard({exact:50,wins:1,games:2},{exact:50,wins:2,games:1})>0);
});
test('duel rating responds to opponent, margin and repeats; player baseline is 50',()=>{
 const score={aWins:2,bWins:0,aRounds:14,bRounds:5,winner:'a',technical:false};const fresh=teamDuelRating(50,50,0,0,0,score),repeat=teamDuelRating(50,50,0,0,10,score);
 assert.ok(fresh.a>repeat.a&&fresh.b<repeat.b);assert.equal(fresh.a+fresh.b,100);assert.equal(playerDuelRating(0,0,0,0,0),50);
});
test('CSV quoting, Cyrillic headers and zero vs empty imports',()=>{
 const parsed=parseCsv('\uFEFFкоманда;место;убийства;причина\r\n"Team 0-0";1;0;"строка\nс ""кавычками"""');assert.equal(parsed[1][3],'строка\nс "кавычками"');
 const {context}=fixture({games:1});const result=importRecords(context,tabularRecords(parsed));assert.equal(result.unresolved.length,0);assert.equal(result.rows[0].kills,0);assert.equal(result.rows[0].played,null);
 const blank=importRecords(context,[{registration_id:context.entrants[0].id,kills:'',place:'1'}]);assert.equal(blank.rows[0].kills,null);
});
test('ambiguous names never guess; explicit mappings resolve duplicate nicknames',()=>{
 const {context}=fixture({games:1});context.entrants.forEach(e=>e.roster[0].nickname='Same');const records=[{nickname:'Same',kills:'0',played:'1'}];
 assert.equal(importRecords(context,records).unresolved.length,1);
 const result=importRecords(context,records,{'2':{registrationId:context.entrants[1].id,userId:context.entrants[1].roster[0].id}});assert.equal(result.unresolved.length,0);assert.deepEqual(result.affectedRowKeys,[`${context.games[0].id}:${context.entrants[1].id}`]);
});
test('import uses permanent ID after reorder; blank template metadata has no effect',()=>{
 const {context}=fixture();context.games.reverse();const result=importRecords(context,[{game_id:context.games[0].publicId,registration_id:context.entrants[0].id,kills:'7',played:'1'},{game_id:context.games[0].publicId,registration_id:context.entrants[0].id,player_id:context.entrants[0].roster[0].id}]);assert.equal(result.unresolved.length,0);assert.equal(result.rows.find(r=>r.gameId===context.games[0].id).kills,7);
});
test('OCR merge preserves previously entered place and other player statistics',()=>{
 const {context,draft}=fixture();draft.rows[0].players[0].kills=8;
 const incoming=importRecords(context,[{game_id:context.games[0].id,registration_id:context.entrants[0].id,player_id:context.entrants[0].roster[0].id,kills:'3'}]);
 const merged=mergeRecognizedRows(draft.rows,incoming.rows.filter(r=>incoming.affectedRowKeys.includes(`${r.gameId}:${r.registrationId}`)));assert.equal(merged[0].place,1);assert.equal(merged[0].players[0].kills,3);assert.deepEqual(merged[1],draft.rows[1]);
});
test('event schema rejects duplicate session identifiers before database write',()=>{
 const session={id:id(8000),startTime:'2026-10-01T12:00:00Z',endTime:'2026-10-01T13:00:00Z',registrationOpenTime:null,registrationCloseTime:null,maxTeams:12,groups:[{capacity:12,name:'A',games:[{map:'bermuda'}]}]};
 const config={title:'Test',type:'training',cost:0,organizer:'',organizerUserId:null,description:'',streamUrl:'',paymentUrl:'',maxTeams:12,minPlayers:4,publishAt:null,commentsEnabled:true,allowIndividualRegistration:false,rules:fixture().context.rules,sessions:[session,structuredClone(session)]};config.rules.mode='training';
 assert.equal(eventConfiguration.safeParse(config).success,false);
});
test('event schema normalizes Supabase timestamp format before saving',()=>{
 const session={id:id(8001),startTime:'2026-10-01 12:00:00+00',endTime:'2026-10-01 13:00:00+00',registrationOpenTime:null,registrationCloseTime:null,maxTeams:12,groups:[{capacity:12,name:'A',games:[{map:'bermuda'}]}]};
 const config={title:'Test',type:'training',cost:0,organizer:'',organizerUserId:null,description:'',streamUrl:'',paymentUrl:'',maxTeams:12,minPlayers:4,publishAt:'2026-09-21 06:00:00+00',commentsEnabled:true,allowIndividualRegistration:false,rules:fixture().context.rules,sessions:[session]};config.rules.mode='training';
 const parsed=eventConfiguration.parse(config);
 assert.equal(parsed.publishAt,'2026-09-21T06:00:00.000Z');assert.equal(parsed.sessions[0].startTime,'2026-10-01T12:00:00.000Z');
});
test('competition cost uses useful utility, diminishing confidence, and hundredth-ruble scale',()=>{
 const one=competitionCost({kills:24,deaths:12,games:3,wins:1,rating:60,reputation:50,utility:.8,weightedSessions:1});
 const three=competitionCost({kills:24,deaths:12,games:9,wins:3,rating:60,reputation:50,utility:.8,weightedSessions:3});
 const many=competitionCost({kills:240,deaths:120,games:30,wins:10,rating:60,reputation:50,utility:.8,weightedSessions:30});
 assert.ok(one>0&&three>one&&many>three);assert.ok(three<one*3&&many<100);
 assert.equal(competitionCost({kills:0,games:0,wins:0,rating:80,reputation:80}),0);
});
test('organization cost adds roster and organization merits above member value',()=>{
 const player=competitionCost({kills:24,deaths:12,games:3,wins:1,rating:60,reputation:50,utility:.8,weightedSessions:2});
 const organization=competitionOrganizationCost({memberCosts:[player,player],rating:80,results:70,achievements:65,reputation:75,memberRatings:[60,60],memberReputations:[50,50],weightedSessions:6,winRate:.5});
 assert.ok(organization>player*2);
});
test('K25: elapsed sessions archive separately then collapse without requiring results',()=>{
 const sessions=[{id:id(9100),start_time:'2026-09-20T12:00:00Z',end_time:'2026-09-20T13:00:00Z'},{id:id(9101),start_time:'2026-09-25T12:00:00Z',end_time:'2026-09-25T13:00:00Z'}];
 const events=[{id:id(9000),sessions}];const middle=archiveCards(events,Date.parse('2026-09-22T12:00:00Z'));
 assert.deepEqual(middle.activeEvents[0].sessions,[sessions[1]]);assert.equal(middle.archiveEvents[0].archivedSessionId,sessions[0].id);
 const ended=archiveCards(events,Date.parse('2026-09-25T13:00:00Z'));assert.equal(ended.activeEvents.length,0);assert.equal(ended.archiveEvents.length,1);assert.equal(ended.archiveEvents[0].archivedSessionId,null);
});
