import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {defaultTerms} from '../../src/modules/contracts/model.ts';

export async function verifyPersonalAwards(db,id){
 const owner=id(19800),player=id(19801),other=id(19802),ordinaryAdmin=id(19803),team=id(19804);
 for(const user of [owner,player,other,ordinaryAdmin]){
  await db.query('insert into auth.users(id) values($1)',[user]);
  await db.query('insert into profiles(id,nickname) values($1,$2)',[user,'Personal award '+user.slice(-4)]);
 }
 await db.query("insert into user_roles(user_id,role) values($1,'superadmin'),($2,'admin')",[owner,ordinaryAdmin]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
 await db.query("insert into teams(id,name,type,leader_id,verified) values($1,'Personal award team','team',$2,true)",[team,owner]);
 const wallet=async(action,input)=>(await db.query('select u6_coin_action($1,$2,$3,$4::jsonb) value',[owner,randomUUID(),action,JSON.stringify(input)])).rows[0].value;
 const account=async()=>(await db.query('select balance::int,reserved::int from coin_accounts where user_id=$1',[owner])).rows[0];
 await wallet('adjust',{kind:'player',ownerId:owner,amount:1000,reason:'Test organizer personal awards'});
 const config={prizePlan:[],personalPrizes:{mvp:20,maxKills:10},trainingSchedule:null,title:'Personal training',type:'training',cost:0,
  organizer:'Organizer',organizerUserId:owner,description:'',rulesText:'',streamUrl:'',paymentUrl:'',imageUrl:'',maxTeams:12,minPlayers:1,
  rosterLockMinutes:10,publishAt:null,commentsEnabled:true,allowIndividualRegistration:false,finalSessionId:null,
  rules:{mode:'training',criterion:'points',placePoints:[12,9,8,7,6,5,4,3,2,1],killPoints:1,bonuses:{},nominations:['points'],ratingEnabled:false,winsRequired:1},
  sessions:[{id:id(19810),startTime:'2031-01-06T16:00:00Z',endTime:'2031-01-06T17:00:00Z',registrationOpenTime:null,registrationCloseTime:null,
   maxTeams:12,responsibleUserId:null,description:'',stage:'ordinary',sourceSessionId:null,qualification:{mode:'general',count:1,transfer:'none',value:0},reminderMinutes:[],
   groups:[{id:id(19811),name:'Main',capacity:12,roomId:'',roomPassword:'',roomNote:'',games:[{id:id(19812),map:'bermuda'},{id:id(19813),map:'nexterra'}]}]}]};
 const save=async(c,event=null,revision=0,actor=owner)=>(await db.query('select u2_event_configuration($1,$2,$3,$4::jsonb) value',[actor,event,revision,JSON.stringify(c)])).rows[0].value;
 const event=(await save(config)).eventId;
 const fund=(await db.query('select id from personal_award_funds where event_id=$1',[event])).rows[0].id;
 const distribution=async(kind='mvp',winner=null)=>(await db.query('select personal_award_distribution($1,$2,$3) value',[fund,kind,winner])).rows[0].value;
 assert.deepEqual(await account(),{balance:1000,reserved:30});
 await save(config,event,1);assert.equal((await account()).reserved,30,'saving twice does not reserve a second award');
 const stolen=structuredClone(config);stolen.personalPrizes.mvp=200;
 await assert.rejects(()=>save(stolen,event,2,ordinaryAdmin),/Нет прав менять обязательства чужого кошелька/);
 assert.equal((await account()).reserved,30);
 const tooLarge=structuredClone(config);tooLarge.personalPrizes.mvp=2000;tooLarge.sessions[0].id=id(19820);tooLarge.sessions[0].groups[0].id=id(19821);
 tooLarge.sessions[0].groups[0].games=tooLarge.sessions[0].groups[0].games.map((g,i)=>({...g,id:id(19822+i)}));
 await assert.rejects(()=>save(tooLarge),/Недостаточно монет для личных призов/);
 assert.equal((await db.query('select count(*)::int n from event_sessions where id=$1',[id(19820)])).rows[0].n,0,'insufficient personal funding rolls back the whole event');
 for(const bad of [{mvp:-1,maxKills:0},{mvp:0.5,maxKills:0},{mvp:0,maxKills:0,recipient:player},{mvp:1000000000001,maxKills:0}]){
  await assert.rejects(()=>db.query('select personal_award_validate($1::jsonb)',[JSON.stringify(bad)]));
 }
 await db.exec('set role authenticated');try{
  await assert.rejects(()=>db.query('select * from personal_award_funds'),/permission denied/);
  await assert.rejects(()=>db.query('select personal_award_reserve($1,$2)',[event,id(19810)]),/permission denied/);
 }finally{await db.exec('reset role');}
 // Publish actual historical rows; all reserve decisions happened beforehand.
 const session=id(19810),group=id(19811),reg=id(19814),guest=id(19815);
 // The actual winner has no advance contract. Another player's deliberately
 // late signature must not capture an already started personal award.
 const lateTerms=defaultTerms(new Date(Date.now()-86400000));lateTerms.personalShareBps=1000;
 await db.query("insert into organization_contracts(id,organization_id,player_id,kind,created_by) values($1,$2,$3,'main',$4)",[id(19816),team,other,owner]);
 await db.query("insert into organization_contract_versions(contract_id,revision,terms,created_by,status,offered_at) values($1,1,$2::jsonb,$3,'offered',now()-interval '1 day')",[id(19816),JSON.stringify(lateTerms),owner]);
 await db.query("insert into contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at) values($1,1,$2,$3,1,now()-interval '1 day',now()-interval '1 day')",[id(19816),owner,other]);
 await db.query('insert into event_registrations(id,event_id,session_id,team_id,group_id,roster_json) values($1,$2,$3,$4,$5,$6::jsonb)',[reg,event,session,team,group,JSON.stringify([player,other])]);
 await db.query("update event_sessions set start_time=now()-interval '2 day',end_time=now()-interval '1 day' where id=$1",[session]);
 let revision=0;
 const document=()=>({rules:config.rules,mvps:[player],rows:config.sessions[0].groups[0].games.map((gm,i)=>({registrationId:reg,gameId:gm.id,groupId:group,teamId:team,userId:null,name:'Personal award team',
  played:true,detail:'players',reason:'no_show',place:1,kills:8,points:20,fieldSize:2,rounds:null,
  players:[{id:player,userId:player,nickname:'Player',played:true,kills:i?4:6,deaths:0,assists:0},{id:other,userId:other,nickname:'Other',played:true,kills:i?4:2,deaths:0,assists:0}]})),
  standings:[{registrationId:reg,teamId:team,userId:null,groupId:group,name:'Personal award team',place:1,kills:16,points:40,placeSum:2,wins:2,gamesPlayed:2,bonus:0,manual:false}]});
 const publish=async(doc)=>{
  const current=(await db.query('select configuration_revision from event_sessions where id=$1',[session])).rows[0].configuration_revision;
  const answer=(await db.query('select u2_save_results($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb) value',[owner,session,revision,current,randomUUID(),JSON.stringify(doc),JSON.stringify({rows:doc.rows,warnings:[],manualOrder:[],snapshots:[]}),JSON.stringify(doc)])).rows[0].value;revision=answer.revision;
 };
 const candidates=async(e=event,s=session)=>(await db.query('select personal_award_candidates($1,$2) value',[e,s])).rows[0].value;
 await publish(document());let result=await candidates();
 assert.equal(result.ready,true);assert.equal(result.players[0].kills,10);assert.equal(result.players[0].userId,player);assert.equal(result.players[0].mvpCandidate,true);
 assert.equal(result.players[0].maxKillsCandidate,true,'one player can be eligible for both awards');
 assert.equal((await distribution()).playerAmount,20,'personal award without contract goes directly and entirely to the player');
 assert.equal((await distribution()).organizationAmount,0);
 await assert.rejects(()=>distribution('mvp','user:'+other),/PERSONAL_AWARD_WINNER/,'caller cannot substitute the runner-up');
 assert.equal((await account()).reserved,30,'candidate calculation never pays or releases promised awards');
 const tie=document();tie.rows[0].players[0].kills=4;tie.rows[0].players[1].kills=4;
 await publish(tie);assert.equal((await distribution()).reason,'winner_choice_required');
 assert.equal((await distribution('mvp','user:'+other)).playerAmount,20,'post-start contract cannot change personal prize ownership');
 const incomplete=document();incomplete.rows[0].detail='team';incomplete.rows[0].players=[];await publish(incomplete);
 assert.equal((await candidates()).reason,'incomplete_player_statistics');
 const anonymous=document();for(const row of anonymous.rows){row.players=[{id:guest,userId:null,nickname:'Anonymous guest',played:true,kills:7,deaths:0,assists:0},{id:player,userId:player,nickname:'Player',played:true,kills:1,deaths:0,assists:0},{id:other,userId:other,nickname:'Other',played:false,kills:0,deaths:0,assists:0}];}
 await publish(anonymous);result=await candidates();assert.equal(result.players[0].userId,null);assert.equal(result.players[0].mvpCandidate,true);
 assert.equal((await distribution()).reason,'winner_account_missing');
 assert.equal(result.players.find(p=>p.userId===player).mvpCandidate,false,'unregistered winner cannot be replaced by a registered runner-up');
 const missingZero=structuredClone(anonymous);missingZero.rows[0].players.pop();await publish(missingZero);assert.equal((await candidates()).reason,'incomplete_player_statistics','zero-kill absent roster member must still be explicitly accounted for');
 const duplicate=structuredClone(anonymous);duplicate.rows[0].players.unshift({...duplicate.rows[0].players[0],kills:0});
 await publish(duplicate);assert.equal((await candidates()).reason,'duplicate_player_statistics');
 const missing=document();missing.rows.pop();await publish(missing);assert.equal((await candidates()).reason,'incomplete_player_statistics');
 // A different session starts after the other player's agreement. A scoped
 // guest agreement is now effective for Player; its home share is paid from
 // the player's gross entitlement, not charged twice.
 const scoped=id(19870),sg=id(19871),sr=id(19872),sc=id(19873),home=id(19874),homeMain=id(19875);
 await db.query("insert into teams(id,name,type,leader_id,verified) values($1,'Personal award home','team',$2,true)",[home,owner]);
 await db.query("insert into event_sessions(id,event_id,start_time,end_time) values($1,$2,now()+interval '1 day',now()+interval '1 day 1 hour')",[scoped,event]);
 await db.query("insert into event_groups(id,session_id,public_number,display_order,name,capacity) values($1,$2,1,1,'Main',12)",[sg,scoped]);
 await db.query("insert into event_games(id,event_id,session_id,group_id,game_number,public_number,map_name) values($1,$2,$3,$4,1,1,'bermuda')",[id(19876),event,scoped,sg]);
 await db.query('insert into event_registrations(id,event_id,session_id,team_id,group_id,roster_json) values($1,$2,$3,$4,$5,$6::jsonb)',[sr,event,scoped,team,sg,JSON.stringify([player,other])]);
 await db.query('select personal_award_reserve($1,$2)',[event,scoped]);
 for(const[c,org,kind]of[[sc,team,'guest'],[homeMain,home,'main']]){
  const terms=defaultTerms(new Date(Date.now()-86400000));terms.personalShareBps=5000;terms.guestPolicy='allowed';terms.guestCompensation={kind:'percent',basisPoints:2000};
  await db.query('insert into organization_contracts(id,organization_id,player_id,kind,event_id,session_id,created_by) values($1,$2,$3,$4,$5,$6,$7)',[c,org,player,kind,kind==='guest'?event:null,kind==='guest'?scoped:null,owner]);
  await db.query("insert into organization_contract_versions(contract_id,revision,terms,created_by,status,offered_at) values($1,1,$2::jsonb,$3,'offered',now()-interval '1 day')",[c,JSON.stringify(terms),owner]);
  await db.query("insert into contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at) values($1,1,$2,$3,1,now()-interval '1 day',now()-interval '1 day')",[c,owner,player]);
 }
 await db.query("insert into contract_guest_scopes(contract_id,revision,event_id,session_ids,starts_at,ends_at) values($1,1,$2,array[$3::uuid],now()-interval '12 hour',now()-interval '11 hour')",[sc,event,scoped]);
 await db.query("insert into contract_guest_requirements(contract_id,revision,home_contract_id,home_revision,organization_id,policy,compensation) values($1,1,$2,1,$3,'allowed','{\"kind\":\"percent\",\"basisPoints\":2000}')",[sc,homeMain,home]);
 await db.query("insert into contract_guest_activations(contract_id,revision,activated_at) values($1,1,now()-interval '1 day')",[sc]);
 await db.query("update event_sessions set start_time=now()-interval '12 hour',end_time=now()-interval '11 hour' where id=$1",[scoped]);
 const scopedDoc=document();scopedDoc.rows=[{...scopedDoc.rows[0],registrationId:sr,gameId:id(19876),groupId:sg}];
 scopedDoc.standings=[{...scopedDoc.standings[0],registrationId:sr,groupId:sg,kills:8,points:20,gamesPlayed:1}];
 const scopedConfig=(await db.query('select configuration_revision from event_sessions where id=$1',[scoped])).rows[0].configuration_revision;
 const publishScoped=async(expected,doc)=>db.query('select u2_save_results($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)',[owner,scoped,expected,scopedConfig,randomUUID(),JSON.stringify(doc),JSON.stringify({rows:doc.rows,warnings:[],manualOrder:[],snapshots:[]}),JSON.stringify(doc)]);
 await publishScoped(0,scopedDoc);
 const scopedFund=(await db.query('select id from personal_award_funds where session_id=$1',[scoped])).rows[0].id;
 const guestPlan=(await db.query("select personal_award_distribution($1,'mvp',null) value",[scopedFund])).rows[0].value;
 assert.equal(guestPlan.ready,true);assert.equal(guestPlan.organizationAmount,10);assert.equal(guestPlan.playerGross,10);assert.equal(guestPlan.playerAmount,8);
 assert.deepEqual(guestPlan.homeShares,[{organizationId:home,amount:2}]);assert.equal(guestPlan.contractId,sc);
 const mainDoc=structuredClone(scopedDoc);mainDoc.rows[0].players[0].kills=2;mainDoc.rows[0].players[1].kills=6;mainDoc.mvps=[other];await publishScoped(1,mainDoc);
 const mainPlan=(await db.query("select personal_award_distribution($1,'mvp',null) value",[scopedFund])).rows[0].value;
 assert.equal(mainPlan.playerAmount,2);assert.equal(mainPlan.organizationAmount,18);assert.equal(mainPlan.contractId,id(19816));
 await db.query("update event_sessions set status='cancelled' where id=$1",[scoped]);
 await db.query("update event_sessions set status='cancelled' where id=$1",[session]);assert.equal((await account()).reserved,0);
 const ledger=(await db.query('select count(*)::int n from coin_entries')).rows[0].n;
 await db.query("update events set cancelled_at=clock_timestamp() where id=$1",[event]);assert.equal((await db.query('select count(*)::int n from coin_entries')).rows[0].n,ledger,'cancellation does not release twice');
 console.log('PASS: personal award validation/ACL, organizer reserve, atomic shortage rollback, guest-inclusive candidates, both awards, missing/duplicate statistics holds and idempotent cancellation');

 // A whole tournament reserves once, even with multiple qualifying groups.
 const tournament=structuredClone(config);tournament.type='tournament';tournament.rules.mode='tournament';tournament.title='Whole personal tournament';
 tournament.sessions=[0,1].map((i)=>({...structuredClone(config.sessions[0]),id:id(19830+i*10),stage:i?'final':'qualification',
  startTime:`2031-01-0${6+i}T16:00:00Z`,endTime:`2031-01-0${6+i}T17:00:00Z`,
  groups:[{...structuredClone(config.sessions[0].groups[0]),id:id(19831+i*10),games:[{id:id(19832+i*10),map:'bermuda'}]}]}));
 tournament.finalSessionId=tournament.sessions[1].id;
 const tournamentId=(await save(tournament)).eventId;
 assert.equal((await account()).reserved,30);
 assert.equal((await db.query('select count(*)::int n from personal_award_funds where event_id=$1',[tournamentId])).rows[0].n,1);
 assert.equal((await candidates(tournamentId,null)).ready,false);
 await save(tournament,tournamentId,1);assert.equal((await account()).reserved,30);
 const changed=structuredClone(tournament);changed.personalPrizes.mvp=25;
 await assert.rejects(()=>save(changed,tournamentId,2),/Призы уже зарезервированного турнира нельзя менять/);
 // Whole-event personal awards use the pre-tournament version, even if
 // another version becomes effective between qualification and final.
 const tc=id(19850),now=Date.now(),iso=t=>new Date(t).toISOString(),day=86400000;
 await db.query("insert into organization_contracts(id,organization_id,player_id,kind,created_by) values($1,$2,$3,'main',$4)",[tc,team,player,owner]);
 for(const rev of [1,2]){
  const terms=defaultTerms(new Date(now-(rev===1?4:1.5)*day));terms.personalShareBps=rev===1?2000:9000;
  await db.query("insert into organization_contract_versions(contract_id,revision,terms,created_by,status,offered_at) values($1,$2,$3::jsonb,$4,'offered',$5)",[tc,rev,JSON.stringify(terms),owner,terms.startsAt]);
  await db.query('insert into contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at,ended_at) values($1,$2,$3,$4,1,$5,$5,$6)',[tc,rev,owner,player,terms.startsAt,rev===1?iso(now-1.5*day):null]);
 }
 for(const[i,s]of tournament.sessions.entries()){
  const r=id(19880+i);
  await db.query('insert into event_registrations(id,event_id,session_id,team_id,group_id,roster_json) values($1,$2,$3,$4,$5,$6::jsonb)',[r,tournamentId,s.id,team,s.groups[0].id,JSON.stringify([player])]);
 }
 for(const[i,s]of tournament.sessions.entries())await db.query('update event_sessions set start_time=$2,end_time=$3 where id=$1',[s.id,iso(now-(i?1:2)*day),iso(now-(i?1:2)*day+3600000)]);
 for(const[i,s]of tournament.sessions.entries()){
  const r=id(19880+i),row={registrationId:r,gameId:s.groups[0].games[0].id,groupId:s.groups[0].id,teamId:team,userId:null,name:'Team',played:true,detail:'players',reason:'no_show',place:1,kills:5,points:17,fieldSize:2,rounds:null,
   players:[{id:player,userId:player,nickname:'Player',played:true,kills:5,deaths:0,assists:0}]};
  const doc={rules:tournament.rules,mvps:[player],rows:[row],standings:[{registrationId:r,teamId:team,userId:null,groupId:s.groups[0].id,name:'Team',place:1,kills:5,points:17,placeSum:1,wins:1,gamesPlayed:1,bonus:0,manual:false}]};
  const conf=(await db.query('select configuration_revision from event_sessions where id=$1',[s.id])).rows[0].configuration_revision;
  await db.query('select u2_save_results($1,$2,0,$3,$4,$5,$6::jsonb,$7::jsonb)',[owner,s.id,conf,randomUUID(),JSON.stringify(doc),JSON.stringify({rows:doc.rows,warnings:[],manualOrder:[],snapshots:[]}),JSON.stringify(doc)]);
 }
 const tf=(await db.query('select id from personal_award_funds where event_id=$1 and session_id is null',[tournamentId])).rows[0].id;
 const tournamentPlan=(await db.query("select personal_award_distribution($1,'mvp',null) value",[tf])).rows[0].value;
 assert.equal(tournamentPlan.ready,true);assert.equal(tournamentPlan.revision,1);assert.equal(tournamentPlan.playerAmount,4);assert.equal(tournamentPlan.organizationAmount,16);
 await db.query("update event_sessions set status='cancelled' where id=$1",[tournament.sessions[0].id]);assert.equal((await account()).reserved,30,'one cancelled stage does not release the whole tournament award');
 await db.query("update event_sessions set status='cancelled' where id=$1",[tournament.sessions[1].id]);assert.equal((await account()).reserved,0);
 // Scheduler shortage rolls back the newly generated session and both funds.
 await wallet('reset',{kind:'player',ownerId:owner,reason:'Recurring personal fund fixture'});
 await wallet('adjust',{kind:'player',ownerId:owner,amount:1050,reason:'Two funded sessions only'});
 const recurring=structuredClone(config);recurring.title='Recurring personal prizes';recurring.prizePlan=[250,150,100];
 recurring.sessions[0].id=id(19860);recurring.sessions[0].groups[0].id=id(19861);recurring.sessions[0].groups[0].games=[{id:id(19862),map:'bermuda'}];
 recurring.sessions[0].startTime='2026-01-01T16:00:00Z';recurring.sessions[0].endTime='2026-01-01T17:00:00Z';recurring.trainingSchedule={enabled:true,startsOn:'2031-01-06'};
 const recurringId=(await save(recurring)).eventId;
 const run=async()=>(await db.query("select u3_extend_training_schedules('2031-01-06T08:00:00Z') value")).rows[0].value;
 assert.ok((await run()).fundingErrors.some(e=>e.eventId===recurringId));
 assert.equal((await account()).reserved,530,'second podium reserve is rolled back when its personal reserve fails');
 assert.equal((await db.query('select count(*)::int n from event_prize_funds f join event_sessions s on s.id=f.session_id where s.event_id=$1',[recurringId])).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int n from personal_award_funds where event_id=$1',[recurringId])).rows[0].n,1);
 await wallet('adjust',{kind:'player',ownerId:owner,amount:4000,reason:'Retry recurring personal prizes'});await run();
 const funded=(await db.query('select count(*)::int n from personal_award_funds where event_id=$1',[recurringId])).rows[0].n;
 assert.ok(funded>1);assert.equal((await account()).reserved,530*funded);
 console.log('PASS: one whole-tournament award reserve, locked funded plan, stage cancellation rules and recurring podium+personal reserve atomic retry');
}
