import assert from 'node:assert/strict';
export async function verifyContinuity(db,id,base){
 const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
 const config=structuredClone(base);config.sessions=[{...base.sessions[0],id:id(5100),groups:[{id:id(5101),name:'Notice',capacity:12,games:[{id:id(5102),map:'bermuda'}]}]}];
 const event=(await scalar('select u2_event_configuration($1,null,0,$2::jsonb)',[id(1),JSON.stringify(config)])).eventId;
 await db.query(`insert into event_registrations(event_id,session_id,team_id,roster_json) values($1,$2,$3,$4::jsonb)`,[event,id(5100),id(110),JSON.stringify([id(2)])]);
 const noticesBefore=Number(await scalar('select count(*) from competition_notification_outbox'));
 await db.query(`select u2_session_action($1,$2,'room',$3::jsonb)`,[id(1),id(5100),JSON.stringify({groupId:id(5101),code:'SECRET-CODE',password:'SECRET-PASSWORD',note:'PRIVATE-NOTE'})]);
 assert.ok(Number(await scalar('select count(*) from competition_notification_outbox'))>noticesBefore);
 assert.equal(Number(await scalar(`select count(*) from competition_notification_outbox where body like '%SECRET-%' or body like '%PRIVATE-NOTE%'`)),0);
 const noticesAfter=Number(await scalar('select count(*) from competition_notification_outbox'));
 await db.query(`select u2_session_action($1,$2,'room',$3::jsonb)`,[id(1),id(5100),JSON.stringify({groupId:id(5101),code:'SECRET-CODE',password:'SECRET-PASSWORD',note:'PRIVATE-NOTE'})]);
 assert.equal(Number(await scalar('select count(*) from competition_notification_outbox')),noticesAfter,'No notification for identical room');
 await db.query(`update events set frozen_at=now() where id=$1`,[event]);
 await db.query(`update event_sessions set start_time=now()+interval '5 minutes' where id=$1`,[id(5100)]);
 await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[id(3)]);
 await db.query(`insert into bans(id,target_type,target_id,reason,created_by) values($1,'player',$2,'Test',$3)`,[id(5103),id(2),id(1)]);
 await db.query(`select set_config('request.jwt.claim.sub','',false)`);
 assert.deepEqual(await scalar(`select roster_json from event_registrations where session_id=$1`,[id(5100)]),[],'Manual site ban removes future player only');
 await db.query(`update bans set is_active=false where id=$1`,[id(5103)]);
 await db.query(`update events set frozen_at=null where id=$1`,[event]);

 const warConfig={creatorTeamId:id(110),opponentTeamId:id(111),title:'Configuration test',description:'Note',rules:'Rules',format:4,challengeKind:'direct',scheduledAt:new Date(Date.now()+86400000).toISOString(),gameCount:3,winsRequired:2,maps:['bermuda','solara','kalahari'],roomCode:'PRIVATE-CODE',roomPassword:'PRIVATE-PASSWORD',roomNote:'Note',commentsClosed:false};
 await db.query(`insert into clan_wars(id,creator_team_id,opponent_team_id,created_by,title,status,scheduled_at) values($1,$2,$3,$4,'Before','agreed',$5)`,[id(5200),id(110),id(111),id(2),warConfig.scheduledAt]);
 const initialGame=(await db.query('select id,public_number from clan_war_games where clan_war_id=$1',[id(5200)])).rows[0];
 const edit=async(actor,config)=>db.query(`select u2_war_configuration($1,$2,(select configuration_revision from clan_wars where id=$2),$3::jsonb)`,[id(actor),id(5200),JSON.stringify(config)]);
 await assert.rejects(()=>edit(2000,warConfig),/Нет прав/);
 await edit(2,warConfig);
 assert.equal(await scalar('select id from clan_war_games where clan_war_id=$1 and game_number=1 and is_active',[id(5200)]),initialGame.id);
 const oldThird=await scalar('select id from clan_war_games where clan_war_id=$1 and game_number=3 and is_active',[id(5200)]);
 await edit(2,{...warConfig,gameCount:1,winsRequired:1,maps:['bermuda']});
 await edit(2,warConfig);
 assert.notEqual(await scalar('select id from clan_war_games where clan_war_id=$1 and game_number=3 and is_active',[id(5200)]),oldThird,'Removed game ID is never recycled');
 assert.equal(await scalar(`select has_column_privilege('anon','clan_wars','room_password','SELECT')`),false);
 assert.equal(await scalar(`select has_column_privilege('authenticated','clan_wars','room_code','SELECT')`),false);
 await db.query(`insert into clan_war_comments(author_id,clan_war_id,body) values($1,$2,'Before closing')`,[id(2),id(5200)]);
 await edit(2,{...warConfig,commentsClosed:true});
 await assert.rejects(()=>db.query(`insert into clan_war_comments(author_id,clan_war_id,body) values($1,$2,'Closed')`,[id(2),id(5200)]),/Обсуждение КВ закрыто/);
 await db.query(`update clan_wars set result_first_published_at=now() where id=$1`,[id(5200)]);
 await assert.rejects(()=>edit(2,{...warConfig,rules:'Changed sporting rules'}),/подтверждённой серии/);
 await edit(2,{...warConfig,title:'New title'});
 await db.query(`insert into clan_wars(id,creator_team_id,created_by,title,status,scheduled_at) values($1,$2,$3,'Unscheduled','open',null)`,[id(5210),id(110),id(2)]);
 await db.query(`insert into clan_war_comments(author_id,clan_war_id,body) values($1,$2,'Discuss schedule')`,[id(2),id(5210)]);
 await db.query(`update clan_wars set scheduled_at=now()+interval '9 minutes' where id=$1`,[id(5210)]);
 await assert.rejects(()=>db.query(`insert into clan_war_rosters(clan_war_id,team_id,player_ids,submitted_by) values($1,$2,array[$3::uuid],$3)`,[id(5210),id(110),id(2)]),/Состав уже закрыт/);
 await db.query(`insert into clan_war_rosters(clan_war_id,team_id,player_ids,submitted_by) values($1,$2,array[$3::uuid],$4)`,[id(5210),id(110),id(2),id(1)]);

 // An unscoped legacy aggregate remains inspectable when a canonical session appears.
 await db.query(`insert into player_stats(id,user_id,event_id,kills,matches_played,status) values($1,$2,$3,777,3,'approved')`,[id(5300),id(2),event]);
 await db.query(`insert into competition_publications(session_id,first_published_at,published) values($1,now(),'{"rows":[],"standings":[],"rules":{"mode":"tournament"}}')`,[id(5100)]);
 assert.equal(await scalar(`select source from competition_public_history where id=$1`,[id(5300)]),'legacy_unassigned');
 const result=await scalar(`select u2_leaderboard('main','player','',100,0,'kills')`);
 assert.ok(result.items.every(p=>p.kills<777),'Ambiguous aggregate does not double count');

 // Cancellation reverses a payout even for a previously published session.
 await db.query(`insert into betting_markets(id,event_id,game_id,mode) values($1,$2,$3,'tournament')`,[id(5400),event,id(5102)]);
 await db.query(`insert into site_bets(id,user_id,market_id,stake,odds,potential_payout) values($1,$2,$3,10,2,20)`,[id(5401),id(2),id(5400)]);
 await db.query(`select settle_betting_market($1,'won',$2)`,[id(5400),id(1)]);
 const balance=Number(await scalar('select balance from site_wallets where user_id=$1',[id(2)]));
 await db.query(`select u2_cancel_event($1,$2,'Entire event cancelled')`,[id(1),event]);
 assert.equal(Number(await scalar('select balance from site_wallets where user_id=$1',[id(2)])),balance-10);
 await db.query(`select u2_cancel_event($1,$2,'Retry')`,[id(1),event]);
 assert.equal(Number(await scalar('select balance from site_wallets where user_id=$1',[id(2)])),balance-10);
 // Fifth player's exact rating overtakes fourth while both still display 60.0.
 await db.query(`insert into teams(id,name,reputation_score) values($1,'Best four',50)`,[id(6106)]);
 for(let n=0;n<5;n++){
  await db.query(`insert into auth.users(id) values($1)`,[id(6100+n)]);
  await db.query(`insert into profiles(id,nickname) values($1,$2)`,[id(6100+n),`Exact ${n}`]);
  const value=[90,80,70,60.04,60.03][n];
  await db.query(`insert into competition_ratings(target_type,target_id,mode,exact_rating,display_rating) values('player',$1,'main',$2,round($2::numeric,1))`,[id(6100+n),value]);
  await db.query(`insert into team_members(team_id,user_id) values($1,$2)`,[id(6106),id(6100+n)]);
 }
 const beforeExact=Number(await scalar(`select exact_rating from competition_ratings where target_type='team' and target_id=$1 and mode='main'`,[id(6106)]));
 await db.query(`update competition_ratings set exact_rating=60.049 where target_type='player' and target_id=$1 and mode='main'`,[id(6104)]);
 const afterExact=Number(await scalar(`select exact_rating from competition_ratings where target_type='team' and target_id=$1 and mode='main'`,[id(6106)]));
 assert.ok(Math.abs((afterExact-beforeExact)-.98*.6*.009/4)<1e-10);
 assert.equal(Number(await scalar(`select reputation_score from teams where id=$1`,[id(6106)])),50);
 assert.equal(Number(await scalar(`select count(*) from organization_participation_history where organization_id=$1`,[id(6106)])),0);
 await db.query(`insert into organization_participation_history(id,organization_id,organization_name,mode,place,kills,result_status) values($1,$2,'Best four','tournament',1,10,'completed')`,[id(6107),id(6106)]);
 assert.ok(Number(await scalar('select results_score from teams where id=$1',[id(6106)]))>1);
 await db.query(`update organization_participation_history set mode='bo',correction_note='Correct mode',recorded_by=$2 where id=$1`,[id(6107),id(1)]);
 assert.equal(Number(await scalar('select results_score from teams where id=$1',[id(6106)])),1,'Changing out of the main mode removes its main-rating contribution');
 await assert.rejects(()=>db.query('select place_site_bet_for($1,$2,10)',[id(2),id(5400)]),/котировки/);
 console.log('PASS: private/idempotent room notices, manual-ban roster effects, shared KV configuration, persistent/deactivated game IDs, private rooms, KV comment closure, immutable confirmed rules, visible ambiguous legacy history, full-event settled payout reversal, exact best-four reordering and closed legacy bet bypass');
}
