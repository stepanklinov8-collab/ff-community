import assert from 'node:assert/strict';
import {defaultTerms,mutationSchema} from '../../src/modules/contracts/model.ts';
import {splitContractPrize,compensationAmount} from '../../src/modules/contracts/calculations.ts';

export async function verifyContractProposals(db,id){
 const owner=id(9010),leader=id(9011),player=id(9012),delegate=id(9013),stranger=id(9014),team=id(9020),guestEvent=id(9021);
 for(const [user,nickname] of [[owner,'Contract owner'],[leader,'Contract leader'],[player,'Contract player'],[delegate,'Contract representative'],[stranger,'Private outsider']]){
  await db.query('insert into auth.users(id) values($1)',[user]);await db.query('insert into profiles(id,nickname) values($1,$2)',[user,nickname]);
 }
 await db.query("insert into teams(id,name,type,leader_id) values($1,'Contract organization','team',$2)",[team,owner]);
 await db.query("insert into team_members(team_id,user_id,role_in_team) values($1,$2,'leader'),($1,$3,'main'),($1,$4,'main')",[team,leader,player,delegate]);
 await db.query('update teams set leader_id=$2 where id=$1',[team,leader]);
 await db.query('insert into organization_contract_access(team_id,user_id,granted_by) values($1,$2,$3)',[team,delegate,owner]);
 await db.query("insert into events(id,title,type,organizer_user_id,is_published) values($1,'Contract guest event','training',$2,true)",[guestEvent,owner]);
 const terms=defaultTerms(new Date('2026-12-01T10:00:00Z'));
 terms.financial.signingAmount=300;
 terms.financial.salary={amount:1000,periodDays:9};
 terms.financial.rates.perKill=5;
 terms.financial.overdueCompensation={kind:'combined',amount:1000,basisPoints:1000,base:{kind:'player_value'},selection:'maximum'};
 terms.financial.eventOverrides=[{eventId:guestEvent,values:{tournamentShareBps:3000,perKill:0}}];
 terms.financial.rankingBonuses=[{id:id(9022),ranking:'organizations',mode:'throughout',top:3,startsAt:terms.startsAt,endsAt:'2026-12-10T10:00:00Z',amount:500}];
 let operation=9050;
 const save={action:'save',requestId:id(operation++),contractId:id(9030),expectedRevision:0,organizationId:team,playerId:player,kind:'main',eventId:null,sessionId:null,terms};
 const mutate=async(actor,input)=> (await db.query('select contract_mutate($1,$2::jsonb) value',[actor,JSON.stringify(input)])).rows[0].value;
 const query=async(actor,input={})=> (await db.query('select contract_query($1,$2::jsonb) value',[actor,JSON.stringify(input)])).rows[0].value;
 assert(mutationSchema.safeParse(save).success);
 await assert.rejects(()=>mutate(stranger,save),/CONTRACT_FORBIDDEN/);
 const created=await mutate(delegate,save);
 assert.deepEqual((await query(delegate)).contracts[0].terms,terms,'constructor fields round-trip through SQL unchanged');
 assert.equal(created.revision,1);assert.deepEqual(await mutate(delegate,save),created,'replayed request returns original version');
 await assert.rejects(()=>mutate(delegate,{...save,terms:{...terms,trainingShareBps:5000}}),/CONTRACT_CONFLICT/);
 assert.equal((await query(player)).contracts.length,0,'draft private to organization managers');
 assert.equal((await query(stranger)).contracts.length,0);
 assert.equal((await query(delegate)).contracts.length,1);
 await assert.rejects(()=>mutate(delegate,{action:'offer',requestId:id(operation++),contractId:save.contractId,revision:1}),/CONTRACT_FINANCE/);
 await mutate(owner,{action:'offer',requestId:id(operation++),contractId:save.contractId,revision:1});
 assert.equal((await query(player)).contracts[0].status,'offered');
 await assert.rejects(()=>query(stranger,{contractId:save.contractId}),/CONTRACT_NOT_FOUND/);
 await assert.rejects(()=>db.query("update organization_contract_versions set terms=jsonb_set(terms,'{trainingShareBps}','9000') where contract_id=$1",[save.contractId]),/CONTRACT_IMMUTABLE/);
 await mutate(delegate,{...save,requestId:id(operation++),expectedRevision:1,terms:{...terms,trainingShareBps:3000}});
 assert.equal((await query(player)).contracts[0].revision,1,'new private draft does not hide previous sent conditions');
 assert.equal((await query(player)).contracts[0].status,'superseded');
 assert.equal((await query(player,{contractId:save.contractId,history:'true'})).versions.length,1,'recipient never sees unoffered draft');
 assert.equal((await query(owner,{contractId:save.contractId,history:'true'})).versions.length,2);
 await assert.rejects(()=>query(stranger,{contractId:save.contractId,history:'true'}),/CONTRACT_NOT_FOUND/);
 assert.equal((await db.query('select terms from organization_contract_versions where contract_id=$1 and revision=1',[save.contractId])).rows[0].terms.trainingShareBps,2000,'previous version survives changed terms');
 await assert.rejects(()=>mutate(player,{action:'reject',requestId:id(operation++),contractId:save.contractId,revision:1}),/CONTRACT_CONFLICT/);
 await mutate(leader,{action:'offer',requestId:id(operation++),contractId:save.contractId,revision:2});
 await mutate(player,{action:'reject',requestId:id(operation++),contractId:save.contractId,revision:2});
 assert.equal((await query(owner)).contracts[0].status,'rejected');
 await db.query('delete from organization_contract_access where team_id=$1 and user_id=$2',[team,delegate]);
 await assert.rejects(()=>mutate(delegate,save),/CONTRACT_FORBIDDEN/,'revoked representative cannot replay a private cached response');
 assert.equal((await query(delegate)).contracts.length,0);
 await assert.rejects(()=>query(delegate,{contractId:save.contractId,history:'true'}),/CONTRACT_NOT_FOUND/,'revoked representative loses version history');
 await assert.rejects(()=>mutate(owner,{...save,contractId:id(9031),requestId:id(operation++),playerId:stranger}),/CONTRACT_MEMBER/);
 await mutate(owner,{...save,contractId:id(9032),requestId:id(operation++),playerId:stranger,kind:'guest',eventId:guestEvent});
 assert.equal((await db.query('select count(*)::int n from team_members where team_id=$1 and user_id=$2',[team,stranger])).rows[0].n,0,'guest proposal never adds permanent membership');
 for(const invalid of [{...terms,trainingShareBps:10001},{...terms,trainingShareBps:null},{...terms,startsAt:'infinity'},{...terms,guestPolicy:'forbidden',guestCompensation:{kind:'fixed',amount:5}},
   {...terms,transfer:{kind:null}},{...terms,transfer:{kind:'fixed',amount:null}},{...terms,transfer:{kind:'fixed',amount:'10'}},
   {...terms,playerExit:{kind:'percent',basisPoints:null}},{...terms,limit:{unit:null,count:1}},{...terms,limit:{unit:'games',count:null}},
   {...terms,participation:{mode:null}},{...terms,participation:{mode:'minimum',games:null}},
   {...terms,participation:{mode:'any',games:10}},{...terms,transfer:{kind:'none',amount:900}},
   {...terms,startsAt:'2026-12-01'},{...terms,endsAt:100}]){
  assert.equal(mutationSchema.safeParse({...save,terms:invalid}).success,false,'API rejects malformed structured terms');
  await assert.rejects(()=>mutate(owner,{...save,contractId:id(operation++),requestId:id(operation++),terms:invalid}));
 }
 const financial=terms.financial;
 for(const changed of [
   {...financial,salary:{amount:10,periodDays:0}}, {...financial,salary:{amount:10,periodDays:1.5}},
   {...financial,salary:{amount:null,periodDays:1}}, {...financial,signingAmount:'100'},
   {...financial,rates:{...financial.rates,perKill:-1}}, {...financial,note:'hidden prose'},
   {...financial,overdueCompensation:{...financial.overdueCompensation,selection:'sum'}},
   {...financial,overdueCompensation:{...financial.overdueCompensation,base:{kind:'player_value',amount:999}}},
   {...financial,eventOverrides:[{eventId:guestEvent,values:{}}]},
   {...financial,eventOverrides:[...financial.eventOverrides,...financial.eventOverrides]},
   {...financial,eventOverrides:[{eventId:guestEvent,values:{perKill:null}}]},
   {...financial,rankingBonuses:[...financial.rankingBonuses,...financial.rankingBonuses]},
   {...financial,rankingBonuses:[{...financial.rankingBonuses[0],startsAt:'2026-01-01T00:00:00Z'}]},
 ]){
  const invalid={...terms,financial:changed};
  assert.equal(mutationSchema.safeParse({...save,terms:invalid}).success,false);
  await assert.rejects(()=>mutate(owner,{...save,contractId:id(operation++),requestId:id(operation++),terms:invalid}),/CONTRACT_/);
 }
 for(const base of [{kind:'specified',amount:5000},{kind:'player_value'},{kind:'contract_debt'}]){
  for(const selection of ['maximum','minimum']){
   const valid={...terms,financial:{...financial,overdueCompensation:{kind:'combined',amount:300,basisPoints:1000,base,selection}}};
   assert.equal(mutationSchema.safeParse({...save,terms:valid}).success,true);
   await db.query('select contract_validate_terms($1::jsonb)',[JSON.stringify(valid)]);
  }
 }
 const {schemaVersion,financial:unusedFinancial,...oldFields}=terms;void schemaVersion;void unusedFinancial;
 const historical={...oldFields,note:'Keep historical prose verbatim'};
 await db.query('insert into organization_contracts(id,organization_id,player_id,kind,created_by) values($1,$2,$3,$4,$5)',[id(9035),team,player,'main',owner]);
 await db.query('insert into organization_contract_versions(contract_id,revision,terms,created_by) values($1,1,$2::jsonb,$3)',[id(9035),JSON.stringify(historical),owner]);
 assert.equal((await query(owner,{contractId:id(9035)})).contracts[0].terms.note,historical.note);
 await assert.rejects(()=>mutate(owner,{action:'offer',requestId:id(operation++),contractId:id(9035),revision:1}),/CONTRACT_SCHEMA/);
 await assert.rejects(()=>mutate(owner,{...save,contractId:id(operation++),requestId:id(operation++),terms:historical}),/CONTRACT_SCHEMA/);
 await db.exec('set role authenticated');
 try{
  await assert.rejects(()=>db.query('select contract_query($1,$2::jsonb)',[owner,'{}']),/permission denied/);
  await assert.rejects(()=>db.query('select * from organization_contract_versions'),/permission denied/);
 }finally{await db.exec('reset role');}
 const roster=[1,2,3,4].map(n=>({playerId:String(n),shareBps:2000,playedGames:3,participation:{mode:'any'},guestObligations:[]}));
 const split=splitContractPrize(250,3,roster);
 assert.equal(split.organizationAmount,50);assert.deepEqual(split.payouts.map(row=>row.net),[50,50,50,50]);
 const partial=splitContractPrize(250,3,[{...roster[0],playedGames:1,participation:{mode:'proportional'},guestObligations:[{organizationId:'main-team',compensation:{kind:'percent',basisPoints:2000}},{organizationId:'main-guild',compensation:{kind:'percent',basisPoints:1000}}]}]);
 assert.equal(partial.organizationAmount,234);assert.equal(partial.payouts[0].gross,16);assert.equal(partial.payouts[0].net,12);
 assert.deepEqual(partial.payouts[0].toOrganizations.map(row=>row.amount),[3,1]);
 assert.equal(splitContractPrize(250,3,[]).organizationAmount,250,'without contracts prize stays with organization');
 assert.equal(splitContractPrize(250,3,[{...roster[0],playedGames:0}]).payouts[0].net,0);
 assert.throws(()=>splitContractPrize(1,1,[{...roster[0],playedGames:1,shareBps:10000},{...roster[1],playedGames:1,shareBps:1}]),/100%/,'oversubscription rejected even when rounded payment is zero');
 assert.throws(()=>splitContractPrize(250,3,[{...roster[0],guestObligations:[{organizationId:'a',compensation:{kind:'percent',basisPoints:6000}},{organizationId:'b',compensation:{kind:'percent',basisPoints:5000}}]}]),/100%/);
 assert.equal(compensationAmount({kind:'percent',basisPoints:1000},12000),1200);
 console.log('PASS: private versioned proposals, role/financial permissions, stale version rejection, idempotency, revoked access, guest roster isolation, exact coin splits and combined guest obligations');
}
