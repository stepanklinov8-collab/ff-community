import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {defaultTerms} from '../../src/modules/contracts/model.ts';

export async function verifyContractGuests(db,id){
 const hostOwner=id(19000),homeOwner=id(19001),guildOwner=id(19002),player=id(19003),member=id(19004),other=id(19005);
 const host=id(19010),home=id(19011),guild=id(19012),event=id(19020),session=id(19021),second=id(19024),group=id(19022),game=id(19023);
 const main=id(19030),guildMain=id(19031),guest=id(19032),day=86400000,now=Math.floor(Date.now()/1000)*1000,iso=t=>new Date(t).toISOString();
 for(const user of [hostOwner,homeOwner,guildOwner,player,member,other]){await db.query('insert into auth.users(id) values($1)',[user]);await db.query('insert into profiles(id,nickname) values($1,$2)',[user,'Guest '+user.slice(-4)]);}
 await db.query("insert into user_roles(user_id,role) values($1,'superadmin')",[hostOwner]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[hostOwner]);
 for(const[t,owner,type]of[[host,hostOwner,'team'],[home,homeOwner,'team'],[guild,guildOwner,'guild']])await db.query('insert into teams(id,name,type,leader_id,verified) values($1,$2,$3,$4,true)',[t,'Guest organization '+t.slice(-4),type,owner]);
 await db.query("insert into team_members(team_id,user_id,role_in_team) values($1,$2,'main'),($3,$2,'main'),($4,$5,'main')",[home,player,guild,host,member]);
 await db.query("insert into events(id,title,type,organizer_user_id,is_published,moderation_status,min_players,cost,prize_plan) values($1,'Guest training sessions','training',$2,true,'approved',1,0,'[]')",[event,hostOwner]);
 for(const[s,offset]of[[session,2],[second,3]]){
  await db.query('insert into event_sessions(id,event_id,start_time,end_time,registration_open_time,registration_close_time) values($1,$2,$3,$4,$5,$6)',[s,event,iso(now+offset*day),iso(now+offset*day+3600000),iso(now-day),iso(now+offset*day-60000)]);
  const g=s===session?group:id(19025),gm=s===session?game:id(19026);
  await db.query("insert into event_groups(id,session_id,public_number,display_order,name,capacity) values($1,$2,1,1,'Main',12)",[g,s]);
  await db.query("insert into event_games(id,event_id,session_id,group_id,game_number,public_number,map_name) values($1,$2,$3,$4,1,1,'bermuda')",[gm,event,s,g]);
 }
 for(const[c,t,policy,compensation]of[[main,home,'forbidden',{kind:'none'}],[guildMain,guild,'consent',{kind:'fixed',amount:50}]]){
  const terms=defaultTerms(new Date(now-10*day));terms.guestPolicy=policy;terms.guestCompensation=compensation;
  await db.query("insert into organization_contracts(id,organization_id,player_id,kind,created_by) values($1,$2,$3,'main',$4)",[c,t,player,hostOwner]);
  await db.query("insert into organization_contract_versions(contract_id,revision,terms,created_by,status) values($1,1,$2::jsonb,$3,'offered')",[c,JSON.stringify(terms),hostOwner]);
  await db.query('insert into contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at) values($1,1,$2,$3,1,$4,$4)',[c,t===home?homeOwner:guildOwner,player,iso(now-10*day)]);
 }
 const wallet=async(actor,action,input)=>(await db.query('select u6_coin_action($1,$2,$3,$4::jsonb) value',[actor,randomUUID(),action,JSON.stringify(input)])).rows[0].value;
 const mutate=async(actor,input)=>(await db.query('select contract_mutate($1,$2::jsonb) value',[actor,JSON.stringify({requestId:randomUUID(),...input})])).rows[0].value;
 const consent=async(actor,c,revision,homeContract,approve=true,key=randomUUID())=>(await db.query('select contract_guest_consent($1,$2,$3,$4,$5,$6) value',[actor,key,c,revision,homeContract,approve])).rows[0].value;
 const account=async(t)=>(await db.query('select coalesce((select balance::int from coin_accounts where team_id=$1),0) balance,coalesce((select reserved::int from coin_accounts where team_id=$1),0) reserved',[t])).rows[0];
 const rentalConditions=async(p,s)=>(await db.query('select contract_guest_home_terms($1,$2,$3) value',[p,host,iso(now+(s===session?2:3)*day)])).rows[0].value.map(h=>({organizationId:h.organizationId,compensation:h.compensation.kind==='percent'?{...h.compensation,basis:'player_payments'}:h.compensation}));
 const prepare=async(c,s,bonus=0)=>{
  const terms=defaultTerms(new Date(now));terms.endsAt=iso(now+(s===session?2:3)*day+3600000);terms.financial.signingAmount=bonus;
  terms.financial.rentalCompensations=await rentalConditions(player,s);
  await mutate(hostOwner,{action:'save',contractId:c,expectedRevision:0,organizationId:host,playerId:player,kind:'guest',eventId:event,sessionId:s,terms});
  await mutate(hostOwner,{action:'offer',contractId:c,revision:1});return terms;
 };
 await wallet(hostOwner,'adjust',{kind:'player',ownerId:hostOwner,amount:1000,reason:'Owner is not automatically guest compensation funder'});
 await prepare(guest,session,20);
 assert.equal((await db.query('select count(*)::int n from contract_guest_requirements where contract_id=$1',[guest])).rows[0].n,2,'both team and guild main agreements are inspected');
 await assert.rejects(()=>mutate(player,{action:'accept',contractId:guest,revision:1}),/CONTRACT_GUEST_CONSENT/);
 await assert.rejects(()=>consent(other,guest,1,main),/CONTRACT_FORBIDDEN/);
 await consent(homeOwner,guest,1,main,false);await consent(guildOwner,guest,1,guildMain);
 await assert.rejects(()=>mutate(player,{action:'accept',contractId:guest,revision:1}),/CONTRACT_GUEST_CONSENT/);
 const consentKey=randomUUID();await consent(homeOwner,guest,1,main,true,consentKey);await consent(homeOwner,guest,1,main,true,consentKey);
 await assert.rejects(()=>mutate(player,{action:'accept',contractId:guest,revision:1}),/CONTRACT_FUNDS/);
 assert.equal((await db.query('select count(*)::int n from contract_agreements where contract_id=$1',[guest])).rows[0].n,0);
 assert.equal((await db.query("select count(*)::int n from contract_signatures where contract_id=$1 and party='player'",[guest])).rows[0].n,0);
 assert.deepEqual((await db.query('select contract_guest_query($1,null) value',[other])).rows[0].value.items,[],'unrelated users cannot inspect the home-consent inbox');
 await db.query("select set_config('omcite.allow_organization_owner_transfer','on',false)");await db.query('update teams set owner_user_id=$2 where id=$1',[guild,other]);await db.query("select set_config('omcite.allow_organization_owner_transfer','off',false)");
 await assert.rejects(()=>mutate(player,{action:'accept',contractId:guest,revision:1}),/CONTRACT_GUEST_CONSENT/);
 await consent(other,guest,1,guildMain);
 await wallet(hostOwner,'adjust',{kind:'organization',ownerId:host,amount:100,reason:'Explicit host funding'});
 const accept={action:'accept',contractId:guest,revision:1,requestId:randomUUID()};assert.equal((await mutate(player,accept)).status,'signed');await mutate(player,accept);
 assert.deepEqual(await account(host),{balance:80,reserved:50});assert.deepEqual(await account(guild),{balance:0,reserved:0});
 assert.equal((await db.query('select balance::int n from coin_accounts where user_id=$1',[hostOwner])).rows[0].n,1000,'neither host signature nor guest compensation uses the owner personal account');
 assert.equal((await db.query('select count(*)::int n from team_members where team_id=$1 and user_id=$2',[host,player])).rows[0].n,0,'acceptance creates no permanent membership');
 assert.equal((await db.query('select contract_guest_can_play($1,$2,$3) eligible',[host,player,session])).rows[0].eligible,true);
 assert.equal((await db.query('select contract_guest_can_play($1,$2,$3) eligible',[host,player,second])).rows[0].eligible,false);
 const bonusPlayer=id(19600),bonusHome=id(19601),bonusMain=id(19602),bonusGuest=id(19603);
 await db.query('insert into auth.users(id) values($1)',[bonusPlayer]);await db.query("insert into profiles(id,nickname) values($1,'Full percentage guest')",[bonusPlayer]);
 await db.query("insert into teams(id,name,type,leader_id,verified) values($1,'Full percentage home','team',$2,true)",[bonusHome,homeOwner]);
 const homeTerms=defaultTerms(new Date(now-day));homeTerms.guestPolicy='allowed';homeTerms.guestCompensation={kind:'percent',basisPoints:10000};
 await db.query("insert into organization_contracts(id,organization_id,player_id,kind,created_by) values($1,$2,$3,'main',$4)",[bonusMain,bonusHome,bonusPlayer,homeOwner]);
 await db.query("insert into organization_contract_versions(contract_id,revision,terms,created_by,status) values($1,1,$2::jsonb,$3,'offered')",[bonusMain,JSON.stringify(homeTerms),homeOwner]);
 await db.query('insert into contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at) values($1,1,$2,$3,1,$4,$4)',[bonusMain,homeOwner,bonusPlayer,iso(now-day)]);
 const bonusTerms=defaultTerms(new Date(now));bonusTerms.endsAt=iso(now+3*day+3600000);bonusTerms.financial.signingAmount=10;
 bonusTerms.financial.rentalCompensations=await rentalConditions(bonusPlayer,second);
 await mutate(hostOwner,{action:'save',contractId:bonusGuest,expectedRevision:0,organizationId:host,playerId:bonusPlayer,kind:'guest',eventId:event,sessionId:second,terms:bonusTerms});await mutate(hostOwner,{action:'offer',contractId:bonusGuest,revision:1});await mutate(bonusPlayer,{action:'accept',contractId:bonusGuest,revision:1});
 assert.equal((await account(bonusHome)).balance,0,'new rental compensation is a separate host expense after participation, never a welcome-payment withholding');
 assert.equal((await db.query('select balance::int n from coin_accounts where user_id=$1',[bonusPlayer])).rows[0].n,10);
 const earlyAmendment=structuredClone(bonusTerms);earlyAmendment.financial.signingAmount=80;
 await mutate(hostOwner,{action:'save',contractId:bonusGuest,expectedRevision:1,organizationId:host,playerId:bonusPlayer,kind:'guest',eventId:event,sessionId:second,terms:earlyAmendment});await mutate(hostOwner,{action:'offer',contractId:bonusGuest,revision:2});await mutate(bonusPlayer,{action:'accept',contractId:bonusGuest,revision:2});
 assert.equal((await db.query('select contract_rental_bases($1,2) value',[bonusGuest])).rows[0].value.playerPayments,10,'amending a rental does not hide its original welcome receipt from the fee base or issue a new bonus');
 const signing=(await db.query("select id from contract_obligations where contract_id=$1 and kind='signing'",[bonusGuest])).rows[0].id;
 await db.query('select contract_obligation_cancel($1,$2,$3,$4)',[hostOwner,randomUUID(),signing,'Owner cancels guest welcome payment']);
 assert.equal((await account(bonusHome)).balance,0);assert.equal((await db.query('select contract_player_debt_summary($1) value',[bonusPlayer])).rows[0].value.total,0,'100% home share cannot become an invented debt of a player who received nothing');
 const amended=structuredClone(bonusTerms);amended.financial.signingAmount=90;
 await mutate(hostOwner,{action:'save',contractId:bonusGuest,expectedRevision:2,organizationId:host,playerId:bonusPlayer,kind:'guest',eventId:event,sessionId:second,terms:amended});await mutate(hostOwner,{action:'offer',contractId:bonusGuest,revision:3});await mutate(bonusPlayer,{action:'accept',contractId:bonusGuest,revision:3});
 assert.equal((await db.query("select count(*)::int n from contract_obligations where contract_id=$1 and kind='signing'",[bonusGuest])).rows[0].n,1,'guest amendment cannot reissue the original welcome payment, including an owner-cancelled payment');
 assert.equal((await account(bonusHome)).balance,0);
 const available=(await db.query('select contract_available_guests($1,$2) value',[host,session])).rows[0].value;assert.deepEqual(available.map(p=>p.id),[player]);
 const registration=(await db.query('select * from register_team_for_session($1,$2,$3::uuid[])',[session,host,[member,player]])).rows[0].registration_id;
 assert.equal((await db.query('select u5_reserve_eligible($1) eligible',[registration])).rows[0].eligible,true);
 await db.query('select update_team_registration_roster($1,$2::uuid[])',[registration,[member]]);await db.query('select update_team_registration_roster($1,$2::uuid[])',[registration,[member,player]]);
 assert.ok((await db.query('select roster_snapshot from event_registrations where id=$1',[registration])).rows[0].roster_snapshot.some(p=>p.id===player));
 await assert.rejects(()=>db.query('select * from register_team_for_session($1,$2,$3::uuid[])',[second,host,[member,player]]),/outside this team/);
 const changed=id(19040);await prepare(changed,second);
 const revision2=defaultTerms(new Date(now+2.5*day));revision2.guestPolicy='allowed';
 await db.query('update contract_agreements set ended_at=$2,end_reason=$3 where contract_id=$1',[main,iso(now+2.5*day),'Fixture planned renewal']);
 await db.query("insert into organization_contract_versions(contract_id,revision,terms,created_by,status) values($1,2,$2::jsonb,$3,'offered')",[main,JSON.stringify(revision2),homeOwner]);
 await db.query('insert into contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at) values($1,2,$2,$3,1,$4,$5)',[main,homeOwner,player,iso(now),revision2.startsAt]);
 await assert.rejects(()=>mutate(player,{action:'accept',contractId:changed,revision:1}),/CONTRACT_GUEST_CHANGED/);
 await mutate(hostOwner,{action:'cancel',contractId:changed,revision:1});
 await db.query("update event_sessions set status='cancelled' where id=$1",[session]);assert.deepEqual(await account(host),{balance:80,reserved:0},'future cancellation releases fixed compensation even without any result frame');
 const early=id(19041);await prepare(early,second);await consent(guildOwner,early,1,guildMain);await mutate(player,{action:'accept',contractId:early,revision:1});
 assert.equal((await account(host)).reserved,50);
 await db.query("select contract_terminate($1,$2,$3,1,'organization',0,null)",[hostOwner,randomUUID(),early]);
 assert.equal((await account(host)).reserved,0,'explicit early termination releases unearned guest compensation');
 assert.equal((await db.query('select contract_guest_can_play($1,$2,$3) eligible',[host,player,second])).rows[0].eligible,false);
 await db.exec('set role authenticated');try{await assert.rejects(()=>db.query('select contract_guest_can_play($1,$2,$3)',[host,player,session]),/permission denied/);}finally{await db.exec('reset role');}
 console.log('PASS: guest team+guild requirements, explicit prohibition exception, all approvals, atomic funding/signature rollback, owner-wallet isolation, temporary roster admission/edit/reserve and cancellation/termination release');

 // Historical result fixture: the event has actually ended; signed inputs are
 // seeded as historical truth rather than changing the clock or backdating a
 // real user acceptance. All payments use the real publication transaction.
 const hp=id(19503),ht=id(19500),percentOrg=id(19501),fixedOrg=id(19502),hc=id(19510),pc=id(19511),fc=id(19512),he=id(19520),hs=id(19521),hg=id(19522),hgame=id(19523),hr=id(19524);
 await db.query('insert into auth.users(id) values($1)',[hp]);await db.query("insert into profiles(id,nickname) values($1,'Historical guest')",[hp]);
 for(const t of [ht,percentOrg,fixedOrg])await db.query("insert into teams(id,name,type,leader_id,verified) values($1,$2,'team',$3,true)",[t,'Historical guest org '+t.slice(-4),hostOwner]);
 await db.query("insert into events(id,title,type,organizer_user_id,is_published,moderation_status,min_players,prize_plan) values($1,'Historical guest result','training',$2,true,'approved',1,'[]')",[he,hostOwner]);
 await db.query('insert into event_sessions(id,event_id,start_time,end_time) values($1,$2,$3,$4)',[hs,he,iso(now+day),iso(now+day+3600000)]);
 await db.query("insert into event_groups(id,session_id,public_number,display_order,name,capacity) values($1,$2,1,1,'Main',12)",[hg,hs]);
 await db.query("insert into event_games(id,event_id,session_id,group_id,game_number,public_number,map_name) values($1,$2,$3,$4,1,1,'bermuda')",[hgame,he,hs,hg]);
 for(const[c,t,kind,rule]of[[pc,percentOrg,'main',{kind:'percent',basisPoints:2000}],[fc,fixedOrg,'main',{kind:'fixed',amount:40}],[hc,ht,'guest',{kind:'none'}]]){
  const tms=defaultTerms(new Date(now-4*day));tms.guestPolicy='allowed';tms.guestCompensation=rule;if(kind==='guest'){tms.endsAt=iso(now-2*day+3600000);tms.financial.rates.perSession=100;}
  await db.query('insert into organization_contracts(id,organization_id,player_id,kind,event_id,session_id,created_by) values($1,$2,$3,$4,$5,$6,$7)',[c,t,hp,kind,kind==='guest'?he:null,kind==='guest'?hs:null,hostOwner]);
  await db.query("insert into organization_contract_versions(contract_id,revision,terms,created_by,status,offered_at) values($1,1,$2::jsonb,$3,'offered',$4)",[c,JSON.stringify(tms),hostOwner,iso(now-5*day)]);
  await db.query('insert into contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at) values($1,1,$2,$3,1,$4,$4)',[c,hostOwner,hp,iso(now-4*day)]);
 }
 await db.query('insert into contract_guest_scopes(contract_id,revision,event_id,session_ids,starts_at,ends_at) values($1,1,$2,$3::uuid[],$4,$5)',[hc,he,[hs],iso(now-2*day),iso(now-2*day+3600000)]);
 for(const[c,t,comp]of[[pc,percentOrg,{kind:'percent',basisPoints:2000}],[fc,fixedOrg,{kind:'fixed',amount:40}]])await db.query("insert into contract_guest_requirements(contract_id,revision,home_contract_id,home_revision,organization_id,policy,compensation) values($1,1,$2,1,$3,'allowed',$4::jsonb)",[hc,c,t,JSON.stringify(comp)]);
 await db.query('insert into contract_guest_activations(contract_id,revision,activated_at) values($1,1,$2)',[hc,iso(now-4*day)]);
 await wallet(hostOwner,'adjust',{kind:'organization',ownerId:ht,amount:500,reason:'Historical guest escrow source'});
 const reserveOp=randomUUID();await db.query("insert into coin_operations(id,action,input,description) values($1,'fixture_guest_reserve','{}','Historical signed escrow fixture')",[reserveOp]);
 await db.query("select u6_coin_entry($1,u6_coin_account('organization',$2),0,40)",[reserveOp,ht]);
 await db.query('insert into contract_guest_escrows(contract_id,revision,home_contract_id,amount,held) values($1,1,$2,40,40)',[hc,fc]);
 await db.query('insert into event_registrations(id,event_id,session_id,team_id,group_id,roster_json) values($1,$2,$3,$4,$5,$6::jsonb)',[hr,he,hs,ht,hg,JSON.stringify([hp])]);
 await db.query('update event_sessions set start_time=$2,end_time=$3 where id=$1',[hs,iso(now-2*day),iso(now-2*day+3600000)]);
 let revision=0;
 const publish=async(played=true)=>{
  const document={rules:{mode:'training',criterion:'points',ratingEnabled:false},mvps:[],rows:[{registrationId:hr,teamId:ht,userId:null,gameId:hgame,groupId:hg,name:'Historical guest org',played:true,detail:'players',reason:'no_show',place:1,kills:played?1:0,points:10,fieldSize:2,rounds:null,players:[{id:hp,userId:hp,nickname:'Historical guest',played,kills:played?1:0,deaths:0,assists:0}]}],standings:[{registrationId:hr,teamId:ht,userId:null,groupId:hg,name:'Historical guest org',place:1,kills:played?1:0,points:10,placeSum:1,wins:1,gamesPlayed:1,bonus:0,manual:false}]};
  const config=(await db.query('select configuration_revision from event_sessions where id=$1',[hs])).rows[0].configuration_revision;
  const result=(await db.query('select u2_save_results($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb) value',[hostOwner,hs,revision,config,randomUUID(),JSON.stringify(document),JSON.stringify({rows:document.rows,warnings:[],manualOrder:[],snapshots:[]}),JSON.stringify(document)])).rows[0].value;revision=result.revision;
 };
 await publish();assert.deepEqual(await account(ht),{balance:360,reserved:0});assert.equal((await account(percentOrg)).balance,20);assert.equal((await account(fixedOrg)).balance,40);
 assert.equal((await db.query('select balance::int n from coin_accounts where user_id=$1',[hp])).rows[0].n,80,'percentage is split before player income and never debits a second 20 from the player');
 const history=(await db.query('select contract_obligation_query($1,$2,0) value',[hp,hc])).rows[0].value;
 assert.ok(history.obligations.some(o=>o.kind==='appearance'&&Number(o.guestShares)===20&&Number(o.playerPaid)===80),'private payment history distinguishes the gross payment, home shares and actual player receipt');
 const count=(await db.query('select count(*)::int n from coin_entries')).rows[0].n;await publish();await db.query('select contract_maintenance_run()');assert.equal((await db.query('select count(*)::int n from coin_entries')).rows[0].n,count);
 const withdraw=await wallet(hp,'withdraw_request',{fullNameLatin:'Test Player',transferCountry:'Россия',amount:60,note:'Protect net guest winnings'});await publish(false);
 assert.deepEqual(await account(ht),{balance:440,reserved:0});assert.equal((await account(percentOrg)).balance,0);assert.equal((await account(fixedOrg)).balance,0);
 assert.equal((await db.query('select contract_player_debt_summary($1) value',[hp])).rows[0].value.total,60,'return debt is only the unpaid player net, never the home organizations shares');
 await wallet(hp,'withdraw_cancel',{withdrawalId:withdraw.operationId});assert.equal((await account(ht)).balance,500);
 await publish();assert.equal((await account(ht)).balance,360);await db.query("update events set cancelled_at=clock_timestamp() where id=$1",[he]);
 assert.deepEqual(await account(ht),{balance:500,reserved:0});assert.equal((await account(percentOrg)).balance,0);assert.equal((await account(fixedOrg)).balance,0);
 // One guest contract covers the whole tournament. Qualifier-only participation
 // pays the original tournament rate and fixed home fee after the final, not
 // once per stage, even when a different organization plays that final.
 const te=id(19700),tc=id(19701),qualifier=id(19710),final=id(19720),finalist=id(19702);
 const tStart=now-day,tFinal=now-day/2,tEnd=tFinal+3600000;
 await db.query("insert into events(id,title,type,organizer_user_id,is_published,moderation_status,min_players,prize_plan) values($1,'Whole guest tournament','tournament',$2,true,'approved',1,'[]')",[te,hostOwner]);
 await db.query("insert into teams(id,name,type,leader_id,verified) values($1,'Other finalist','team',$2,true)",[finalist,hostOwner]);
 const tournamentSession=async(s,org,stage)=>{
  const g=id(Number(s.slice(-12))+1),gm=id(Number(s.slice(-12))+2),r=id(Number(s.slice(-12))+3);
  await db.query("insert into event_sessions(id,event_id,start_time,end_time,stage) values($1,$2,now()+interval '1 day',now()+interval '1 day 1 hour',$3)",[s,te,stage]);
  await db.query("insert into event_groups(id,session_id,public_number,display_order,name,capacity) values($1,$2,1,1,'Main',12)",[g,s]);
  await db.query("insert into event_games(id,event_id,session_id,group_id,game_number,public_number,map_name) values($1,$2,$3,$4,1,1,'bermuda')",[gm,te,s,g]);
  await db.query('insert into event_registrations(id,event_id,session_id,team_id,group_id,roster_json) values($1,$2,$3,$4,$5,$6::jsonb)',[r,te,s,org,g,JSON.stringify(org===ht?[hp]:[])]);
  return async()=>{
   const rows=[{registrationId:r,teamId:org,userId:null,gameId:gm,groupId:g,name:'Tournament org',played:true,detail:org===ht?'players':'team',reason:'no_show',place:1,kills:org===ht?1:0,points:10,fieldSize:2,rounds:null,players:org===ht?[{id:hp,userId:hp,nickname:'Historical guest',played:true,kills:1,deaths:0,assists:0}]:[]}];
   const document={rules:{mode:'tournament',criterion:'points',ratingEnabled:false},mvps:[],rows,standings:[{registrationId:r,teamId:org,userId:null,groupId:g,name:'Tournament org',place:1,kills:org===ht?1:0,points:10,placeSum:1,wins:1,gamesPlayed:1,bonus:0,manual:false}]};
   const config=(await db.query('select configuration_revision from event_sessions where id=$1',[s])).rows[0].configuration_revision;
   await db.query('select u2_save_results($1,$2,0,$3,$4,$5,$6::jsonb,$7::jsonb)',[hostOwner,s,config,randomUUID(),JSON.stringify(document),JSON.stringify({rows,warnings:[],manualOrder:[],snapshots:[]}),JSON.stringify(document)]);
  };
 };
 const publishQualifier=await tournamentSession(qualifier,ht,'qualification'),publishFinal=await tournamentSession(final,finalist,'final');
 await db.query('update events set final_session_id=$2 where id=$1',[te,final]);
 const tournamentTerms=defaultTerms(new Date(now-4*day));tournamentTerms.endsAt=iso(tEnd);tournamentTerms.financial.rates.perTournament=150;
 await db.query("insert into organization_contracts(id,organization_id,player_id,kind,event_id,created_by) values($1,$2,$3,'guest',$4,$5)",[tc,ht,hp,te,hostOwner]);
 await db.query("insert into organization_contract_versions(contract_id,revision,terms,created_by,status,offered_at) values($1,1,$2::jsonb,$3,'offered',$4)",[tc,JSON.stringify(tournamentTerms),hostOwner,iso(now-5*day)]);
 await db.query('insert into contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at) values($1,1,$2,$3,1,$4,$4)',[tc,hostOwner,hp,iso(now-4*day)]);
 await db.query('insert into contract_guest_scopes(contract_id,revision,event_id,session_ids,starts_at,ends_at) values($1,1,$2,$3::uuid[],$4,$5)',[tc,te,[qualifier,final],iso(tStart),iso(tEnd)]);
 for(const[c,t,comp]of[[pc,percentOrg,{kind:'percent',basisPoints:2000}],[fc,fixedOrg,{kind:'fixed',amount:40}]])await db.query("insert into contract_guest_requirements(contract_id,revision,home_contract_id,home_revision,organization_id,policy,compensation) values($1,1,$2,1,$3,'allowed',$4::jsonb)",[tc,c,t,JSON.stringify(comp)]);
 await db.query('insert into contract_guest_activations(contract_id,revision,activated_at) values($1,1,$2)',[tc,iso(now-4*day)]);
 const escrowOp=randomUUID();await db.query("insert into coin_operations(id,action,input,description) values($1,'fixture_guest_reserve','{}','Historical tournament guest escrow fixture')",[escrowOp]);await db.query("select u6_coin_entry($1,u6_coin_account('organization',$2),0,40)",[escrowOp,ht]);
 await db.query('insert into contract_guest_escrows(contract_id,revision,home_contract_id,amount,held) values($1,1,$2,40,40)',[tc,fc]);
 await db.query('update event_sessions set start_time=$2,end_time=$3 where id=$1',[qualifier,iso(tStart),iso(tStart+3600000)]);await db.query('update event_sessions set start_time=$2,end_time=$3 where id=$1',[final,iso(tFinal),iso(tEnd)]);
 await publishQualifier();assert.deepEqual(await account(ht),{balance:500,reserved:40});
 const beforeFailure=(await db.query('select count(*)::int n from coin_entries')).rows[0].n;
 await db.exec(`create function test_guest_fee_failure() returns trigger language plpgsql as $$begin if new.action='contract_guest_fixed' then raise exception 'TEST_GUEST_FEE_FAILURE';end if;return new;end $$;create trigger test_guest_fee_failure before insert on coin_operations for each row execute function test_guest_fee_failure();`);
 try{await assert.rejects(()=>publishFinal(),/TEST_GUEST_FEE_FAILURE/);}finally{await db.exec('drop trigger test_guest_fee_failure on coin_operations;drop function test_guest_fee_failure();');}
 assert.equal((await db.query('select count(*)::int n from coin_entries')).rows[0].n,beforeFailure);assert.equal((await db.query('select count(*)::int n from competition_publications where session_id=$1',[final])).rows[0].n,0);
 await publishFinal();assert.deepEqual(await account(ht),{balance:310,reserved:0});assert.equal((await account(percentOrg)).balance,30);assert.equal((await account(fixedOrg)).balance,40);
 await db.query("update events set cancelled_at=clock_timestamp() where id=$1",[te]);assert.deepEqual(await account(ht),{balance:500,reserved:0});
 console.log('PASS: published guest receipts split to home organization/player, fixed escrow pays after participation, retries conserve coins, corrections recover only net player income and event cancellation reverses each source once');
}
