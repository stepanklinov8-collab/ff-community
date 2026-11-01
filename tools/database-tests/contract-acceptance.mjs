import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { defaultTerms } from '../../src/modules/contracts/model.ts';

export async function verifyContractAcceptance(db,id) {
 const owner=id(9800),leader=id(9801),player=id(9802),other=id(9803),team=id(9810),staleTeam=id(9811),contract=id(9820),short=id(9821),second=id(9822);
 for(const [user,name] of [[owner,'Signing owner'],[leader,'Signing leader'],[player,'Signing player'],[other,'Signing other']]) {
  await db.query('insert into auth.users(id) values($1)',[user]);
  await db.query('insert into profiles(id,nickname) values($1,$2)',[user,name]);
 }
 await db.query("insert into user_roles(user_id,role) values($1,'superadmin')",[owner]);
 await db.query('insert into teams(id,name,type,leader_id) values($1,$2,$3,$4)',[team,'Signing team','team',owner]);
 await db.query('insert into teams(id,name,type,leader_id) values($1,$2,$3,$4)',[staleTeam,'Stale signature team','team',owner]);
 await db.query("insert into team_members(team_id,user_id,role_in_team) values($1,$2,'leader'),($1,$3,'main')",[team,leader,player]);
 await db.query("insert into team_members(team_id,user_id,role_in_team) values($1,$2,'leader'),($1,$3,'main')",[staleTeam,owner,player]);
 await db.query('update teams set leader_id=$2 where id=$1',[team,leader]);
 const terms=defaultTerms(new Date(Date.now()+86400000));terms.endsAt=new Date(Date.now()+15*86400000).toISOString();
 terms.financial.signingAmount=125;terms.financial.salary={amount:200,periodDays:9};
 terms.transfer={kind:'combined',amount:40,basisPoints:2000,selection:'maximum'};
 terms.playerExit={kind:'combined',amount:100,basisPoints:2000,selection:'minimum'};
 terms.organizationTermination={kind:'combined',amount:200,basisPoints:2000,selection:'maximum'};
 const mutate=async(actor,input)=>{
  try{return (await db.query('select contract_mutate($1,$2::jsonb) value',[actor,JSON.stringify(input)])).rows[0].value;}
  catch(error){error.message=`${input.action} contract ${input.contractId} revision ${input.revision??input.expectedRevision}: ${error.message}`;throw error;}
 };
 const query=async(actor,input={})=>(await db.query('select contract_query($1,$2::jsonb) value',[actor,JSON.stringify(input)])).rows[0].value;
 const wallet=(actor,action,input,key=randomUUID())=>db.query('select u6_coin_action($1,$2,$3,$4::jsonb)',[actor,key,action,JSON.stringify(input)]);
 const fund=async(amount)=>wallet(owner,'adjust',{kind:'organization',ownerId:team,amount,reason:'Bilateral acceptance test'});
 let n=9830;const request=()=>id(n++);
 await mutate(delegateOrLeader(),{action:'save',requestId:request(),contractId:contract,expectedRevision:0,organizationId:team,playerId:player,kind:'main',eventId:null,sessionId:null,terms});
 await mutate(owner,{action:'offer',requestId:request(),contractId:contract,revision:1});
 assert.equal((await query(player,{contractId:contract})).contracts[0].status,'offered');
 assert.equal((await query(player,{contractId:contract})).contracts[0].hasSignedHistory,false);
 await assert.rejects(()=>mutate(other,{action:'accept',requestId:request(),contractId:contract,revision:1}),/CONTRACT_FORBIDDEN/);
 await assert.rejects(()=>mutate(player,{action:'accept',requestId:request(),contractId:contract,revision:1}),/CONTRACT_FUNDS/);
 assert.equal((await db.query('select count(*)::int n from contract_signatures where contract_id=$1 and party=\'player\'',[contract])).rows[0].n,0,'failed reserve rolls back player signature');
 assert.equal((await db.query('select count(*)::int n from contract_agreements where contract_id=$1',[contract])).rows[0].n,0,'failed reserve creates no signed agreement');
 await fund(325);
 const accepted={action:'accept',requestId:request(),contractId:contract,revision:1};
 const result=await mutate(player,accepted);
 assert.equal(result.status,'signed');assert.equal(result.revision,1);
 assert.deepEqual((await query(player,{contractId:contract})).contracts[0].terms,terms,'mixed clauses survive actual bilateral signing unchanged');
 assert.deepEqual(await mutate(player,accepted),result,'retry returns original acceptance response');
 assert.equal((await query(player,{contractId:contract})).contracts[0].status,'signed');
 assert.equal((await query(player,{contractId:contract})).contracts[0].hasSignedHistory,true);
 assert.equal((await query(owner,{contractId:contract,history:'true'})).versions[0].status,'signed');
 const sigs=(await db.query('select party,signed_by,ownership_revision from contract_signatures where contract_id=$1 order by party',[contract])).rows;
 assert.deepEqual(sigs.map(x=>x.party),['organization','player']);
 assert.equal(sigs[0].signed_by,owner);assert.equal(sigs[1].signed_by,player);assert.equal(sigs[0].ownership_revision,sigs[1].ownership_revision);
 assert.equal((await db.query('select count(*)::int n from contract_financial_starts where contract_id=$1',[contract])).rows[0].n,1);
 assert.equal((await db.query('select balance::int from coin_accounts where user_id=$1',[player])).rows[0].balance,125,'initial payment transfers once');
 assert.deepEqual((await db.query('select balance::int,reserved::int from coin_accounts where team_id=$1',[team])).rows[0],{balance:200,reserved:200});
 await assert.rejects(()=>mutate(player,{action:'reject',requestId:request(),contractId:contract,revision:1}),/CONTRACT_STATE/);
 await assert.rejects(()=>mutate(owner,{action:'cancel',requestId:request(),contractId:contract,revision:1}),/CONTRACT_STATE/);

 // Expired signatures do not prevent a new ordinary contract. A new active
 // agreement with the same organization and player does prevent overlap.
 const renewal=structuredClone(terms);renewal.startsAt=new Date(Date.now()+16*86400000).toISOString();renewal.endsAt=null;
 await mutate(owner,{action:'save',requestId:request(),contractId:contract,expectedRevision:1,organizationId:team,playerId:player,kind:'main',eventId:null,sessionId:null,terms:renewal});
 await mutate(owner,{action:'offer',requestId:request(),contractId:contract,revision:2});
 await fund(300);
 const renewed=await mutate(player,{action:'accept',requestId:request(),contractId:contract,revision:2});
 assert.equal(renewed.status,'signed');
 assert.equal((await db.query("select count(*)::int n from contract_obligations where contract_id=$1 and kind='signing'",[contract])).rows[0].n,1,'renewal does not create a second signing bonus');
 assert.equal((await db.query('select balance::int from coin_accounts where user_id=$1',[player])).rows[0].balance,125,'renewal does not pay the welcome bonus again');
 assert.equal((await db.query('select count(*)::int n from contract_agreements where contract_id=$1',[contract])).rows[0].n,2);

 // Signing is tied to the organization revision that was actually offered.
 const shortTerms=structuredClone(terms);shortTerms.financial.signingAmount=0;shortTerms.financial.salary=null;
 await mutate(owner,{action:'save',requestId:request(),contractId:short,expectedRevision:0,organizationId:staleTeam,playerId:player,kind:'main',eventId:null,sessionId:null,terms:shortTerms});
 await mutate(owner,{action:'offer',requestId:request(),contractId:short,revision:1});
 await db.query("select set_config('omcite.allow_organization_owner_transfer','on',false)");
 await db.query('update teams set owner_user_id=$2 where id=$1',[staleTeam,other]);
 await db.query("select set_config('omcite.allow_organization_owner_transfer','off',false)");
 await assert.rejects(()=>mutate(player,{action:'accept',requestId:request(),contractId:short,revision:1}),/CONTRACT_SIGNATURE_STALE/);

 // A separate same-party active agreement cannot overlap the signed one.
 const overlapTerms=structuredClone(shortTerms);overlapTerms.startsAt=new Date(Date.now()+20*86400000).toISOString();overlapTerms.endsAt=new Date(Date.now()+30*86400000).toISOString();
 await mutate(owner,{action:'save',requestId:request(),contractId:second,expectedRevision:0,organizationId:team,playerId:player,kind:'main',eventId:null,sessionId:null,terms:overlapTerms});
 await mutate(owner,{action:'offer',requestId:request(),contractId:second,revision:1});
 await assert.rejects(()=>mutate(player,{action:'accept',requestId:request(),contractId:second,revision:1}),/CONTRACT_ALREADY_ACTIVE/);

 await db.exec('set role authenticated');
 try { await assert.rejects(()=>db.query('select * from public.contract_signatures'),/permission denied/); }
 finally { await db.exec('reset role'); }
 console.log('PASS: bilateral signature, acceptance authorization, atomic reserve rollback, immutable signed status, renewal bonus protection, stale owner signature and overlapping agreement rejection');
}

function delegateOrLeader() { return '00000000-0000-4000-8000-000000009801'; }
