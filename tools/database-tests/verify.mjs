import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {verifyAcceptance} from './acceptance.mjs';
import {verifyLegacyRegistration} from './legacy-registration.mjs';
import {verifyContinuity} from './continuity.mjs';
import {verifyDuels} from './duels.mjs';
import {verifyBetting} from './betting.mjs';
import {verifyLifecycle} from './lifecycle.mjs';
import {verifyStatistics} from './statistics.mjs';
import {verifyRegistrations} from './registrations.mjs';
const db=new PGlite();
try {
 await db.exec(await readFile(new URL('./baseline.sql',import.meta.url),'utf8'));
 const dynamic=await readFile(new URL('../../supabase/migrations/202609060005_dynamic_betting.sql',import.meta.url),'utf8');
 await db.exec(dynamic.slice(dynamic.indexOf('create table if not exists public.betting_sources'),dynamic.indexOf('create or replace function public.place_dynamic_site_bet_for(')));

 // Exercise the original organization results formula against new normalized publication history.
 const legacy=await readFile(new URL('../../supabase/migrations/202609060001_competitive_economy.sql',import.meta.url),'utf8');
 const start=legacy.indexOf('create or replace function public.recalculate_organization_results(');
 const end=legacy.indexOf('end $$;',start)+'end $$;'.length;
 await db.exec(legacy.slice(start,end));
 // Install the real pre-update triggers rather than testing against empty hooks.
 const security=await readFile(new URL('../../supabase/migrations/202609060002_competitive_security.sql',import.meta.url),'utf8');
 await db.exec(security.slice(security.indexOf('create or replace function public.audit_organization_history()'),security.indexOf('create or replace function public.apply_reputation_review(')));
 for(const [functionName,table,triggerName,event] of [
  ['refresh_player_rating_from_stats','player_stats','refresh_player_rating_trigger','after insert or update or delete'],
  ['refresh_organization_rating_from_player','profiles','refresh_organization_rating_from_player_trigger','after update of main_rating'],
  ['refresh_organization_rating_from_history','organization_participation_history','refresh_organization_rating_trigger','after insert or update or delete']
 ]) {
  const a=legacy.indexOf('create or replace function public.'+functionName+'()'),b=legacy.indexOf('end $$;',a)+9;
  await db.exec(legacy.slice(a,b));
  await db.exec(`create trigger ${triggerName} ${event} on public.${table} for each row execute function public.${functionName}()`);
 }

 for(const name of (await readdir(new URL('../../supabase/migrations/',import.meta.url))).filter(n=>n.startsWith('20260922')).sort()){
  const sql=await readFile(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8');
  try{await db.exec(sql);console.log('Migration OK:',name);}
  catch(error){console.error('Migration failed:',name,error.message,error.where,'position',error.position,'near',sql.slice(Math.max(0,Number(error.position)-150),Number(error.position)+100));throw error;}
 }
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 await db.query(`insert into auth.users(id) values($1),($2),($3)`,[id(1),id(2),id(3)]);
 await db.query(`insert into public.user_roles values($1,'admin')`,[id(1)]);
 await db.query(`insert into public.profiles(id,nickname) values($1,'Admin'),($2,'Player'),($3,'Other')`,[id(1),id(2),id(3)]);
 await db.query(`insert into public.site_wallets(user_id,balance) values($1,0)`,[id(2)]);
 await db.query(`insert into public.betting_markets(id,mode) values($1,'tournament')`,[id(10)]);
 await db.query(`insert into public.site_bets(id,user_id,market_id,stake,odds,potential_payout) values($1,$2,$3,10,10,100)`,[id(11),id(2),id(10)]);
 await db.query(`select public.settle_betting_market($1,'won',$2)`,[id(10),id(1)]);
 await db.query(`update public.site_wallets set balance=0 where user_id=$1`,[id(2)]);
 await db.query(`select public.settle_betting_market($1,'lost',$2)`,[id(10),id(1)]);
 assert.equal((await db.query(`select balance from public.site_wallets where user_id=$1`,[id(2)])).rows[0].balance,-100);
 await db.query(`select public.settle_betting_market($1,'lost',$2)`,[id(10),id(1)]);
 assert.equal((await db.query(`select count(*)::integer n from public.currency_ledger`)).rows[0].n,2);
 console.log('PASS: reversal, negative balance and idempotent settlement');
 const warn=n=>({id:id(n),targetType:'player',targetId:id(2),reason:'Test',duration:'permanent',penalty:20,source:'manual',category:'chat'});
 for(const n of [20,21,22])await db.query(`select public.u2_moderation_action($1,$2::jsonb)`,[id(1),JSON.stringify({action:'issue_warning',warning:warn(n)})]);
 const sanction=(await db.query(`select * from public.competition_sanctions where target_id=$1`,[id(2)])).rows[0];
 assert.deepEqual(sanction.scopes,['public_comments','chat']);
 assert.equal((await db.query(`select reputation_score from public.profiles where id=$1`,[id(2)])).rows[0].reputation_score,'1');
 await db.query(`select public.u2_lift_sanction($1,$2)`,[id(1),sanction.id]);
 assert.equal((await db.query(`select reputation_score from public.profiles where id=$1`,[id(2)])).rows[0].reputation_score,'50');
 await db.query(`select public.u2_check_warning_thresholds('player',$1,$2)`,[id(2),id(1)]);
 assert.equal((await db.query(`select count(*)::integer n from public.competition_sanctions where target_id=$1`,[id(2)])).rows[0].n,1);
 console.log('PASS: fixed warning cycle, immediate reputation restoration and no reused warnings');
 const future=new Date(Date.now()+86400000).toISOString(),endFuture=new Date(Date.now()+90000000).toISOString();
 const config={title:'Test event',type:'tournament',cost:0,organizer:'Admin',organizerUserId:id(1),description:'',rulesText:'',streamUrl:'',paymentUrl:'',imageUrl:'',
 maxTeams:1024,minPlayers:1,publishAt:null,commentsEnabled:true,allowIndividualRegistration:false,finalSessionId:null,
 rules:{mode:'tournament',criterion:'points',placePoints:[12,9,8,7,6,5,4,3,2,1],killPoints:1,bonuses:{},nominations:['points'],ratingEnabled:true,winsRequired:1},
 sessions:[{id:id(101),startTime:future,endTime:endFuture,registrationOpenTime:null,registrationCloseTime:null,maxTeams:1024,responsibleUserId:id(3),description:'',stage:'ordinary',sourceSessionId:null,qualification:{},reminderMinutes:[60],groups:[{id:id(102),name:'A',capacity:12,games:[{id:id(103),map:'bermuda'},{id:id(104),map:'kalahari'}]}]}]};
 const created=(await db.query(`select public.u2_event_configuration($1,null,0,$2::jsonb) value`,[id(1),JSON.stringify(config)])).rows[0].value;
 assert.ok(created.eventId);
 const firstGame=(await db.query(`select public_number from public.event_games where id=$1`,[id(103)])).rows[0].public_number;
 await db.query(`insert into public.betting_markets(id,mode,game_id) values($1,'tournament',$2)`,[id(1500),id(103)]);
 config.sessions[0].groups[0].games.reverse();
 await db.query(`select public.u2_event_configuration($1,$2,1,$3::jsonb)`,[id(1),created.eventId,JSON.stringify(config)]);
 assert.equal((await db.query(`select public_number from public.event_games where id=$1`,[id(103)])).rows[0].public_number,firstGame);
 assert.equal((await db.query(`select status from public.betting_markets where id=$1`,[id(1500)])).rows[0].status,'open');
 console.log('PASS: transactional creation and persistent game IDs across reorder');
 await db.query(`insert into public.teams(id,name) values($1,'Team A'),($2,'Team B')`,[id(110),id(111)]);
 await db.query(`insert into public.event_registrations(id,event_id,session_id,team_id,group_id,roster_json) values($1,$2,$3,$4,$5,$6::jsonb),($7,$2,$3,$8,$5,'[]')`,[id(120),created.eventId,id(101),id(110),id(102),JSON.stringify([id(2)]),id(121),id(111)]);
 const configurationRevision=(await db.query(`select configuration_revision from public.event_sessions where id=$1`,[id(101)])).rows[0].configuration_revision;
 const resultRows=[103,104].flatMap(game=>[120,121].map((reg,index)=>({registrationId:id(reg),gameId:id(game),played:true,reason:'no_show',detail:'team',place:index+1,kills:index?1:10,points:index?10:22,rounds:null,players:[],fieldSize:2,teamId:id(110+index),userId:null,name:index?'Team B':'Team A',groupId:id(102)})));
 const standings=[120,121].map((reg,index)=>({registrationId:id(reg),teamId:id(110+index),userId:null,groupId:id(102),name:index?'Team B':'Team A',place:index+1,kills:index?2:20,points:index?20:44,placeSum:index?4:2,wins:index?0:2,gamesPlayed:2,bonus:0,manual:false}));
 const draft={rows:resultRows,warnings:[],manualOrder:[],snapshots:[{registrationId:id(120),name:'Team A',roster:[{id:id(2),nickname:'Player'}]}]};
 const published={rows:resultRows,standings,rules:config.rules,mvps:[]};
 const save=async(requestId,rev,doc=published,actor=id(1))=>(await db.query(`select public.u2_save_results($1,$2,$3,$4,$5,'test',$6::jsonb,$7::jsonb) value`,[actor,id(101),rev,configurationRevision,requestId,JSON.stringify(draft),JSON.stringify(doc)])).rows[0].value;
 const first=await save(id(130),0);assert.equal(first.revision,1);
 assert.equal((await save(id(130),0)).revision,1);
 assert.equal((await db.query(`select count(*)::integer n from public.competition_team_facts`)).rows[0].n,4);
 assert.equal((await db.query(`select count(*)::integer n from public.competition_player_facts`)).rows[0].n,0);
 await assert.rejects(()=>save(id(131),0),/Конфликт версии/);
 await db.query(`update public.competition_publications set first_published_at=now()-interval '15 minutes' where session_id=$1`,[id(101)]);
 await assert.rejects(()=>save(id(132),1,published,id(3)),/Срок исправления/);
 const broken=structuredClone(published);broken.rows[0].players=[{id:id(999),userId:id(999),nickname:'Invalid',played:true,kills:1,deaths:0,assists:0}];
 await assert.rejects(()=>save(id(133),1,broken));
 assert.equal((await db.query(`select revision from public.competition_publications where session_id=$1`,[id(101)])).rows[0].revision,1);
 assert.equal((await db.query(`select count(*)::integer n from public.competition_team_facts`)).rows[0].n,4);
 console.log('PASS: full publication, team-only stats, idempotency, edit boundary, optimistic locking and transaction rollback');
 const pictures=Array.from({length:10},(_,n)=>({path:`${id(101)}/${id(103)}/${id(200+n)}.png`,name:`proof-${n}.png`,mimeType:'image/png'}));
 await db.query(`select public.u2_evidence($1,$2,$3,'add',$4::jsonb)`,[id(1),id(101),id(103),JSON.stringify(pictures)]);
 await assert.rejects(()=>db.query(`select public.u2_evidence($1,$2,$3,'add',$4::jsonb)`,[id(1),id(101),id(103),JSON.stringify([{...pictures[0],path:`${id(101)}/${id(103)}/extra.png`}])]),/не более 10/);
 await assert.rejects(()=>db.query(`select public.u2_evidence($1,$2,$3,'replay')`,[id(3),id(101),id(103)]),/Срок исправления/);
 await db.query(`select public.u2_evidence($1,$2,$3,'replay')`,[id(1),id(101),id(103)]);
 assert.equal((await db.query(`select count(*)::integer n from public.competition_evidence`)).rows[0].n,0);
 assert.equal((await db.query(`select count(*)::integer n from public.competition_storage_cleanup`)).rows[0].n,10);
 assert.equal((await db.query(`select public_number from public.event_games where id=$1`,[id(103)])).rows[0].public_number,firstGame);
 console.log('PASS: evidence limit, edit permission, replay cleanup and retained game ID');
 await db.query(`insert into public.team_members(team_id,user_id,role_in_team) values($1,$2,'leader'),($1,$3,'deputy')`,[id(110),id(2),id(3)]);
 const blocked=(await db.query(`select public.u2_moderation_action($1,$2::jsonb) value`,[id(1),JSON.stringify({action:'blacklist_add',organizerId:id(1),targetType:'team',targetId:id(110),reason:'Private reason'})])).rows[0].value.id;
 assert.equal((await db.query(`select public.u2_is_restricted('team',$1,'events',$2,$3) blocked`,[id(110),id(1),created.eventId])).rows[0].blocked,true);
 const appeal={action:'appeal',sourceType:'blacklist',sourceId:blocked,recipientId:id(1),message:'Please review',evidence:[]};
 const appealId=(await db.query(`select public.u2_moderation_action($1,$2::jsonb) value`,[id(2),JSON.stringify(appeal)])).rows[0].value.id;
 await assert.rejects(()=>db.query(`select public.u2_moderation_action($1,$2::jsonb)`,[id(3),JSON.stringify(appeal)]),/уже обжаловано/);
 await assert.rejects(()=>db.query(`select public.u2_moderation_action($1,$2::jsonb)`,[id(2),JSON.stringify({action:'decide_appeal',id:appealId,approve:true,answer:'Self approve'})]),/Нет доступа/);
 await db.query(`select public.u2_moderation_action($1,$2::jsonb)`,[id(1),JSON.stringify({action:'decide_appeal',id:appealId,approve:true,answer:'Removed',cancelWarning:false,liftSanction:false})]);
 assert.equal((await db.query(`select public.u2_is_restricted('team',$1,'events',$2,$3) blocked`,[id(110),id(1),created.eventId])).rows[0].blocked,false);
 assert.equal((await db.query(`select has_table_privilege('authenticated','public.competition_appeals','SELECT') allowed`)).rows[0].allowed,false);
 assert.equal((await db.query(`select has_column_privilege('authenticated','public.warnings','cancellation_reason','SELECT') allowed`)).rows[0].allowed,false);
 console.log('PASS: private blacklist and appeals, one appeal across team representatives, recipient authorization');
 const insertComment=()=>db.query(`insert into public.comments(author_id,event_id,session_id,body) values($1,$2,$3,'Test')`,[id(2),created.eventId,id(101)]);
 await insertComment();
 await db.query(`update public.competition_publications set first_published_at=now()-interval '30 hours',corrected_at=now()-interval '25 hours' where session_id=$1`,[id(101)]);
 await assert.rejects(insertComment,/Обсуждение.*закрыто/);
 await db.query(`update public.competition_publications set corrected_at=now() where session_id=$1`,[id(101)]);
 await insertComment();
 await assert.rejects(()=>db.query(`select public.u2_session_action($1,$2,'comments','{"closed":true}')`,[id(3),id(101)]),/закрывает организатор/);
 await db.query(`select public.u2_session_action($1,$2,'comments','{"closed":true}')`,[id(1),id(101)]);
 await assert.rejects(insertComment,/Обсуждение.*закрыто/);
 await db.query(`select public.u2_session_action($1,$2,'comments','{"closed":false}')`,[id(1),id(101)]);
 console.log('PASS: 24-hour publication/correction discussion window and explicit organizer closure');
 const ownConfig=structuredClone(config);ownConfig.organizerUserId=id(2);ownConfig.sessions[0].id=id(300);ownConfig.sessions[0].groups[0].id=id(301);ownConfig.sessions[0].groups[0].games=[{id:id(302),map:'bermuda'}];
 const proposed=(await db.query(`select public.u2_event_configuration($1,null,0,$2::jsonb) value`,[id(2),JSON.stringify(ownConfig)])).rows[0].value;
 assert.equal(proposed.pending,true);
 await db.query(`select public.u2_event_configuration($1,$2,1,$3::jsonb,true)`,[id(1),proposed.eventId,JSON.stringify(ownConfig)]);
 ownConfig.description='New ordinary description';
 assert.equal((await db.query(`select public.u2_event_configuration($1,$2,2,$3::jsonb) value`,[id(2),proposed.eventId,JSON.stringify(ownConfig)])).rows[0].value.pending,false);
 ownConfig.cost=15;
 assert.equal((await db.query(`select public.u2_event_configuration($1,$2,3,$3::jsonb) value`,[id(2),proposed.eventId,JSON.stringify(ownConfig)])).rows[0].value.pending,true);
 assert.equal((await db.query(`select cost from public.events where id=$1`,[proposed.eventId])).rows[0].cost,0);
 await db.query(`select public.u2_organizer_action($1,'{"action":"apply","message":"Application"}')`,[id(2)]);
 await db.query(`select public.u2_organizer_action($1,$2::jsonb)`,[id(1),JSON.stringify({action:'review',userId:id(2),status:'approved'})]);
 assert.equal((await db.query(`select public.u2_event_configuration($1,$2,4,$3::jsonb) value`,[id(2),proposed.eventId,JSON.stringify(ownConfig)])).rows[0].value.pending,false);
 console.log('PASS: every unverified organizer event needs approval, pending fees do not leak, golden organizer publishes directly');
 await verifyDuels(db,id);
 await verifyRegistrations(db,id,config);
 await verifyStatistics(db,id);
 await verifyLifecycle(db,id,config);
 await verifyBetting(db,id,config);
 await verifyContinuity(db,id,config);
 await verifyLegacyRegistration(db,id,config);
 await verifyAcceptance(db,id,config);
} catch(error){console.error('FAILED:',error.message,error.where??'',error.detail??'');process.exitCode=1;} finally {await db.close();}
