import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {defaultTerms} from '../../src/modules/contracts/model.ts';

export async function verifyContractNoShowSettlement(db,id){
 const owner=id(9860),player=id(9861),leader=id(9862),outsider=id(9863),team=id(9870),contract=id(9871),event=id(9872);
 for(const user of [owner,player,leader,outsider]){
  await db.query('insert into auth.users(id) values($1)',[user]);
  await db.query('insert into profiles(id,nickname) values($1,$2)',[user,`Absence ${user.slice(-4)}`]);
 }
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
 await db.query("insert into user_roles(user_id,role) values($1,'superadmin')",[owner]);
 await db.query("insert into teams(id,name,type,leader_id) values($1,'Absence organization','team',$2)",[team,owner]);
 await db.query('update teams set leader_id=$2 where id=$1',[team,leader]);
 await db.query("insert into team_members(team_id,user_id,role_in_team) values($1,$2,'main')",[team,player]);
 await db.query("insert into competition_ratings(target_type,target_id,mode,exact_rating,display_rating) values('player',$1,'main',100,100)",[player]);
 await db.query("insert into events(id,title,type,organizer_user_id,is_published,moderation_status) values($1,'Absence training','training',$2,true,'approved')",[event,owner]);
 const terms=defaultTerms(new Date(Date.now()-5*86400000));terms.financial.noShowPenalty={kind:'percent',basisPoints:1000};
 await db.query("insert into organization_contracts(id,organization_id,player_id,kind,created_by) values($1,$2,$3,'main',$4)",[contract,team,player,owner]);
 await db.query("insert into organization_contract_versions(contract_id,revision,terms,created_by,status,offered_at) values($1,1,$2::jsonb,$3,'offered',now())",[contract,JSON.stringify(terms),owner]);
 await db.query("insert into contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at) values($1,1,$2,$3,1,now()-interval '4 days',now()-interval '4 days')",[contract,owner,player]);
 const wallet=async(action,input,actor=owner)=>(await db.query('select u6_coin_action($1,$2,$3,$4::jsonb) value',[actor,randomUUID(),action,JSON.stringify(input)])).rows[0].value;
 const adjust=async(kind,target,amount)=>wallet('adjust',{kind,ownerId:target,amount,reason:'Absence test funding'});
 const account=async(kind,target)=>(await db.query(`select balance::int,reserved::int from coin_accounts where ${kind==='player'?'user_id':'team_id'}=$1`,[target])).rows[0];
 const price=async()=>(await db.query("select u2_cost_for_target('player',$1,'main')::bigint value",[player])).rows[0].value;
 const debt=async()=>(await db.query('select contract_player_debt_summary($1) value',[player])).rows[0].value.total;
 const makeSession=async(n,games=1)=>{
  const session=id(n),group=id(n+1),registration=id(n+2),gameIds=Array.from({length:games},(_,i)=>id(n+3+i));
  await db.query("insert into event_sessions(id,event_id,start_time,end_time) values($1,$2,now()+interval '1 day',now()+interval '1 day 1 hour')",[session,event]);
  await db.query("insert into event_groups(id,session_id,public_number,display_order,name,capacity) values($1,$2,1,1,'Main',12)",[group,session]);
  for(let i=0;i<games;i++)await db.query("insert into event_games(id,event_id,session_id,group_id,game_number,public_number,map_name) values($1,$2,$3,$4,$5,$5,'bermuda')",[gameIds[i],event,session,group,i+1]);
  await db.query('insert into event_registrations(id,event_id,session_id,team_id,group_id,roster_json) values($1,$2,$3,$4,$5,$6::jsonb)',[registration,event,session,team,group,JSON.stringify([player])]);
  await db.query('update event_registrations set roster_snapshot=roster_snapshot||$2::jsonb where id=$1',[registration,JSON.stringify([{id:'guest-without-account',nickname:'Guest'}])]);
  await db.query("update event_sessions set start_time=now()-interval '1 hour',end_time=now()+interval '1 hour' where id=$1",[session]);
  const document={rules:{mode:'training',criterion:'points',ratingEnabled:false},standings:[],mvps:[],rows:gameIds.map(game=>({registrationId:registration,gameId:game,groupId:group,teamId:team,userId:null,name:'Absence organization',played:false,reason:'no_show',detail:'players',place:null,kills:0,points:0,players:[]}))};
  const publish=async(doc)=>{
   await db.query('insert into competition_publications(session_id,revision,first_published_at,published,updated_by) values($1,1,now(),$2::jsonb,$3) on conflict(session_id) do update set published=excluded.published,revision=competition_publications.revision+1',[session,JSON.stringify(doc),owner]);
   return(await db.query('select contract_session_publish_settle($1) value',[session])).rows[0].value;
  };
  return{session,document,publish};
 };
 const fines=async(session)=>(await db.query("select * from contract_player_claims where session_id=$1 and contract_id=$2 and kind='no_show' order by generation",[session,contract])).rows;
 const cancel=async(claim,actor=owner,key=randomUUID(),reason='Owner cancels absence fine')=>(await db.query('select contract_no_show_cancel($1,$2,$3,$4) value',[actor,key,claim,reason])).rows[0].value;
 await adjust('player',player,100);
 const protectedWithdrawal=await wallet('withdraw_request',{fullNameLatin:'Test Player',transferCountry:'Россия',amount:80,note:'Keep earmarked player coins'},player);
 const first=await makeSession(9873),oldPrice=Number(await price());assert.ok(oldPrice>200);
 await db.query("update competition_ratings set exact_rating=200,display_rating=200 where target_type='player' and target_id=$1 and mode='main'",[player]);
 const snapshot=(await db.query('select value from contract_session_valuations where session_id=$1 and player_id=$2',[first.session,player])).rows[0];
 assert.equal(Number(snapshot.value),oldPrice,'valuation is frozen BEFORE the rating changes');assert.ok(Number(await price())>oldPrice);
 const expected=Math.floor(oldPrice/10);await first.publish(first.document);
 const fine=(await fines(first.session))[0];assert.equal(Number(fine.amount),expected);assert.equal(Number(fine.recovered),20);
 assert.deepEqual(await account('player',player),{balance:80,reserved:80});assert.equal(await debt(),expected-20);
 const entries=(await db.query('select count(*)::int n from coin_entries')).rows[0].n;
 await first.publish(first.document);assert.equal((await db.query('select count(*)::int n from coin_entries')).rows[0].n,entries);
 await assert.rejects(()=>wallet('withdraw_request',{fullNameLatin:'Test Player',transferCountry:'Россия',amount:1,note:'Debt guard'},player),/CONTRACT_PLAYER_DEBT_WITHDRAWAL/);
 for(const actor of [player,leader,outsider])await assert.rejects(()=>cancel(fine.id,actor),/CONTRACT_OWNER/);
 const query=async(actor)=>(await db.query('select contract_fine_query($1,$2) value',[actor,contract])).rows[0].value;
 assert.equal((await query(player)).canCancel,false);assert.equal((await query(leader)).canCancel,false);assert.equal((await query(owner)).canCancel,true);
 await assert.rejects(()=>query(outsider),/CONTRACT_NOT_FOUND/);
 const key=randomUUID(),cancelled=await cancel(fine.id,owner,key);
 assert.equal(cancelled.refunded,20);assert.equal(cancelled.cancelledDebt,expected-20);assert.equal(await debt(),0);
 assert.deepEqual(await account('player',player),{balance:100,reserved:80});
 assert.deepEqual(await cancel(fine.id,owner,key),cancelled);await assert.rejects(()=>cancel(fine.id),/CONTRACT_CANCELLED/);
 await first.publish(first.document);assert.equal((await fines(first.session)).length,1,'owner cancellation cannot be revived by a result correction');

 const second=await makeSession(9880);await second.publish(second.document);
 await adjust('player',player,50);
 const secondFine=(await fines(second.session))[0];assert.equal(Number(secondFine.recovered),70);
 const incomplete=structuredClone(second.document);incomplete.rows[0]={...incomplete.rows[0],played:true,kills:1,players:[]};
 await second.publish(incomplete);assert.equal((await fines(second.session))[0].cancelled_at,null,'incomplete corrected personal data cannot erase or create a fine');
 const protectedOrganization=(await db.query("select contract_obligation_create($1,1,'appearance','protected-fine-test',70,now()+interval '1 day',true) id",[contract])).rows[0].id;
 const attended=structuredClone(second.document);attended.rows[0]={...attended.rows[0],played:true,place:1,kills:1,players:[{id:player,userId:player,nickname:'Absence player',played:true,kills:1}]};
 await second.publish(attended);
 const corrected=(await fines(second.session))[0];assert.ok(corrected.cancelled_at);assert.equal(corrected.cancelled_by,null);
 assert.equal(await debt(),0);assert.deepEqual(await account('player',player),{balance:80,reserved:80});
 assert.deepEqual(await account('organization',team),{balance:70,reserved:70},'fine correction cannot consume another obligation reserve');
 const refund=(await db.query("select * from contract_obligations where contract_id=$1 and kind='fine_refund' and source_key=$2",[contract,'fine-refund:'+secondFine.id])).rows[0];
 assert.equal(Number(refund.amount),70);assert.equal(Number(refund.paid),0);
 await assert.rejects(()=>db.query('select contract_obligation_cancel($1,$2,$3,$4)',[owner,randomUUID(),refund.id,'Cannot erase system refund']),/CONTRACT_SYSTEM_REFUND/);
 await db.query('select contract_obligation_cancel($1,$2,$3,$4)',[owner,randomUUID(),protectedOrganization,'Release protected test obligation']);
 await second.publish(attended);assert.equal(Number((await db.query('select paid from contract_obligations where id=$1',[refund.id])).rows[0].paid),0,'released organization funds do not automatically pay historical debt');
 await db.query('select contract_debt_pay($1,$2,$3,70)',[owner,randomUUID(),refund.id]);
 assert.deepEqual(await account('player',player),{balance:150,reserved:80});
 assert.equal((await query(player)).fines.find(row=>row.id===secondFine.id).refunded,70);
 await second.publish(second.document);assert.equal((await fines(second.session)).length,2,'restored no-show creates a new audited fine generation after a system correction');
 await second.publish(attended);assert.deepEqual(await account('player',player),{balance:150,reserved:80});

 const restorePrice=async()=>{
  await db.query("insert into competition_ratings(target_type,target_id,mode,exact_rating,display_rating) values('player',$1,'main',100,100) on conflict(target_type,target_id,mode) do update set exact_rating=100,display_rating=100",[player]);
  assert.ok(Number(await price())>200);
 };
 await restorePrice();const partial=await makeSession(9887,2),partialDocument=structuredClone(partial.document);
 partialDocument.rows[0]={...partialDocument.rows[0],played:true,place:1,kills:0,players:[{id:player,userId:player,played:true,kills:0}]};
 await partial.publish(partialDocument);assert.equal((await fines(partial.session)).length,0,'partial attendance never becomes a no-show fine');
 await restorePrice();const technical=await makeSession(9893);technical.document.rows[0].reason='technical';await technical.publish(technical.document);
 assert.equal((await fines(technical.session)).length,0,'technical interruption is not a contractual no-show');
 await restorePrice();const cancelledSession=await makeSession(10080);const cancellationOutcome=await cancelledSession.publish(cancelledSession.document);
 assert.ok((await fines(cancelledSession.session)).length===1,JSON.stringify(cancellationOutcome));
 await db.query("update event_sessions set status='cancelled' where id=$1",[cancelledSession.session]);
 assert.ok((await fines(cancelledSession.session))[0].cancelled_at,'cancelling the session automatically cancels its fine');
 await assert.rejects(()=>db.query('update contract_session_valuations set value=value+1 where session_id=$1',[first.session]),/CONTRACT_IMMUTABLE/);
 await assert.rejects(()=>db.query('update contract_player_claims set amount=amount+1 where id=$1',[fine.id]),/CONTRACT_IMMUTABLE/);
 await wallet('withdraw_cancel',{withdrawalId:protectedWithdrawal.operationId},player);
 await db.exec('set role service_role');
 try{
  await assert.rejects(()=>db.query('select contract_session_fine_settle($1,$2)',[first.session,contract]),/permission denied/);
  await assert.rejects(()=>db.query('select contract_no_show_cancel_internal(null,$1,$2,$3)',[randomUUID(),fine.id,'Forged internal cancel']),/permission denied/);
  await assert.rejects(()=>db.query('select contract_no_show_cancel(null,$1,$2,$3)',[randomUUID(),fine.id,'Forged automatic cancel']),/CONTRACT_AUTH/);
 }finally{await db.exec('reset role');}
 const coinConservation=(await db.query("select sum(e.amount)::bigint value from coin_entries e join coin_operations op on op.id=e.operation_id where op.action in('contract_return','contract_fine_cancel','contract_payment')")).rows[0];
 assert.equal(Number(coinConservation.value),0);
 console.log('PASS: pre-result valuation snapshots, reserve-safe no-show debt, incoming repayment, owner-only/idempotent cancellation, correction refund debt, manual refund payment, partial/technical exclusion and private settlement');
}
