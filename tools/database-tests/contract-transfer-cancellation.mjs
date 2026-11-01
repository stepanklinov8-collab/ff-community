import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {defaultTerms,contractTermsSchema} from '../../src/modules/contracts/model.ts';
import {emptyTransferCancellation,cancellationPaymentKinds,cancellationReasons,previewTransferCancellation} from '../../src/modules/contracts/transfer-cancellation.ts';
export async function verifyContractTransferCancellation(db,id){
 const policy=emptyTransferCancellation(),paid=Object.fromEntries(cancellationPaymentKinds.map(kind=>[kind,101]));
 policy.player_fault.signing={kind:'fixed',amount:500};policy.player_fault.salary={kind:'percent',basisPoints:5000};
 policy.player_fault.prize={kind:'combined',amount:40,basisPoints:5000,selection:'minimum'};
 policy.player_fault.personalAward={kind:'combined',amount:40,basisPoints:5000,selection:'maximum'};
 policy.hiring_organization_fault.mvp={kind:'percent',basisPoints:2500};
 const terms=defaultTerms();terms.financial.transferCancellation=policy;
 await db.query('select contract_validate_terms($1::jsonb)',[JSON.stringify(terms)]);
 for(const reason of cancellationReasons){
   const result=(await db.query('select contract_transfer_cancellation_quote($1::jsonb,$2,$3::jsonb) value',[JSON.stringify(policy),reason,JSON.stringify(paid)])).rows[0].value;
   assert.deepEqual(result,previewTransferCancellation(policy,reason,paid),'SQL and browser preview must agree for '+reason);
 }
 const malformed=[];const noCause=structuredClone(policy);delete noCause.no_fault;malformed.push(noCause,null,{...policy,extra:policy.mutual});
 for(const rule of [{kind:'fixed',amount:1,recipient:id(92001)},{kind:'percent',basisPoints:10001},{kind:'combined',amount:1,basisPoints:5000,selection:'sum'}])malformed.push({...policy,mutual:{...policy.mutual,salary:rule}});
 for(const invalid of malformed){
   const bad=structuredClone(terms);bad.financial.transferCancellation=invalid;
   assert.equal(contractTermsSchema.safeParse(bad).success,false);
   await assert.rejects(()=>db.query('select contract_validate_terms($1::jsonb)',[JSON.stringify(bad)]),/CONTRACT_INPUT/);
 }
 await assert.rejects(()=>db.query('select contract_transfer_cancellation_quote($1::jsonb,$2,$3::jsonb)',[JSON.stringify(policy),'player',JSON.stringify(paid)]),/CONTRACT_INPUT/);
 await assert.rejects(()=>db.query('select contract_transfer_cancellation_quote($1::jsonb,$2,$3::jsonb)',[JSON.stringify(policy),'mutual',JSON.stringify({...paid,otherContract:1})]),/CONTRACT_INPUT/);
 const big=emptyTransferCancellation();big.no_fault.salary={kind:'percent',basisPoints:10000};big.no_fault.prize={kind:'percent',basisPoints:10000};
 await assert.rejects(()=>db.query('select contract_transfer_cancellation_quote($1::jsonb,$2,$3::jsonb)',[JSON.stringify(big),'no_fault',JSON.stringify({...paid,salary:Number.MAX_SAFE_INTEGER,prize:1})]),/CONTRACT_COIN_RANGE/);

 const owner=id(92000),player=id(92001),org=id(92010),contract=id(92020);
 for(const user of [owner,player]){await db.query('insert into auth.users(id) values($1)',[user]);await db.query('insert into profiles(id,nickname) values($1,$2)',[user,'Cancellation '+user.slice(-4)]);}
 await db.query("insert into teams(id,name,type,leader_id,verified) values($1,'Cancellation clauses','team',$2,true)",[org,owner]);
 await db.query("insert into team_members(team_id,user_id,role_in_team) values($1,$2,'main')",[org,player]);
 const mutate=(actor,input)=>db.query('select contract_mutate($1,$2::jsonb)',[actor,JSON.stringify({...input,requestId:randomUUID()})]);
 await mutate(owner,{action:'save',contractId:contract,expectedRevision:0,organizationId:org,playerId:player,kind:'main',eventId:null,sessionId:null,terms});
 await mutate(owner,{action:'offer',contractId:contract,revision:1});await mutate(player,{action:'accept',contractId:contract,revision:1});
 assert.equal((await db.query('select count(*)::int n from contract_agreements where contract_id=$1',[contract])).rows[0].n,1);
 await assert.rejects(()=>db.query("update organization_contract_versions set terms=jsonb_set(terms,'{financial,transferCancellation,player_fault,salary,basisPoints}','10000') where contract_id=$1 and revision=1",[contract]),/CONTRACT_IMMUTABLE/);
 const later=structuredClone(terms);later.financial.transferCancellation.player_fault.salary={kind:'none'};
 await mutate(owner,{action:'save',contractId:contract,expectedRevision:1,organizationId:org,playerId:player,kind:'main',eventId:null,sessionId:null,terms:later});
 const history=(await db.query('select contract_history($1,$2,0) value',[player,contract])).rows[0].value;
 const rows=history.versions;assert.deepEqual(rows.find(row=>row.revision===1).terms.financial.transferCancellation,policy);
 assert.equal(rows.some(row=>row.revision===2),false,'the player cannot see an unsent replacement draft');
 const managerHistory=(await db.query('select contract_history($1,$2,0) value',[owner,contract])).rows[0].value;
 assert.deepEqual(managerHistory.versions.find(row=>row.revision===2).terms.financial.transferCancellation,later.financial.transferCancellation);
 const legacy=defaultTerms();await db.query('select contract_validate_terms($1::jsonb)',[JSON.stringify(legacy)]);
 assert.equal((await db.query("select terms->'financial'?'transferCancellation' present from organization_contract_versions where contract_id=$1 and revision=1",[contract])).rows[0].present,true);
 for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query("select has_function_privilege($1,'public.contract_transfer_cancellation_quote(jsonb,text,jsonb)','execute') allowed",[role])).rows[0].allowed,false);
 console.log('PASS: per-cause/all-payment return clauses, exact SQL/TS quotes, actual-receipt cap, independent min/max, strict validation, real bilateral signed immutable history and private preview without money movement');
}
