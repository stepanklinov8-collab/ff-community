import assert from 'node:assert/strict';

export async function verifyPlayerRating999(db,id,base){
 const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
 const user=id(97001),other=id(97002),team=id(97003),opponent=id(97004),session=id(97005),group=id(97006);
 for(const [uid,name] of [[user,'Rating Player'],[other,'Rating Rival']]){
  await db.query('insert into auth.users(id) values($1)',[uid]);
  await db.query('insert into profiles(id,nickname) values($1,$2)',[uid,name]);
 }
 await db.query("insert into teams(id,name) values($1,'Rating A'),($2,'Rating B')",[team,opponent]);
 const config=structuredClone(base);config.type='training';config.rules={...base.rules,mode:'training',mvpEnabled:false};
 const startTime=new Date(Date.now()+86400000).toISOString();
 config.sessions=[{...base.sessions[0],id:session,startTime,endTime:new Date(Date.parse(startTime)+3600000).toISOString(),groups:[{id:group,name:'Rating',capacity:12,games:Array.from({length:10},(_,i)=>({id:id(97010+i),map:i%2?'solara':'bermuda'}))}]}];
 const event=(await scalar('select u2_event_configuration($1,null,0,$2::jsonb)',[id(1),JSON.stringify(config)])).eventId;
 await db.query("insert into rating_event_settings(event_id,category,hidden_coefficient) values($1,'official',1)",[event]);
 const registrationA=id(97030),registrationB=id(97031);
 await db.query("insert into event_registrations(id,event_id,session_id,group_id,team_id,roster_json) values($1,$2,$3,$4,$5,$6::jsonb),($7,$2,$3,$4,$8,$9::jsonb)",
  [registrationA,event,session,group,team,JSON.stringify([user]),registrationB,opponent,JSON.stringify([other])]);
 await db.query('select u4_snapshot_game_forecasts()');
 assert.equal((await db.query('select expected_place from competition_game_forecasts where game_id=$1 and team_id=$2',[id(97010),team])).rows.length,0,
  'Without prior games on this map, there is no invented place forecast and D remains zero');
 await db.query('delete from competition_game_forecasts where game_id=any($1::uuid[])',[config.sessions[0].groups[0].games.map(game=>game.id)]);
 const rows=config.sessions[0].groups[0].games.flatMap(({id:gameId})=>[[registrationA,team,user,1,'Rating A'],[registrationB,opponent,other,2,'Rating B']].map(([registrationId,teamId,userId,place,name])=>({
  registrationId,gameId,groupId:group,teamId,userId:null,name,played:true,place,kills:5,points:10,rounds:null,detail:'players',reason:'no_show',fieldSize:2,
  players:[{id:userId,userId,nickname:userId===user?'Rating Player':'Rating Rival',played:true,kills:5,deaths:0,assists:0}]
 })));
 const standings=[[registrationA,team,user,1,'Rating A'],[registrationB,opponent,other,2,'Rating B']].map(([registrationId,teamId,,place,name])=>({
  registrationId,teamId,userId:null,groupId:group,name,place,kills:50,points:100,placeSum:10*place,wins:place===1?10:0,gamesPlayed:10,bonus:0,manual:false
 }));
 const published={rules:config.rules,rows,standings,mvps:[]};
 const draft={rows,warnings:[],manualOrder:[]};
 const revision=Number(await scalar('select configuration_revision from event_sessions where id=$1',[session]));
 await db.query('select u2_save_results($1,$2,0,$3,$4,$5,$6::jsonb,$7::jsonb)',[id(1),session,revision,id(97040),'rating',JSON.stringify(draft),JSON.stringify(published)]);
 assert.equal(await scalar('select u4_complete_rating_session($1)',[session]),true);
 const rating=()=>scalar("select exact_rating from competition_ratings where target_type='player' and target_id=$1 and mode='main'",[user]);
 assert.equal(Number(await rating()),22.6,'A=5/10+5/5+1*3=4.5, US=5, placement bonus=.1');
 const personalStats=await scalar('select u4_player_main_statistics($1)',[user]);
 assert.equal(Number(personalStats.games),10);assert.equal(Number(personalStats.kills),50);assert.equal(Number(personalStats.wins),1);
 const teamRating=()=>scalar("select exact_rating from competition_ratings where target_type='team' and target_id=$1 and mode='main'",[team]);
 assert.ok(Math.abs(Number(await teamRating())-200.2995)<.000001,'One session contributes once, with D=0 when no map history exists');
 await db.exec('begin');
 await db.query('insert into competition_game_forecasts(game_id,team_id,map_name,strength,expected_place) values($1,$2,$3,10,0)',[id(97010),team,'bermuda']);
 assert.ok(Math.abs(Number(await scalar('select recalculate_organization_rating($1)',[team]))-217.782)<.000001,
  'One forecast among ten games changes only one tenth of the session expectation');
 await db.exec('rollback');
 await db.exec('begin');
 const noKill=structuredClone(published);
 noKill.rows.find(row=>row.gameId===id(97019)&&row.teamId===team).kills=0;
 noKill.rows.find(row=>row.gameId===id(97019)&&row.teamId===team).players[0].kills=0;
 noKill.rows.find(row=>row.gameId===id(97019)&&row.teamId===opponent).kills=0;
 noKill.rows.find(row=>row.gameId===id(97019)&&row.teamId===opponent).players[0].kills=0;
 await db.query('update competition_publications set published=$2::jsonb where session_id=$1',[session,JSON.stringify(noKill)]);
 await db.query('update competition_team_facts set kills=0 where game_id=$1 and team_id=$2',[id(97019),team]);
 await db.query('update competition_team_facts set kills=0 where game_id=$1 and team_id=$2',[id(97019),opponent]);
 await db.query('update competition_player_facts set kills=0 where game_id=$1 and user_id=$2',[id(97019),user]);
 assert.equal(Number(await scalar('select recalculate_player_rating($1)',[user])),18.775,'Even an all-zero game gives a fixed quarter team share and zero global share');
 const guest=structuredClone(published);
 const guestRow=guest.rows.find(row=>row.gameId===id(97019)&&row.teamId===team);
 guestRow.players[0].kills=0;
 guestRow.players.push({id:id(97050),userId:null,nickname:'Guest',played:true,kills:5,deaths:0,assists:0});
 await db.query('update competition_publications set published=$2::jsonb where session_id=$1',[session,JSON.stringify(guest)]);
 await db.query('update competition_team_facts set kills=5 where game_id=$1',[id(97019)]);
 assert.equal(Number(await scalar('select recalculate_player_rating($1)',[user])),18.325,'With team kills, a zero-kill player has zero share');
 await db.exec('rollback');
 assert.equal(Number(await scalar("select wins from competition_ratings where target_type='player' and target_id=$1 and mode='main'",[user])),1,'Ten games in one session mean one win');
 await db.query('delete from competition_player_facts where game_id=$1 and user_id=$2',[id(97019),user]);
 assert.equal(await scalar('select recalculate_player_rating($1)',[user]),null,'Nine games do not qualify');
 assert.equal((await db.query("select * from competition_ratings where target_type='player' and target_id=$1 and mode='main'",[user])).rows.length,0);
 await db.query("insert into competition_player_facts(session_id,game_id,registration_id,user_id,team_id,mode,nickname,kills,deaths,assists,place,field_size) values($1,$2,$3,$4,$5,'training','Rating Player',5,0,0,1,2)",[session,id(97019),registrationA,user,team]);
 assert.equal(Number(await scalar('select recalculate_player_rating($1)',[user])),22.6);
 await db.query('insert into competition_game_forecasts(game_id,team_id,map_name,strength,expected_place) values($1,$2,$3,10,.2)',[id(97010),team,'bermuda']);
 assert.equal(Number(await scalar('select recalculate_player_rating($1)',[user])),23.8,'Only the recorded game gains D=.8');
 await db.query("update rating_event_settings set category='season_final',hidden_coefficient=1.2 where event_id=$1",[event]);
 assert.equal(Number(await scalar('select recalculate_player_rating($1)',[user])),28.54,'Current coefficient reweights the full history');
 const incomplete=structuredClone(published);incomplete.rows[0].detail='team';
 await db.query('update competition_publications set published=$2::jsonb where session_id=$1',[session,JSON.stringify(incomplete)]);
 assert.equal(await scalar('select u4_complete_rating_session($1)',[session]),false);
 assert.equal(await scalar('select recalculate_player_rating($1)',[user]),null,'A single incomplete row excludes the whole session');
 assert.equal(Number((await scalar('select u4_player_main_statistics($1)',[user])).games),0,'Incomplete session is also excluded from visible personal totals');
 const upcoming=structuredClone(config),nextSession=id(97060),nextGroup=id(97061),thirdTeam=id(97062);
 await db.query("insert into teams(id,name) values($1,'Map newcomer')",[thirdTeam]);
 const nextStart=new Date(Date.now()+36*3600000).toISOString();
 upcoming.sessions=[{...config.sessions[0],id:nextSession,startTime:nextStart,
  endTime:new Date(Date.parse(nextStart)+3600000).toISOString(),groups:[{id:nextGroup,name:'Next field',capacity:12,
   games:[{id:id(97063),map:'bermuda'},{id:id(97064),map:'kalahari'}]}]}];
 const nextEvent=(await scalar('select u2_event_configuration($1,null,0,$2::jsonb)',[id(1),JSON.stringify(upcoming)])).eventId;
 for(const [i,teamId] of [team,opponent,thirdTeam].entries())
  await db.query('insert into event_registrations(id,event_id,session_id,group_id,team_id,roster_json) values($1,$2,$3,$4,$5,$6::jsonb)',
   [id(97065+i),nextEvent,nextSession,nextGroup,teamId,JSON.stringify([])]);
 await db.query('select u4_snapshot_game_forecasts()');
 const priorWinner=(await db.query('select predicted_place,place_probability,sample_size,expected_place,place_probabilities from competition_game_forecasts where game_id=$1 and team_id=$2',[id(97063),team])).rows[0];
 assert.equal(Number(priorWinner.predicted_place),1);assert.equal(Number(priorWinner.sample_size),5);
 assert.equal(Number(priorWinner.place_probability),1);assert.equal(Number(priorWinner.expected_place),1);
 assert.equal(Number(priorWinner.place_probabilities['1']),1);
 assert.equal(Number(await scalar('select predicted_place from competition_game_forecasts where game_id=$1 and team_id=$2',[id(97063),opponent])),3,
  'Second of two past teams maps to third in a three-team field');
 assert.equal((await db.query('select * from competition_game_forecasts where game_id=$1',[id(97064)])).rows.length,0,
  'A map without history gets no fabricated forecast');
 console.log('PASS: ten-game threshold, player share, unique session win, placement bonus, map/field-size forecast, team session rating, full-history weight change and incomplete-session exclusion');
}
