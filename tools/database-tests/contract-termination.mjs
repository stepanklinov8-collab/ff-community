import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {defaultTerms} from '../../src/modules/contracts/model.ts';

export async function verifyContractTermination(db,id){
 const owner=id(18000),outsider=id(18001),day=86400000,now=Math.floor(Date.now()/1000)*1000,iso=t=>new Date(t).toISOString();
 for(const user of [owner,outsider]){await db.query('insert into auth.users(id) values($1)',[user]);await db.query('insert into profiles(id,nickname) values($1,$2)',[user,'Termination '+user.slice(-4)]);}
 await db.query("insert into user_roles(user_id,role) values($1,'superadmin')",[owner]);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
 const wallet=async(actor,action,input)=>(await db.query('select u6_coin_action($1,$2,$3,$4::jsonb) value',[actor,randomUUID(),action,JSON.stringify(input)])).rows[0].value;
 await wallet(owner,'adjust',{kind:'player',ownerId:owner,amount:2000,reason:'Rich owner is not the organization account'});
 const make=async(n,salary=false,orgFunds=0,mixed=null)=>{
  const player=id(n),team=id(n+1),contract=id(n+2),terms=defaultTerms(new Date(now-3*day));
  terms.playerExit={kind:'fixed',amount:100};terms.organizationTermination={kind:'fixed',amount:200};
  terms.financial.overdueCompensation={kind:'combined',amount:20,basisPoints:5000,base:{kind:'contract_debt'},selection:'maximum'};
  if(salary)terms.financial.salary={amount:100,periodDays:10};
  if(mixed){terms.playerExit=mixed;terms.organizationTermination=mixed;}
  await db.query('select contract_validate_terms($1::jsonb)',[JSON.stringify(terms)]);
  await db.query('insert into auth.users(id) values($1)',[player]);await db.query('insert into profiles(id,nickname) values($1,$2)',[player,'Term player '+n]);
  await db.query("insert into teams(id,name,type,leader_id,verified) values($1,$2,'team',$3,true)",[team,'Term organization '+n,owner]);
  await db.query("insert into team_members(team_id,user_id,role_in_team) values($1,$2,'main')",[team,player]);
  await db.query("insert into organization_contracts(id,organization_id,player_id,kind,created_by) values($1,$2,$3,'main',$4)",[contract,team,player,owner]);
  await db.query("insert into organization_contract_versions(contract_id,revision,terms,created_by,status) values($1,1,$2::jsonb,$3,'offered')",[contract,JSON.stringify(terms),owner]);
  await db.query('insert into contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at) values($1,1,$2,$3,1,$4,$4)',[contract,owner,player,iso(now-3*day)]);
  await wallet(owner,'adjust',{kind:'organization',ownerId:team,amount:orgFunds,reason:'Fund termination test organization'});
  await db.query('select contract_financial_start($1,1,$2)',[contract,iso(now-3*day)]);
  return{player,team,contract};
 };
 const terminate=async(actor,context,mode,expected=null,key=randomUUID(),party=actor===context.player?'player':'organization')=>(await db.query('select contract_terminate($1,$2,$3,1,$4,$5,$6) value',[actor,key,context.contract,mode,expected,mode==='mutual'?party:null])).rows[0].value;
 const quote=async(actor,context)=>(await db.query('select contract_termination_query($1,$2) value',[actor,context.contract])).rows[0].value;
 const balance=async(user)=>Number((await db.query('select coalesce((select balance from coin_accounts where user_id=$1),0) value',[user])).rows[0].value);
 const member=async(c)=>(await db.query('select count(*)::int n from team_members where team_id=$1 and user_id=$2',[c.team,c.player])).rows[0].n;
 const mutual=await make(18010,true,500);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[mutual.player]);
 await assert.rejects(()=>db.query('select leave_organization($1)',[mutual.team]),/CONTRACT_ACTIVE_MEMBERSHIP/);
 await assert.rejects(()=>db.query('delete from team_members where team_id=$1',[mutual.team]),/CONTRACT_ACTIVE_MEMBERSHIP/);
 await assert.rejects(()=>db.query('update teams set dissolved_at=now() where id=$1',[mutual.team]),/CONTRACT_ACTIVE_MEMBERSHIP/);
 await assert.rejects(()=>quote(outsider,mutual),/CONTRACT_NOT_FOUND/);await assert.rejects(()=>terminate(outsider,mutual,'organization',200),/CONTRACT_FORBIDDEN/);
 const request=randomUUID();assert.equal((await terminate(mutual.player,mutual,'mutual',null,request)).pending,true);
 assert.equal((await terminate(mutual.player,mutual,'mutual',null,request)).pending,true);assert.equal((await quote(mutual.player,mutual)).active,true);
 await terminate(owner,mutual,'decline');assert.equal((await quote(mutual.player,mutual)).pending,null);
 await terminate(mutual.player,mutual,'mutual');const approved=await terminate(owner,mutual,'mutual');
 assert.equal(approved.ended,true);assert.equal(approved.amount,0);assert.equal(await member(mutual),1,'termination alone does not remove membership');
 assert.equal(await balance(mutual.player),30,'last salary period pays actual earned time, floored to a coin');
 const salaryEntries=(await db.query('select count(*)::int n from coin_entries')).rows[0].n;await db.query('select contract_salary_process($1)',[mutual.contract]);assert.equal((await db.query('select count(*)::int n from coin_entries')).rows[0].n,salaryEntries);
 await db.query('select leave_organization($1)',[mutual.team]);assert.equal(await member(mutual),0,'ordinary exit is available after the agreement really ended');
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
 const exit=await make(18020);await wallet(owner,'adjust',{kind:'player',ownerId:exit.player,amount:100,reason:'Player exit fee'});
 const reserved=await wallet(exit.player,'withdraw_request',{amount:80,note:'Do not spend reserved player money'});
 await assert.rejects(()=>terminate(exit.player,exit,'player_exit',101),/CONTRACT_QUOTE_CHANGED/);
 await assert.rejects(()=>terminate(exit.player,exit,'player_exit',100),/CONTRACT_FUNDS/);assert.equal((await quote(exit.player,exit)).active,true);
 await wallet(exit.player,'withdraw_cancel',{withdrawalId:reserved.operationId});const exitKey=randomUUID();
 assert.equal((await terminate(exit.player,exit,'player_exit',100,exitKey)).amount,100);await terminate(exit.player,exit,'player_exit',100,exitKey);
 assert.equal(await balance(exit.player),0);assert.equal((await db.query('select balance::int n from coin_accounts where team_id=$1',[exit.team])).rows[0].n,100);
 await assert.rejects(()=>terminate(exit.player,exit,'player_exit',100),/CONTRACT_TERMINATED/);
 const dismissal=await make(18030,false,50),ownerBalance=await balance(owner);
 const beforeFailure=(await db.query('select count(*)::int n from coin_entries')).rows[0].n;
 await db.exec(`create function test_termination_failure() returns trigger language plpgsql as $$begin if new.kind='termination' then raise exception 'TEST_TERMINATION_FAILURE';end if;return new;end $$;
 create trigger test_termination_failure before insert on contract_obligations for each row execute function test_termination_failure();`);
 try{await assert.rejects(()=>terminate(owner,dismissal,'organization',200),/TEST_TERMINATION_FAILURE/);}finally{await db.exec('drop trigger test_termination_failure on contract_obligations;drop function test_termination_failure();');}
 assert.equal((await quote(owner,dismissal)).active,true);assert.equal((await db.query('select count(*)::int n from coin_entries')).rows[0].n,beforeFailure,'failed compensation rolls back expiry and every money movement');
 const dismissed=await terminate(owner,dismissal,'organization',200);assert.equal(dismissed.ended,true);assert.equal(await balance(owner),ownerBalance);
 assert.deepEqual((await db.query('select amount::int,paid::int,held::int from contract_obligations where id=$1',[dismissed.obligationId])).rows[0],{amount:200,paid:0,held:0});
 await assert.rejects(()=>wallet(owner,'withdraw_request',{teamId:dismissal.team,amount:1,note:'Debt must block withdrawal'}),/CONTRACT_DEBT_WITHDRAWAL/);
 const unpaid=await make(18040);
 await db.query("select contract_obligation_create($1,1,'kill','overdue-test',100,$2,false)",[unpaid.contract,iso(now-8*day)]);
 assert.equal((await quote(unpaid.player,unpaid)).overdueSevenDays,true);assert.equal((await quote(unpaid.player,unpaid)).active,true,'even overdue salary never ends the contract automatically');
 const endedUnpaid=await terminate(unpaid.player,unpaid,'unpaid');assert.equal(endedUnpaid.amount,50);assert.equal(endedUnpaid.debt,100);
 assert.equal((await db.query('select sum(amount-paid)::int n from contract_obligations where contract_id=$1 and cancelled_at is null',[unpaid.contract])).rows[0].n,150,'earned debt and extra compensation survive termination');
 const recent=await make(18050);await db.query("select contract_obligation_create($1,1,'kill','recent-test',100,$2,false)",[recent.contract,iso(now-6*day)]);
 await assert.rejects(()=>terminate(recent.player,recent,'unpaid'),/CONTRACT_NOT_OVERDUE/);assert.equal((await quote(recent.player,recent)).active,true);
 const changedOwner=await make(18060);await terminate(changedOwner.player,changedOwner,'mutual');
 await db.query("select set_config('omcite.allow_organization_owner_transfer','on',false)");
 await db.query('update teams set owner_user_id=$2 where id=$1',[changedOwner.team,outsider]);
 await db.query("select set_config('omcite.allow_organization_owner_transfer','off',false)");
 assert.equal((await terminate(outsider,changedOwner,'mutual')).pending,true,'new ownership invalidates the old unfinished consent');
 assert.equal((await quote(changedOwner.player,changedOwner)).pending.playerSigned,false);
 assert.equal((await terminate(changedOwner.player,changedOwner,'mutual')).ended,true);
 const self=await make(18070);
 await db.query("select set_config('omcite.allow_organization_owner_transfer','on',false)");await db.query('update teams set owner_user_id=$2 where id=$1',[self.team,self.player]);await db.query("select set_config('omcite.allow_organization_owner_transfer','off',false)");
 assert.equal((await terminate(self.player,self,'mutual')).pending,true);
 assert.equal((await terminate(self.player,self,'mutual',null,randomUUID(),'organization')).ended,true,'an owner-player explicitly confirms each party, rather than being unable to finish a self-owned contract');
 const combined={kind:'combined',amount:40,basisPoints:2000,selection:'maximum'};
 for(const [selection,basis,expected] of [['maximum',100,40],['maximum',300,60],['minimum',100,20],['minimum',300,40],['minimum',0,0]]){
  assert.equal(Number((await db.query('select contract_compensation_amount($1::jsonb,$2) amount',[JSON.stringify({...combined,selection}),basis])).rows[0].amount),expected);
 }
 const mixedExit=await make(18080,false,0,combined),mixedQuote=await quote(mixedExit.player,mixedExit);
 assert.equal(mixedQuote.playerValue,0);assert.equal(mixedQuote.playerExitAmount,40);
 await wallet(owner,'adjust',{kind:'player',ownerId:mixedExit.player,amount:40,reason:'Combined exit compensation'});
 const mixedKey=randomUUID();await terminate(mixedExit.player,mixedExit,'player_exit',40,mixedKey);await terminate(mixedExit.player,mixedExit,'player_exit',40,mixedKey);
 assert.equal(await balance(mixedExit.player),0);assert.equal((await db.query('select balance::int n from coin_accounts where team_id=$1',[mixedExit.team])).rows[0].n,40,'combined exit transfers selected amount exactly once, not fixed plus percent');
 assert.equal((await db.query('select amount::int,player_value::int from contract_terminations where contract_id=$1',[mixedExit.contract])).rows[0].player_value,0,'termination preserves server valuation');
 const mixedDismissal=await make(18090,false,40,combined);
 const ownerBeforeMixed=await balance(owner);await terminate(owner,mixedDismissal,'organization',40);
 assert.equal(await balance(mixedDismissal.player),40);assert.equal(await balance(owner),ownerBeforeMixed,'combined dismissal uses only the organization wallet');
 const zeroMinimum=await make(18100,false,0,{...combined,selection:'minimum'});
 assert.equal((await quote(zeroMinimum.player,zeroMinimum)).playerExitAmount,0);await terminate(zeroMinimum.player,zeroMinimum,'player_exit',0);
 assert.equal((await db.query('select amount::int from contract_terminations where contract_id=$1',[zeroMinimum.contract])).rows[0].amount,0);
 await db.exec('set role authenticated');try{await assert.rejects(()=>quote(recent.player,recent),/permission denied/);await assert.rejects(()=>db.query('select * from contract_terminations'),/permission denied/);}finally{await db.exec('reset role');}
 console.log('PASS: two-party mutual termination, decline/replay, partial salary, membership protection, reserve-safe exit fee, combined min/max signing/quote/execution, changed quote rejection, organization-only compensation debt and seven-day unpaid termination');
}
