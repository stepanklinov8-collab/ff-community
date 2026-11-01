import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {defaultTerms,defaultRentalTerms} from '../../src/modules/contracts/model.ts';
export async function verifyRentalPayments(db,id){
 for(const invalid of [{kind:'percent',basisPoints:20,basis:null},{kind:'combined',amount:40,basisPoints:20,basis:'player_payments',selection:null},{kind:'fixed',amount:.5},{kind:'percent',basisPoints:20,basis:'all_wallet_money'}])await assert.rejects(()=>db.query('select contract_rental_rule($1::jsonb)',[JSON.stringify(invalid)]),/CONTRACT_INPUT/);
 const owner=id(21000),player=id(21001),other=id(21002),home=id(21003),primary=id(21004),homeReader=id(21005),day=86400000,now=Date.now(),iso=n=>new Date(n).toISOString();
 for(const user of [owner,player,other,homeReader]){await db.query('insert into auth.users(id) values($1)',[user]);await db.query('insert into profiles(id,nickname) values($1,$2)',[user,'Rental '+user.slice(-4)]);}
 await db.query("insert into user_roles(user_id,role) values($1,'superadmin')",[owner]);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
 await db.query("insert into teams(id,name,type,leader_id,verified) values($1,'Rental home','team',$2,true)",[home,owner]);
 await db.query('update teams set leader_id=$2 where id=$1',[home,homeReader]);
 const main=defaultTerms(new Date(now-30*day));main.guestPolicy='allowed';
 await db.query("insert into organization_contracts(id,organization_id,player_id,kind,created_by) values($1,$2,$3,'main',$4)",[primary,home,player,owner]);
 await db.query("insert into organization_contract_versions(contract_id,revision,terms,created_by,status,offered_at) values($1,1,$2::jsonb,$3,'offered',$4)",[primary,JSON.stringify(main),owner,main.startsAt]);
 await db.query('insert into contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at) values($1,1,$2,$3,1,$4,$4)',[primary,owner,player,main.startsAt]);
 const wallet=async(action,input,actor=owner,key=randomUUID())=>(await db.query('select u6_coin_action($1,$2,$3,$4::jsonb) value',[actor,key,action,JSON.stringify(input)])).rows[0].value;
 const balance=async(target,team=true)=>(await db.query(`select coalesce((select balance from coin_accounts where ${team?'team_id':'user_id'}=$1),0)::int balance,coalesce((select reserved from coin_accounts where ${team?'team_id':'user_id'}=$1),0)::int reserved`,[target])).rows[0];
 await wallet('adjust',{kind:'player',ownerId:owner,amount:5000,reason:'Organizer funds separate from rental payer'});
 const fixture=async(n,{rule,rate=100,share=0,personalShare=0,funding=1000,personal=20,otherShare=0})=>{
  const host=id(n),event=id(n+1),session=id(n+2),group=id(n+3),game=id(n+4),reg=id(n+5),contract=id(n+6),start=now-(n===21100?6:n===21200?4:2)*day;
  await db.query("insert into teams(id,name,type,leader_id,verified) values($1,$2,'team',$3,true)",[host,'Rental host '+n,owner]);
  await db.query('insert into events(id,title,type,organizer_user_id,is_published,moderation_status,min_players,prize_plan,personal_prizes) values($1,$2,\'training\',$3,true,\'approved\',1,\'[250,150,100]\',$4::jsonb)',[event,'Rental event '+n,owner,JSON.stringify({mvp:personal,maxKills:0})]);
  await db.query("insert into event_sessions(id,event_id,start_time,end_time) values($1,$2,now()+interval '1 day',now()+interval '1 day 1 hour')",[session,event]);
  await db.query("insert into event_groups(id,session_id,public_number,display_order,name,capacity) values($1,$2,1,1,'Main',12)",[group,session]);
  await db.query("insert into event_games(id,event_id,session_id,group_id,game_number,public_number,map_name) values($1,$2,$3,$4,1,1,'bermuda')",[game,event,session,group]);
  const terms=defaultRentalTerms(new Date(start-day));terms.endsAt=iso(start+3600000);terms.financial.rates.perSession=rate;terms.trainingShareBps=share;terms.personalShareBps=personalShare;
  terms.financial.rentalCompensations=[{organizationId:home,compensation:rule}];
  await db.query("insert into organization_contracts(id,organization_id,player_id,kind,event_id,session_id,created_by) values($1,$2,$3,'guest',$4,$5,$6)",[contract,host,player,event,session,owner]);
  await db.query("insert into organization_contract_versions(contract_id,revision,terms,created_by,status,offered_at) values($1,1,$2::jsonb,$3,'offered',$4)",[contract,JSON.stringify(terms),owner,terms.startsAt]);
  await db.query('select contract_validate_terms($1::jsonb)',[JSON.stringify(terms)]);
  await db.query('insert into contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at) values($1,1,$2,$3,1,$4,$4)',[contract,owner,player,terms.startsAt]);
  await db.query('insert into contract_guest_scopes(contract_id,revision,event_id,session_ids,starts_at,ends_at,accounting_version,home_terms) values($1,1,$2,array[$3::uuid],$4,$5,2,\'[]\')',[contract,event,session,iso(start),terms.endsAt]);
  await db.query("insert into contract_guest_requirements(contract_id,revision,home_contract_id,home_revision,organization_id,policy,compensation) values($1,1,$2,1,$3,'consent',$4::jsonb)",[contract,primary,home,JSON.stringify(rule)]);
  await db.query('insert into contract_guest_activations(contract_id,revision,activated_at) values($1,1,$2)',[contract,terms.startsAt]);
  await wallet('adjust',{kind:'organization',ownerId:host,amount:funding,reason:'Rental payer account'});
  if(['fixed','combined'].includes(rule.kind)&&rule.amount){
   const op=randomUUID();await db.query("insert into coin_operations(id,action,input,description) values($1,'fixture_rental_reserve','{}','Historical signed rental reserve')",[op]);
   await db.query("select u6_coin_entry($1,u6_coin_account('organization',$2),0,$3)",[op,host,rule.amount]);
   await db.query('insert into contract_guest_escrows(contract_id,revision,home_contract_id,amount,held) values($1,1,$2,$3,$3)',[contract,primary,rule.amount]);
  }
  if(otherShare){
   const otherTerms=defaultTerms(new Date(start-day));otherTerms.trainingShareBps=otherShare;
   await db.query("insert into team_members(team_id,user_id,role_in_team) values($1,$2,'main')",[host,other]);
   await db.query("insert into organization_contracts(id,organization_id,player_id,kind,created_by) values($1,$2,$3,'main',$4)",[id(n+9),host,other,owner]);
   await db.query("insert into organization_contract_versions(contract_id,revision,terms,created_by,status,offered_at) values($1,1,$2::jsonb,$3,'offered',$4)",[id(n+9),JSON.stringify(otherTerms),owner,otherTerms.startsAt]);
   await db.query('insert into contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at) values($1,1,$2,$3,1,$4,$4)',[id(n+9),owner,other,otherTerms.startsAt]);
  }
  await db.query('insert into event_registrations(id,event_id,session_id,team_id,group_id,roster_json) values($1,$2,$3,$4,$5,$6::jsonb)',[reg,event,session,host,group,JSON.stringify(otherShare?[player,other]:[player])]);
  await db.query('select u6_reserve_session_prizes($1)',[session]);await db.query('select personal_award_reserve($1,$2)',[event,session]);
  await db.query('update event_sessions set start_time=$2,end_time=$3 where id=$1',[session,iso(start),terms.endsAt]);
  let revision=0;
  const publish=async(played=true)=>{
   const row={registrationId:reg,gameId:game,groupId:group,teamId:host,userId:null,name:'Rental host',played,detail:'players',reason:'no_show',place:played?1:null,kills:played?2:0,points:played?14:0,fieldSize:2,rounds:null,players:[{id:player,userId:player,nickname:'Rental player',played,kills:played?2:0,deaths:0,assists:0}]};
   if(otherShare)row.players.push({id:other,userId:other,nickname:'Other player',played,kills:0,deaths:0,assists:0});
   const document={rules:{mode:'training',criterion:'points',ratingEnabled:false},mvps:played?[player]:[],rows:[row],standings:[{registrationId:reg,teamId:host,userId:null,groupId:group,name:'Rental host',place:1,kills:played?2:0,points:played?14:0,placeSum:played?1:0,wins:played?1:0,gamesPlayed:played?1:0,bonus:0,manual:false}]};
   const config=(await db.query('select configuration_revision from event_sessions where id=$1',[session])).rows[0].configuration_revision;
   const answer=(await db.query('select u2_save_results($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb) value',[owner,session,revision,config,randomUUID(),JSON.stringify(document),JSON.stringify({rows:[row],warnings:[],manualOrder:[],snapshots:[]}),JSON.stringify(document)])).rows[0].value;revision=answer.revision;
  };
  const query=async(actor=owner)=>(await db.query('select contract_rental_query($1,$2) value',[actor,contract])).rows[0].value;
  return{host,event,session,contract,publish,query};
 };
 const first=await fixture(21100,{rule:{kind:'combined',amount:40,basisPoints:2000,basis:'organization_prizes',selection:'maximum'}});
 await db.exec(`create function test_rental_failure() returns trigger language plpgsql as $$begin if new.action='contract_rental_movement' then raise exception 'TEST_RENTAL_FAILURE';end if;return new;end $$;
 create trigger test_rental_failure before insert on coin_operations for each row execute function test_rental_failure();`);
 try{await assert.rejects(()=>first.publish(),/TEST_RENTAL_FAILURE/);}finally{await db.exec('drop trigger test_rental_failure on coin_operations;drop function test_rental_failure();');}
 assert.deepEqual(await balance(first.host),{balance:1000,reserved:40});assert.equal((await balance(player,false)).balance,0);assert.equal((await balance(home)).balance,0);
 assert.equal((await db.query('select count(*)::int n from contract_rental_fees where contract_id=$1',[first.contract])).rows[0].n,0,'fee failure rolls back the whole result, player payment and reserve adoption');
 await first.publish();assert.deepEqual(await balance(first.host),{balance:1116,reserved:0});assert.equal((await balance(home)).balance,54);assert.equal((await balance(player,false)).balance,100);
 assert.equal((await first.query()).rows[0].amount,54);assert.equal((await first.query()).rows[0].plan.basis.organizationPrizes,270);
 assert.equal((await first.query(homeReader)).canPay,false);assert.equal((await first.query(homeReader)).rows[0].paid,54,'home finance can inspect its own receivable but cannot spend the host account');
 const entries=(await db.query('select count(*)::int n from coin_entries')).rows[0].n;await first.publish();await db.query('select contract_maintenance_run()');assert.equal((await db.query('select count(*)::int n from coin_entries')).rows[0].n,entries);
 const second=await fixture(21200,{rule:{kind:'combined',amount:40,basisPoints:2000,basis:'player_payments',selection:'minimum'},personalShare:5000});
 await second.publish();assert.deepEqual(await balance(second.host),{balance:1138,reserved:0});assert.equal((await balance(home)).balance,76);assert.equal((await balance(player,false)).balance,210,'rental fees never reduce player salary or the explicitly assigned personal prize');
 assert.equal((await second.query()).rows[0].amount,22);assert.equal((await second.query()).rows[0].plan.basis.playerPayments,110);
 const protectedWithdrawal=await wallet('withdraw_request',{amount:200,note:'Rental player protected reserve'},player);
 await second.publish(false);assert.equal((await balance(home)).balance,54);assert.deepEqual(await balance(player,false),{balance:200,reserved:200});assert.equal((await second.query()).rows[0].amount,0);
 assert.equal((await db.query('select contract_player_debt_summary($1) value',[player])).rows[0].value.total,100,'player refund debt includes only actual salary/personal receipts, never the separate 22-coin host fee');
 await wallet('withdraw_cancel',{withdrawalId:protectedWithdrawal.operationId},player);assert.equal((await balance(player,false)).balance,100);
 const debt=await fixture(21300,{rule:{kind:'percent',basisPoints:10000,basis:'organization_prizes'},rate:0,share:5000,otherShare:5000,funding:0,personal:0});
 await debt.publish();let row=(await debt.query()).rows[0];assert.equal(row.amount,250);assert.equal(row.paid,0);assert.equal((await balance(debt.host)).balance,0);
 assert.equal((await balance(other,false)).balance,125,'all player prize entitlements are funded before additional rental expenses');assert.equal((await balance(home)).balance,54);
 assert.equal((await db.query('select contract_has_debt($1) value',[debt.host])).rows[0].value,true);
 await wallet('adjust',{kind:'organization',ownerId:debt.host,amount:100,reason:'Manual repayment funding'});await db.query('select contract_maintenance_run()');row=(await debt.query()).rows[0];assert.equal(row.paid,0,'old unfunded rental debt does not automatically consume top-ups');
 await assert.rejects(()=>wallet('withdraw_request',{teamId:debt.host,amount:1,note:'Debt blocks organization withdrawal'}),/CONTRACT_DEBT_WITHDRAWAL/);
 const key=randomUUID();const pay=async(actor=owner)=>(await db.query('select contract_rental_pay($1,$2,$3,100) value',[actor,key,row.id])).rows[0].value;
 await assert.rejects(()=>pay(other),/CONTRACT_FINANCE/);await pay();await pay();assert.equal((await debt.query()).rows[0].paid,100);assert.equal((await balance(home)).balance,154);
 assert.equal((await balance(owner,false)).balance,4480,'only organizer-funded awards affect the organizer; rental fees never fall back to its personal account');
 await debt.publish(false);assert.equal((await debt.query()).rows[0].amount,0);assert.equal((await balance(home)).balance,54);
 // A real future offer changes an allowed zero-compensation main clause. It
 // must obtain a home signature and reserve the combined fixed component.
 const fh=id(21400),fe=id(21401),fs=id(21402),fc=id(21403),futureTerms=defaultRentalTerms(new Date(now));
 futureTerms.endsAt=iso(now+2*day+3600000);futureTerms.financial.rentalCompensations=[{organizationId:home,compensation:{kind:'combined',amount:40,basisPoints:2000,basis:'organization_prizes',selection:'maximum'}}];
 await db.query("insert into teams(id,name,type,leader_id,verified) values($1,'Future rental host','team',$2,true)",[fh,owner]);
 await db.query("insert into events(id,title,type,organizer_user_id,is_published,moderation_status,prize_plan) values($1,'Future rental','training',$2,true,'approved','[]')",[fe,owner]);
 await db.query('insert into event_sessions(id,event_id,start_time,end_time) values($1,$2,$3,$4)',[fs,fe,iso(now+2*day),futureTerms.endsAt]);
 const mutate=async(actor,input)=>(await db.query('select contract_mutate($1,$2::jsonb) value',[actor,JSON.stringify({requestId:randomUUID(),...input})])).rows[0].value;
 const options=(await db.query('select contract_rental_options($1,$2,$3,$4,$5) value',[owner,fh,player,fe,fs])).rows[0].value;
 assert.deepEqual(options.organizations.map(row=>row.organizationId),[home]);
 await assert.rejects(()=>db.query('select contract_rental_options($1,$2,$3,$4,$5)',[other,fh,player,fe,fs]),/CONTRACT_FORBIDDEN/);
 await mutate(owner,{action:'save',contractId:fc,expectedRevision:0,organizationId:fh,playerId:player,kind:'guest',eventId:fe,sessionId:fs,terms:futureTerms});
 await mutate(owner,{action:'offer',contractId:fc,revision:1});
 assert.equal((await db.query('select policy from contract_guest_requirements where contract_id=$1',[fc])).rows[0].policy,'consent');
 await assert.rejects(()=>mutate(player,{action:'accept',contractId:fc,revision:1}),/CONTRACT_GUEST_CONSENT/);
 await db.query('select contract_guest_consent($1,$2,$3,1,$4,true)',[owner,randomUUID(),fc,primary]);
 await wallet('adjust',{kind:'organization',ownerId:fh,amount:39,reason:'Short fixed rental reserve'});
 await assert.rejects(()=>mutate(player,{action:'accept',contractId:fc,revision:1}),/CONTRACT_FUNDS/);
 assert.equal((await db.query('select count(*)::int n from contract_agreements where contract_id=$1',[fc])).rows[0].n,0);
 await wallet('adjust',{kind:'organization',ownerId:fh,amount:1,reason:'Complete fixed reserve'});
 await mutate(player,{action:'accept',contractId:fc,revision:1});assert.deepEqual(await balance(fh),{balance:40,reserved:40});
 await db.query("update event_sessions set status='cancelled' where id=$1",[fs]);assert.deepEqual(await balance(fh),{balance:40,reserved:0});
 assert.ok((await db.query('select contract_rental_query($1,null,0) value',[owner])).rows[0].value.incoming.some(row=>row.id===fc));
 assert.deepEqual((await db.query('select contract_rental_query($1,null,0) value',[other])).rows[0].value.incoming,[]);
 await db.exec('set role authenticated');try{await assert.rejects(()=>db.query('select contract_rental_settle($1,1)',[first.contract]),/permission denied/);await assert.rejects(()=>db.query('select * from contract_rental_fees'),/permission denied/);}finally{await db.exec('reset role');}
 console.log('PASS: host-funded rental max/min, both explicit percentage bases, personal/prize distributions, no player withholding, immutable historical mode, partial manual debt, withdrawal block, correction/refund and repeat conservation');
}
