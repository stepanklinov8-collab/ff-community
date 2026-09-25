import assert from 'node:assert/strict';

export async function verifyAcceptance(db,id,base){
 const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
 for(const n of [7700,7701,7702,7703]){
  await db.query('insert into auth.users(id) values($1)',[id(n)]);
  await db.query('insert into profiles(id,nickname) values($1,$2)',[id(n),`Acceptance ${n}`]);
 }
 const warning=(n,target,penalty=10,category='event',duration='permanent')=>({id:id(n),targetType:'player',targetId:id(target),penalty,category,duration,reason:'Acceptance check',source:'manual'});
 const issue=async(w,sessionId=null)=>db.query('select u2_moderation_action($1,$2::jsonb)',[id(1),JSON.stringify({action:'issue_warning',warning:w,sessionId})]);
 const rep=async(n)=>Number(await scalar('select reputation_score from profiles where id=$1',[id(n)]));
 await issue(warning(7710,7700,40));await issue(warning(7711,7700,40));assert.equal(await rep(7700),1);
 await db.query(`select u2_cancel_warning($1,$2,'Cancel one deduction')`,[id(1),id(7710)]);assert.equal(await rep(7700),10);

 for(let n=0;n<5;n++)await issue(warning(7720+n,7701,5,n===4?'chat':'event'));
 const sanction=(await db.query('select * from competition_sanctions where target_id=$1',[id(7701)])).rows[0];
 assert.deepEqual(sanction.scopes,['events','event_comments','public_comments','chat']);
 assert.equal(new Date(sanction.ends_at)-new Date(sanction.starts_at),30*86400000);
 await db.query(`select u2_cancel_warning($1,$2,'Cancel basis, keep sanction')`,[id(1),id(7720)]);
 assert.equal(await rep(7701),30);
 assert.equal(await scalar(`select u2_is_restricted('player',$1,'events')`,[id(7701)]),true);
 await db.query(`update competition_sanctions set ends_at=now()-interval '1 second' where id=$1`,[sanction.id]);
 await db.query(`select u2_recalculate_reputation('player',$1)`,[id(7701)]);assert.equal(await rep(7701),50);
 await db.query(`select u2_check_warning_thresholds('player',$1,$2)`,[id(7701),id(1)]);
 assert.equal(Number(await scalar('select count(*) from competition_sanctions where target_id=$1',[id(7701)])),1);

 const config=structuredClone(base);config.allowIndividualRegistration=true;config.organizerUserId=id(7703);
 config.sessions=[{...base.sessions[0],id:id(7800),groups:[{id:id(7801),name:'Acceptance',capacity:12,games:[{id:id(7802),map:'bermuda'}]}]}];
 const event=(await scalar('select u2_event_configuration($1,null,0,$2::jsonb)',[id(1),JSON.stringify(config)])).eventId;
 await db.query(`insert into event_registrations(event_id,session_id,participant_user_id,roster_json) values($1,$2,$3,$4::jsonb)`,[event,id(7800),id(7702),JSON.stringify([id(7702)])]);
 await db.query(`insert into competition_publications(session_id,first_published_at) values($1,now()-interval '6 days')`,[id(7800)]);
 const weekly=warning(7810,7702,3,'event','week');await issue(weekly,id(7800));
 const before=(await db.query('select activated_at,expires_at from warnings where id=$1',[id(7810)])).rows[0];
 assert.equal(new Date(before.expires_at)-new Date(before.activated_at),7*86400000);
 await issue({...weekly,reason:'Correct reason'},id(7800));
 assert.deepEqual((await db.query('select activated_at,expires_at from warnings where id=$1',[id(7810)])).rows[0],before);
 await issue(warning(7811,7702,3),id(7800));await issue(warning(7812,7702,3),id(7800));
 const local=(await db.query('select * from competition_sanctions where target_id=$1',[id(7702)])).rows[0];
 assert.equal(local.organizer_id,id(7703));assert.deepEqual(local.scopes,['events','event_comments']);
 assert.equal(await scalar(`select u2_is_restricted('player',$1,'events',$2)`,[id(7702),id(7703)]),true);
 assert.equal(await scalar(`select u2_is_restricted('player',$1,'events',$2)`,[id(7702),id(1)]),false);

 // Team-only -> personal enrichment must replace projections, not append facts.
 const teamConfig=structuredClone(base);teamConfig.sessions=[{...base.sessions[0],id:id(7900),groups:[{id:id(7901),name:'Enrichment',capacity:12,games:[{id:id(7902),map:'bermuda'}]}]}];
 const teamEvent=(await scalar('select u2_event_configuration($1,null,0,$2::jsonb)',[id(1),JSON.stringify(teamConfig)])).eventId;
 await db.query(`insert into event_registrations(id,event_id,session_id,team_id,roster_json) values($1,$2,$3,$4,$5::jsonb),($6,$2,$3,$7,'[]')`,[id(7910),teamEvent,id(7900),id(110),JSON.stringify([id(2)]),id(7911),id(111)]);
 const rows=[0,1].map(i=>({registrationId:id(7910+i),gameId:id(7902),groupId:id(7901),teamId:id(110+i),userId:null,name:`Enrichment ${i}`,played:true,place:i+1,kills:i?1:10,points:i?10:22,rounds:null,detail:'team',players:[],reason:'no_show',fieldSize:2}));
 const doc={rules:base.rules,mvps:[],rows,standings:rows.map(r=>({...r,gamesPlayed:1,wins:r.place===1?1:0,placeSum:r.place,bonus:0,manual:false}))};
 let request=7920;
 const save=async(rev)=>db.query(`select u2_save_results($1,$2,$3,(select configuration_revision from event_sessions where id=$2),$4,'enrich',$5::jsonb,$6::jsonb)`,[id(1),id(7900),rev,id(++request),JSON.stringify({rows:doc.rows,warnings:[],manualOrder:[]}),JSON.stringify(doc)]);
 await save(0);assert.equal(Number(await scalar('select count(*) from competition_player_facts where session_id=$1',[id(7900)])),0);
 doc.rows[0].detail='players';doc.rows[0].players=[{id:id(2),userId:id(2),nickname:'Player',played:true,kills:7,deaths:0,assists:0},{id:id(7990),userId:null,nickname:'Guest',played:true,kills:3,deaths:0,assists:0}];
 await save(1);await save(2);
 assert.equal(Number(await scalar('select count(*) from competition_team_facts where session_id=$1',[id(7900)])),2);
 assert.equal(Number(await scalar('select count(*) from competition_player_facts where session_id=$1',[id(7900)])),1);
 assert.equal(Number(await scalar('select kills from competition_player_facts where session_id=$1',[id(7900)])),7);
 assert.equal(Number(await scalar('select sum(kills) from competition_team_facts where session_id=$1',[id(7900)])),11);
 const soloConfig=structuredClone(base);soloConfig.type='solo';soloConfig.allowIndividualRegistration=true;soloConfig.rules={...base.rules,mode:'solo',nominations:['points','kills']};
 soloConfig.sessions=[{...base.sessions[0],id:id(8000),groups:[{id:id(8001),name:'Solo nominations',capacity:60,games:[{id:id(8002),map:'bermuda'}]}]}];
 const soloEvent=(await scalar('select u2_event_configuration($1,null,0,$2::jsonb)',[id(1),JSON.stringify(soloConfig)])).eventId;
 for(let i=0;i<2;i++)await db.query(`insert into event_registrations(id,event_id,session_id,participant_user_id,roster_json) values($1,$2,$3,$4,$5::jsonb)`,[id(8010+i),soloEvent,id(8000),id(7700+i),JSON.stringify([id(7700+i)])]);
 const soloRows=[0,1].map(i=>({registrationId:id(8010+i),gameId:id(8002),groupId:id(8001),teamId:null,userId:id(7700+i),name:`Solo ${i}`,played:true,place:i+1,kills:5-i,points:17-i*4,rounds:null,detail:'players',players:[{id:id(7700+i),userId:id(7700+i),nickname:`Solo ${i}`,played:true,kills:5-i,deaths:0,assists:0}],reason:'no_show',fieldSize:2}));
 const soloDoc={rules:soloConfig.rules,rows:soloRows,standings:soloRows.map(r=>({...r,gamesPlayed:1,wins:r.place===1?1:0,placeSum:r.place,bonus:0,manual:false})),mvps:[]};
 const soloSave=async(rev,nominations)=>db.query(`select u2_save_results($1,$2,$3,(select configuration_revision from event_sessions where id=$2),$4,'solo-nominations',$5::jsonb,$6::jsonb,false,$7::jsonb)`,[id(1),id(8000),rev,id(++request),JSON.stringify({rows:soloRows,warnings:[],manualOrder:[]}),JSON.stringify(soloDoc),JSON.stringify(nominations.flatMap(nomination=>[0,1].map(i=>({userId:id(7700+i),nomination,place:i+1,participants:2}))))]);
 await soloSave(0,['points','kills']);
 assert.equal(Number(await scalar(`select exact_rating from competition_ratings where target_type='player' and target_id=$1 and mode='solo'`,[id(7700)])),28.72);
 await soloSave(1,['points']);
 assert.equal(Number(await scalar(`select exact_rating from competition_ratings where target_type='player' and target_id=$1 and mode='solo'`,[id(7700)])),14.86);
 assert.deepEqual((await db.query(`select games,kills from competition_ratings where target_type='player' and target_id=$1 and mode='solo'`,[id(7700)])).rows[0],{games:1,kills:5});
 assert.equal(Number(await scalar('select count(*) from competition_solo_contributions where session_id=$1',[id(8000)])),2);
 console.log('PASS: acceptance reputation clamp/cancellation, five-warning global union, thirty-day end without repeat sanction, seven days from late issuance, three-warning organizer scope and team-only personal enrichment without duplicate facts');
}
