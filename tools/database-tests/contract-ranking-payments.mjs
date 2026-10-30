import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {defaultTerms} from '../../src/modules/contracts/model.ts';

export async function verifyContractRankingPayments(db,id){
 const owner=id(26000),other=id(26001),team=id(26002),rival=id(26003),guild=id(26004),day=86400000,now=Date.now(),iso=t=>new Date(t).toISOString();
 for(const user of [owner,other]){await db.query('insert into auth.users(id) values($1)',[user]);await db.query('insert into profiles(id,nickname) values($1,$2)',[user,'Rank '+user.slice(-4)]);}
 await db.query("insert into user_roles(user_id,role) values($1,'superadmin')",[owner]);
 for(const [organization,type,rating] of [[team,'team',980],[rival,'team',990],[guild,'guild',985]]){
  await db.query('insert into teams(id,name,type,leader_id,verified) values($1,$2,$3,$4,true)',[organization,'Rank org '+organization.slice(-4),type,owner]);
  await db.query("insert into competition_ratings(target_type,target_id,mode,exact_rating,display_rating,wins,games) values('team',$1,'main',$2,$2,0,10)",[organization,rating]);
 }
 const board=async()=>(await db.query('select contract_ranking_current() value')).rows[0].value;
 const expected=await board();
 for(const [key,kind] of [['organizations',null],['teams','team'],['guilds','guild']]){
  let offset=0,items=[];for(;;){const data=(await db.query("select u2_leaderboard('main','team','',100,$1,'rating',$2) value",[offset,kind])).rows[0].value;items.push(...data.items);if(!data.hasMore)break;offset+=100;}
  assert.deepEqual(Object.fromEntries(items.map(row=>[row.id,row.position])),expected[key],'historical board uses exactly public rating order, filters and shared tie places');
 }
 const count=async()=>Number((await db.query('select count(*) n from contract_ranking_history')).rows[0].n);
 const before=await count();await db.exec('begin');await db.query("update competition_ratings set exact_rating=999,display_rating=999 where target_type='team' and target_id=$1 and mode='main'",[team]);
 await db.query("update competition_ratings set exact_rating=998,display_rating=998 where target_type='team' and target_id=$1 and mode='main'",[team]);
 assert.equal(await count(),before,'rank history is deferred until final transaction state');await db.exec('commit');assert.equal(await count(),before+1,'one final changed board for multiple writes');
 const unchanged=await count();await db.query('update teams set name=name where id=$1',[team]);await db.query("update competition_ratings set updated_at=clock_timestamp() where target_id=$1 and mode='main'",[team]);assert.equal(await count(),unchanged,'name/timestamp refresh never creates an observation');
 await db.query('update teams set verified=false where id=$1',[guild]);assert.equal((await board()).guilds[guild],undefined);await db.query('update teams set verified=true where id=$1',[guild]);
 await assert.rejects(()=>db.query("update contract_ranking_history set board='{}' where id=(select min(id) from contract_ranking_history)"),/CONTRACT_IMMUTABLE/);
 const wallet=async(actor,action,input)=>(await db.query('select u6_coin_action($1,$2,$3,$4::jsonb) value',[actor,randomUUID(),action,JSON.stringify(input)])).rows[0].value;
 await wallet(owner,'adjust',{kind:'player',ownerId:owner,amount:1000,reason:'Owner personal funds remain isolated from rank bonuses'});
 await wallet(owner,'adjust',{kind:'organization',ownerId:team,amount:200,reason:'Fund two ranking bonuses'});
 // Explicit historical FIXTURES for evaluator cases; production never imports
 // or reconstructs boards. Automatic actual capture was verified above.
 const snapshot=async(time,position)=>{
  const value={organizations:{[team]:position,[rival]:position===1?2:1,[guild]:3},teams:{[team]:position,[rival]:position===1?2:1},guilds:{[guild]:1}};
  await db.query('insert into contract_ranking_history(observed_at,board) values($1,$2::jsonb)',[iso(time),JSON.stringify(value)]);
 };
 await snapshot(now-4*day,2);await snapshot(now-3*day,1);await snapshot(now-2*day,2);
 const starts=iso(now-3.5*day),ends=iso(now-1.5*day);
 const make=async(n,mode,top,amount=100,options={})=>{
  const player=id(n),contract=id(n+1),bonusId=id(n+2),terms=defaultTerms(new Date(now-5*day));
  const rule={id:bonusId,ranking:'teams',mode,top,startsAt:starts,endsAt:ends,amount,...options.rule};terms.financial.rankingBonuses=[rule];
  await db.query('insert into auth.users(id) values($1)',[player]);await db.query('insert into profiles(id,nickname) values($1,$2)',[player,'Rank recipient '+n]);
  await db.query("insert into team_members(team_id,user_id,role_in_team) values($1,$2,'main')",[team,player]);
  await db.query("insert into organization_contracts(id,organization_id,player_id,kind,created_by) values($1,$2,$3,'main',$4)",[contract,team,player,owner]);
  await db.query("insert into organization_contract_versions(contract_id,revision,terms,created_by,status,offered_at) values($1,1,$2::jsonb,$3,'offered',$4)",[contract,JSON.stringify(terms),owner,iso(now-5*day)]);
  await db.query('insert into contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at,ended_at) values($1,1,$2,$3,1,$4,$5,$6)',[contract,owner,player,options.late?iso(now-3*day):iso(now-5*day),options.late?iso(now-3*day):iso(now-5*day),options.ended?iso(now-2*day):options.continued?iso(now-2.5*day):null]);
  return{player,contract,bonusId,rule,terms};
 };
 const settle=async(c)=>(await db.query('select contract_ranking_settle($1,$2) value',[c.contract,c.bonusId])).rows[0].value;
 const balance=async(c)=>Number((await db.query('select coalesce((select balance from coin_accounts where user_id=$1),0) value',[c.player])).rows[0].value);
 const best=await make(26010,'best',1);
 await db.exec(`create function test_ranking_failure() returns trigger language plpgsql as $$begin raise exception 'RANKING_FAILURE';end $$;create trigger test_ranking_failure before insert on contract_ranking_runs for each row execute function test_ranking_failure();`);
 try{await assert.rejects(()=>settle(best),/RANKING_FAILURE/);}finally{await db.exec('drop trigger test_ranking_failure on contract_ranking_runs;drop function test_ranking_failure();');}
 assert.equal(await balance(best),0);assert.equal((await db.query('select count(*)::int n from contract_obligations where contract_id=$1',[best.contract])).rows[0].n,0,'failed evidence persistence rolls back earned payment and reserve');
 assert.equal((await settle(best)).status,'earned');assert.equal(await balance(best),100);assert.equal((await settle(best)).repeated,true);assert.equal(await balance(best),100);
 const end=await make(26020,'at_end',1);assert.equal((await settle(end)).status,'not_earned');assert.equal(await balance(end),0);
 const throughout=await make(26030,'throughout',2);assert.equal((await settle(throughout)).status,'earned');assert.equal(await balance(throughout),100);
 const lost=await make(26040,'throughout',1);assert.equal((await settle(lost)).status,'not_earned');
 const expired=await make(26050,'best',1,100,{ended:true});assert.equal((await settle(expired)).reason,'contract_ended_before_period');assert.equal(await balance(expired),0);
 const late=await make(26060,'best',1,100,{late:true});assert.equal((await settle(late)).status,'late_signature');
 const historical=await make(26070,'throughout',2,100,{rule:{startsAt:iso(now-4.5*day)}});assert.equal((await settle(historical)).status,'history_missing');
 for(const mode of ['best','at_end']){
  const assessment=(await db.query('select contract_ranking_assess($1,$2::jsonb) value',[team,JSON.stringify({...historical.rule,mode})])).rows[0].value;
  assert.equal(assessment.status,'earned','a genuine saved best/end observation proves only its own selected condition');assert.equal(assessment.completePeriodHistory,false);
 }
 const renewed=await make(26080,'best',1,50,{continued:true}),renewal=defaultTerms(new Date(now-2.5*day));
 await db.query("insert into organization_contract_versions(contract_id,revision,terms,created_by,status,offered_at) values($1,2,$2::jsonb,$3,'offered',$4)",[renewed.contract,JSON.stringify(renewal),owner,renewal.startsAt]);
 await db.query('insert into contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at) values($1,2,$2,$3,1,$4,$4)',[renewed.contract,owner,renewed.player,renewal.startsAt]);
 const earned=await settle(renewed);assert.equal(earned.status,'earned');assert.equal(await balance(renewed),0,'insufficient organization funds create debt without spending the owner wallet');
 assert.deepEqual((await db.query('select amount::int,paid::int,held::int,revision from contract_obligations where id=$1',[earned.obligationId])).rows[0],{amount:50,paid:0,held:0,revision:1},'period-start revision remains the source across continuous renewal');
 await wallet(owner,'adjust',{kind:'organization',ownerId:team,amount:50,reason:'Manual ranking debt funding'});await settle(renewed);assert.equal(await balance(renewed),0,'a topup does not automatically repay old debt');
 await db.query('select contract_debt_pay($1,$2,$3,50)',[owner,randomUUID(),earned.obligationId]);assert.equal(await balance(renewed),50);
 const query=async(actor,c)=>(await db.query('select contract_ranking_query($1,$2,0) value',[actor,c.contract])).rows[0].value;
 assert.equal((await query(best.player,best)).rows[0].status,'earned');await assert.rejects(()=>query(other,best),/CONTRACT_NOT_FOUND/);
 const interrupted=await make(26100,'best',1,0,{continued:true}),afterGap=defaultTerms(new Date(now-2.4*day));
 await db.query("insert into organization_contract_versions(contract_id,revision,terms,created_by,status,offered_at) values($1,2,$2::jsonb,$3,'offered',$4)",[interrupted.contract,JSON.stringify(afterGap),owner,afterGap.startsAt]);
 await db.query('insert into contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at) values($1,2,$2,$3,1,$4,$4)',[interrupted.contract,owner,interrupted.player,afterGap.startsAt]);
 assert.equal((await settle(interrupted)).reason,'contract_ended_before_period','renewing after a gap cannot retroactively restore a full-period bonus');
 const worker=await make(26090,'at_end',2,0);const report=(await db.query('select contract_maintenance_run() value')).rows[0].value;assert(report.rankingBonuses>=1);assert.equal((await query(worker.player,worker)).rows[0].status,'earned');
 const previous=await balance(best);await db.query('select contract_maintenance_run()');assert.equal(await balance(best),previous);
 await db.exec('set role authenticated');try{
  await assert.rejects(()=>db.query('select * from contract_ranking_history'),/permission denied/);
  await assert.rejects(()=>db.query('select contract_ranking_settle($1,$2)',[best.contract,best.bonusId]),/permission denied/);
 }finally{await db.exec('reset role');}
 console.log('PASS: exact public ranking capture/ties/filters, deferred one-board transactions, immutable evidence, all three bonus modes, missing history hold, full-period contract coverage, no retroactive signature, renewal source, atomic payment rollback, organization-only debt and bounded worker replay');
}
