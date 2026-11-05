import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {defaultTerms} from '../../src/modules/contracts/model.ts';

export async function verifyContractLimitExecution(db,id){
 const owner=id(12000),recipient=id(12001),day=86400000,now=Math.floor(Date.now()/1000)*1000,start=now-25*day,iso=time=>new Date(time).toISOString();
 for(const user of [owner,recipient]){await db.query('insert into auth.users(id) values($1)',[user]);await db.query('insert into profiles(id,nickname) values($1,$2)',[user,'Limit execution '+user.slice(-4)]);}
 await db.query("insert into user_roles(user_id,role) values($1,'superadmin')",[owner]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
 const wallet=async(action,input,actor=owner)=>(await db.query('select u6_coin_action($1,$2,$3,$4::jsonb) value',[actor,randomUUID(),action,JSON.stringify(input)])).rows[0].value;
 const account=async(kind,target)=>(await db.query(`select balance::int,reserved::int from coin_accounts where ${kind==='player'?'user_id':'team_id'}=$1`,[target])).rows[0];
 const debt=async(player)=>(await db.query('select contract_player_debt_summary($1) value',[player])).rows[0].value.total;
 const countEntries=async()=>(await db.query('select count(*)::int n from coin_entries')).rows[0].n;
 const makeContract=async(n,limit,salary=true,fundSecond=true)=>{
  const player=id(n),team=id(n+1),contract=id(n+2),event=id(n+3);
  await db.query('insert into auth.users(id) values($1)',[player]);await db.query('insert into profiles(id,nickname) values($1,$2)',[player,'Cap player '+n]);
  await db.query("insert into teams(id,name,type,leader_id,verified) values($1,$2,'team',$3,true)",[team,'Cap org '+n,owner]);
  await db.query("insert into team_members(team_id,user_id,role_in_team) values($1,$2,'main')",[team,player]);
  await db.query("insert into events(id,title,type,organizer_user_id,is_published,moderation_status,min_players) values($1,$2,'training',$3,true,'approved',1)",[event,'Cap event '+n,owner]);
  const terms=defaultTerms(new Date(start));terms.limit=limit;terms.financial.rates.perGame=10;terms.financial.rates.perSession=20;
  if(salary)terms.financial.salary={amount:1000,periodDays:10};
  if(limit.completion==='event_payments')terms.endsAt=iso(now+5*day);
  await db.query("insert into organization_contracts(id,organization_id,player_id,kind,created_by) values($1,$2,$3,'main',$4)",[contract,team,player,owner]);
  await db.query("insert into organization_contract_versions(contract_id,revision,terms,created_by,status,offered_at) values($1,1,$2::jsonb,$3,'offered',now())",[contract,JSON.stringify(terms),owner]);
  await db.query('insert into contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at) values($1,1,$2,$3,1,$4,$5)',[contract,owner,player,iso(start-day),iso(start)]);
  await wallet('adjust',{kind:'organization',ownerId:team,amount:5000,reason:'Fund count-limited agreement'});
  await db.query('select contract_financial_start($1,1,$2)',[contract,iso(start)]);
  // Reproduce two periods that were funded on time before this late result.
  // A delayed worker must not itself auto-fund an already overdue period.
  if(salary&&fundSecond)await db.query('select contract_salary_prepare($1,1,1,true)',[contract]);
  await db.query('select contract_salary_process($1)',[contract]);
  return{player,team,contract,event,terms};
 };
 const makeSession=async(context,n,begins,games=1)=>{
  const session=id(n),group=id(n+1),registration=id(n+2),ends=begins+3600000;
  await db.query("insert into event_sessions(id,event_id,start_time,end_time) values($1,$2,now()+interval '1 day',now()+interval '1 day 1 hour')",[session,context.event]);
  await db.query("insert into event_groups(id,session_id,public_number,display_order,name,capacity) values($1,$2,1,1,'Main',12)",[group,session]);
  const gameIds=Array.from({length:games},(_,i)=>id(n+3+i));
  for(let i=0;i<games;i++)await db.query("insert into event_games(id,event_id,session_id,group_id,game_number,public_number,map_name) values($1,$2,$3,$4,$5,$5,'bermuda')",[gameIds[i],context.event,session,group,i+1]);
  await db.query('insert into event_registrations(id,event_id,session_id,team_id,group_id,roster_json) values($1,$2,$3,$4,$5,$6::jsonb)',[registration,context.event,session,context.team,group,JSON.stringify([context.player])]);
  await db.query('update event_sessions set start_time=$2,end_time=$3 where id=$1',[session,iso(begins),iso(ends)]);
  const storedEnd=Date.parse((await db.query('select end_time from event_sessions where id=$1',[session])).rows[0].end_time);
  const document={rules:{mode:'training',criterion:'points',ratingEnabled:false},mvps:[],rows:gameIds.map(game=>({registrationId:registration,gameId:game,groupId:group,teamId:context.team,userId:null,name:'Cap organization',played:true,reason:'no_show',detail:'players',place:1,kills:1,points:10,fieldSize:2,rounds:null,players:[{id:context.player,userId:context.player,nickname:'Cap player',played:true,kills:1,deaths:0,assists:0}]})),standings:[{registrationId:registration,teamId:context.team,userId:null,groupId:group,name:'Cap organization',place:1,kills:games,points:10*games,placeSum:games,wins:games,gamesPlayed:games,bonus:0,manual:false}]};
  let revision=0;
  const publish=async(doc=document,key=randomUUID(),expected=revision)=>{
   const config=(await db.query('select configuration_revision from event_sessions where id=$1',[session])).rows[0].configuration_revision;
   const draft={rows:doc.rows,warnings:[],manualOrder:[],snapshots:[]};
   const result=(await db.query('select u2_save_results($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb) value',[owner,session,expected,config,key,JSON.stringify(doc),JSON.stringify(draft),JSON.stringify(doc)])).rows[0].value;
   revision=result.revision;return result;
  };
  return{session,ends:storedEnd,document,publish};
 };
 const closure=async(context)=>(await db.query('select * from contract_limit_closures where contract_id=$1 and revision=1',[context.contract])).rows[0];
 const ended=await makeContract(12010,{unit:'sessions',count:1,completion:'contract'});
 assert.deepEqual(await account('player',ended.player),{balance:2000,reserved:0});
 assert.deepEqual(await account('organization',ended.team),{balance:3000,reserved:1000});
 const withdrawal=await wallet('withdraw_request',{fullNameLatin:'Test Player',transferCountry:'Россия',amount:1500,note:'Protect already reserved player coins'},ended.player);
 await wallet('transfer',{userId:recipient,amount:400},ended.player);
 const final=await makeSession(ended,12030,start+2*day+16*3600000),key=randomUUID();
 const beforeFailure={player:await account('player',ended.player),organization:await account('organization',ended.team),entries:await countEntries()};
 await db.exec(`create function public.test_limit_execution_failure() returns trigger language plpgsql as $$begin if new.source_key='limit-period:1:0' then raise exception 'TEST_LIMIT_SALARY_FAILURE';end if;return new;end $$;
 create trigger test_limit_execution_failure before insert on contract_obligations for each row execute function public.test_limit_execution_failure();`);
 try{await assert.rejects(()=>final.publish(final.document,key),/TEST_LIMIT_SALARY_FAILURE/);}
 finally{await db.exec('drop trigger test_limit_execution_failure on contract_obligations;drop function public.test_limit_execution_failure();');}
 assert.equal(await closure(ended),undefined,'payroll failure rolls back count-based expiry');
 assert.equal((await db.query('select count(*)::int n from competition_publications where session_id=$1',[final.session])).rows[0].n,0,'failed salary correction also rolls back result publication');
 assert.equal((await db.query('select count(*)::int n from contract_limit_runtime_cache')).rows[0].n,0);
 assert.deepEqual({player:await account('player',ended.player),organization:await account('organization',ended.team),entries:await countEntries()},beforeFailure);
 await final.publish(final.document,key);
 const closed=await closure(ended);assert.ok(closed);assert.equal(Date.parse(closed.ends_at),final.ends);
 assert.deepEqual(await account('player',ended.player),{balance:1500,reserved:1500});
 assert.deepEqual(await account('organization',ended.team),{balance:3100,reserved:0});
 assert.equal(await debt(ended.player),1600,'only free money returns; protected reserve and already spent coins become recovery debt');
 const adjustments=(await db.query('select * from contract_limit_salary_adjustments where contract_id=$1 order by period_index',[ended.contract])).rows;
 assert.deepEqual(adjustments.map(row=>Number(row.expected_amount)),[270,0]);
 const partialSalary=(await db.query("select amount::int,paid::int,due_at from contract_obligations where contract_id=$1 and source_key='limit-period:1:0'",[ended.contract])).rows[0];
 assert.equal(partialSalary.amount,270);assert.equal(partialSalary.paid,270);assert.equal(Date.parse(partialSalary.due_at),final.ends);
 const beforeRepeat=await countEntries();await final.publish(final.document,key,0);await final.publish();await db.query('select contract_salary_process($1)',[ended.contract]);
 assert.equal(await countEntries(),beforeRepeat,'retries and new identical publications do not repeat salary corrections or awards');
 const list=(await db.query('select contract_query($1,$2::jsonb) value',[ended.player,JSON.stringify({contractId:ended.contract})])).rows[0].value;
 assert.equal(list.contracts[0].status,'completed');assert.equal(Date.parse(list.contracts[0].effectiveEndsAt),final.ends);
 const absent=structuredClone(final.document);absent.rows.forEach(row=>{row.played=false;row.place=null;row.kills=0;row.points=0;row.players=[];});
 absent.standings[0]={...absent.standings[0],gamesPlayed:0,kills:0,points:0,wins:0};await final.publish(absent);
 assert.equal(Date.parse((await closure(ended)).ends_at),final.ends,'an ended agreement is never reopened by result correction');
 assert.equal(await debt(ended.player),1630);
 const later=await makeSession(ended,12040,start+4*day);await later.publish();
 assert.equal((await db.query('select count(*)::int n from contract_session_terms where session_id=$1 and contract_id=$2',[later.session,ended.contract])).rows[0].n,0,'later sessions cannot activate expired contract terms');
 await wallet('withdraw_cancel',{withdrawalId:withdrawal.operationId},ended.player);
 assert.equal(await debt(ended.player),130);

 const timed=await makeContract(12050,{unit:'sessions',count:1,completion:'event_payments'});
 const paid=await makeSession(timed,12060,start+2*day+16*3600000);await paid.publish();
 const unpaid=await makeSession(timed,12070,start+4*day);await unpaid.publish();
 assert.equal(await closure(timed),undefined);assert.deepEqual(await account('player',timed.player),{balance:2030,reserved:0});
 assert.deepEqual(await account('organization',timed.team),{balance:2970,reserved:1000},'time-based salary reserve remains after event payments reach their cap');
 const timedPlan=(await db.query('select contract_session_accrual_plan($1,$2) value',[unpaid.session,timed.contract])).rows[0].value;
 assert.equal(timedPlan.limitIncluded,false);assert.deepEqual(timedPlan.entries,[]);
 assert.equal(Date.parse((await db.query('select contract_effective_end($1,1) value',[timed.contract])).rows[0].value),Date.parse(timed.terms.endsAt));
 const timedAbsent=structuredClone(paid.document);timedAbsent.rows.forEach(row=>{row.played=false;row.place=null;row.kills=0;row.points=0;row.players=[];});
 timedAbsent.standings[0]={...timedAbsent.standings[0],gamesPlayed:0,kills:0,points:0,wins:0};await paid.publish(timedAbsent);
 assert.equal((await db.query('select contract_session_accrual_plan($1,$2) value',[unpaid.session,timed.contract])).rows[0].value.limitIncluded,true,'corrected absence shifts an event-payment cap to the next actual session');
 assert.deepEqual(await account('player',timed.player),{balance:2030,reserved:0});
 await paid.publish();assert.equal((await db.query('select contract_session_accrual_plan($1,$2) value',[unpaid.session,timed.contract])).rows[0].value.limitIncluded,false);
 assert.deepEqual(await account('player',timed.player),{balance:2030,reserved:0},'downstream cap corrections preserve the exact total');

 const games=await makeContract(12080,{unit:'games',count:4,completion:'contract'},false);
 const gameFirst=await makeSession(games,12090,start+2*day,3);await gameFirst.publish();
 const gameLast=await makeSession(games,12100,start+3*day,3);await gameLast.publish();
 assert.deepEqual(await account('player',games.player),{balance:100,reserved:0},'the last three-game session pays fully even when only one game remained');
 assert.equal((await db.query('select contract_limit_progress($1,1) value',[games.contract])).rows[0].value.used,6);
 assert.equal(Date.parse((await closure(games)).ends_at),gameLast.ends);

 const unfunded=await makeContract(12120,{unit:'sessions',count:1,completion:'contract'},true,false);
 const late=await makeSession(unfunded,12130,start+15*day-3600000);await late.publish();
 const unpaidSalary=(await db.query("select id,amount::int,paid::int,held::int from contract_obligations where contract_id=$1 and source_key='limit-period:1:1'",[unfunded.contract])).rows[0];
 assert.equal(unpaidSalary.amount,500);assert.equal(unpaidSalary.paid,0);assert.equal(unpaidSalary.held,0,'a past unfunded salary remains manual despite available organization coins');
 await late.publish();assert.equal(Number((await db.query('select paid from contract_obligations where id=$1',[unpaidSalary.id])).rows[0].paid),0);
 await db.query('select contract_debt_pay($1,$2,$3,500)',[owner,randomUUID(),unpaidSalary.id]);
 assert.equal(Number((await db.query('select paid from contract_obligations where id=$1',[unpaidSalary.id])).rows[0].paid),500);

 // A supported limited renewal uses the original agreement chain and no new
 // welcome payment, while obtaining a new independent appearance counter.
 const renewal=structuredClone(ended.terms);renewal.startsAt=iso(now+day);renewal.financial.signingAmount=500;renewal.limit.count=2;
 const mutate=async(actor,input)=>(await db.query('select contract_mutate($1,$2::jsonb) value',[actor,JSON.stringify({...input,requestId:randomUUID()})])).rows[0].value;
 await mutate(owner,{action:'save',contractId:ended.contract,expectedRevision:1,organizationId:ended.team,playerId:ended.player,kind:'main',eventId:null,sessionId:null,terms:renewal});
 await mutate(owner,{action:'offer',contractId:ended.contract,revision:2});
 assert.equal((await mutate(ended.player,{action:'accept',contractId:ended.contract,revision:2})).status,'signed');
 assert.equal((await db.query("select count(*)::int n from contract_obligations where contract_id=$1 and kind='signing'",[ended.contract])).rows[0].n,1);
 assert.equal((await db.query('select contract_limit_progress($1,2) value',[ended.contract])).rows[0].value.used,0);
 assert.equal((await db.query('select count(*)::int n from contract_limit_closures where contract_id=$1',[ended.contract])).rows[0].n,1,'renewal keeps the original immutable closure');
 assert.equal((await db.query('select count(*)::int n from contract_limit_runtime_cache')).rows[0].n,0,'transaction-local calculation cache is discarded after settlement');
 await assert.rejects(()=>db.query('update contract_limit_closures set ends_at=now() where id=$1',[closed.id]),/CONTRACT_IMMUTABLE/);
 await db.exec('set role service_role');
 try{
  await assert.rejects(()=>db.query('select contract_limit_finalize($1,1)',[ended.contract]),/permission denied/);
  await assert.rejects(()=>db.query('select contract_salary_close_for_limit($1)',[closed.id]),/permission denied/);
  await assert.rejects(()=>db.query('select * from contract_limit_salary_adjustments'),/permission denied/);
  await assert.rejects(()=>db.query('select * from contract_limit_runtime_cache'),/permission denied/);
 }finally{await db.exec('reset role');}
 console.log('PASS: atomic limit expiry, late payroll proration/correction, protected player reserves and repayment debt, no automatic reopening, calendar salary independence, full last session, supported renewal and private execution');
}
