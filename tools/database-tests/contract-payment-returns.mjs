import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {defaultTerms} from '../../src/modules/contracts/model.ts';

export async function verifyContractPaymentReturns(db,id){
 const owner=id(9710),player=id(9711),leader=id(9712),stranger=id(9713),team=id(9720),contract=id(9730);
 for(const user of [owner,player,leader,stranger]){await db.query('insert into auth.users(id) values($1)',[user]);await db.query('insert into profiles(id,nickname) values($1,$2)',[user,`Returns ${user.slice(-4)}`]);}
 await db.query("insert into user_roles(user_id,role) values($1,'superadmin')",[owner]);
 await db.query("insert into teams(id,name,leader_id) values($1,'Returns org',$2)",[team,owner]);
 await db.query('update teams set leader_id=$2 where id=$1',[team,leader]);
 await db.query("insert into organization_contracts(id,organization_id,player_id,kind,created_by) values($1,$2,$3,'main',$4)",[contract,team,player,owner]);
 await db.query("insert into organization_contract_versions(contract_id,revision,terms,created_by,status,offered_at) values($1,1,$2::jsonb,$3,'offered',now())",[contract,JSON.stringify(defaultTerms()),owner]);
 const wallet=async(action,input,actor=owner)=>(await db.query('select u6_coin_action($1,$2,$3,$4::jsonb) value',[actor,randomUUID(),action,JSON.stringify(input)])).rows[0].value;
 const adjust=async(kind,ownerId,amount)=>wallet('adjust',{kind,ownerId,amount,reason:'Test money'});
 const account=async(kind,target)=>(await db.query(`select balance::int,reserved::int from coin_accounts where ${kind==='player'?'user_id':'team_id'}=$1`,[target])).rows[0];
 const create=async(source,amount,reserve=true)=>(await db.query("select contract_obligation_create($1,1,'appearance',$2,$3,'2020-01-01', $4) id",[contract,source,amount,reserve])).rows[0].id;
 const pay=async(o,amount)=>db.query('select contract_debt_pay($1,$2,$3,$4)',[owner,randomUUID(),o,amount]);
 const cancel=async(o,actor=owner,key=randomUUID(),reason='Correction by owner')=>(await db.query('select contract_obligation_cancel($1,$2,$3,$4) value',[actor,key,o,reason])).rows[0].value;
 const claims=async()=>(await db.query('select amount::int,recovered::int from contract_player_claims where player_id=$1 order by created_at,id',[player])).rows;
 const query=async(actor=owner)=>(await db.query('select contract_obligation_query($1,$2) value',[actor,contract])).rows[0].value;
 await adjust('organization',team,1000);
 const original=await create('one',1000);await pay(original,1000);
 const withdrawal=await wallet('withdraw_request',{amount:200,note:'Reserved details'},player);
 await wallet('transfer',{userId:stranger,amount:650},player);
 assert.deepEqual(await account('player',player),{balance:350,reserved:200});
 assert.equal((await query(leader)).canCancel,false);assert.equal((await query(owner)).canCancel,true);
 for(const actor of [player,leader,stranger])await assert.rejects(()=>cancel(original,actor),/CONTRACT_OWNER/);
 const key=randomUUID(),result=await cancel(original,owner,key);
 assert.equal(result.returned,150);assert.equal(result.recoveryDebt,850);
 assert.deepEqual((await db.query('select contract_player_debt_summary($1) value',[player])).rows[0].value,{total:850,withdrawalBlocked:true});
 assert.deepEqual((await db.query('select contract_player_debt_summary($1) value',[stranger])).rows[0].value,{total:0,withdrawalBlocked:false});
 assert.deepEqual(await account('player',player),{balance:200,reserved:200},'reserved withdrawal cannot be seized');
 assert.deepEqual(await account('organization',team),{balance:150,reserved:0});
 assert.deepEqual(await cancel(original,owner,key),result);
 await assert.rejects(()=>cancel(original),/CONTRACT_CANCELLED/);
 await assert.rejects(()=>cancel(original,owner,key,'Other reason'),/CONTRACT_CONFLICT/);
 await assert.rejects(()=>pay(original,1),/CONTRACT_CANCELLED/);
 assert.equal((await db.query('select contract_has_debt($1) value',[team])).rows[0].value,false,'cancelled liability is no longer payable organization debt');
 await assert.rejects(()=>wallet('withdraw_request',{amount:1,note:'Blocked'},player),/CONTRACT_PLAYER_DEBT_WITHDRAWAL/);
 await assert.rejects(()=>wallet('withdraw_paid',{withdrawalId:withdrawal.operationId,reason:'Blocked by debt'}),/CONTRACT_PLAYER_DEBT_WITHDRAWAL/);
 await wallet('withdraw_cancel',{withdrawalId:withdrawal.operationId},player);
 assert.deepEqual(await account('player',player),{balance:0,reserved:0});
 assert.deepEqual(await claims(),[{amount:1000,recovered:350}]);
 // A negative cash balance must be cleared before any free money exists.
 await adjust('player',player,-50);await adjust('player',player,40);
 assert.deepEqual(await claims(),[{amount:1000,recovered:350}]);
 await adjust('player',player,210);
 assert.deepEqual(await claims(),[{amount:1000,recovered:550}]);
 await wallet('transfer',{userId:player,amount:500},stranger);
 assert.deepEqual(await claims(),[{amount:1000,recovered:1000}]);
 assert.deepEqual(await account('player',player),{balance:50,reserved:0});
 assert.deepEqual(await account('organization',team),{balance:1000,reserved:0});
 assert.equal((await db.query('select contract_player_has_debt($1) value',[player])).rows[0].value,false);
 const after=(await query(player)).obligations.find(r=>r.id===original);
 assert.equal(after.paid,1000,'original paid history stays intact');assert.equal(after.returned,1000);assert.equal(after.recoveryDebt,0);assert.equal(after.remaining,0);assert.ok(after.cancelledAt);
 await assert.rejects(()=>db.query('update contract_obligations set cancelled_at=null where id=$1',[original]),/CONTRACT_IMMUTABLE/);
 // Unpaid cancellation releases earmarked funds without charging a player.
 const unpaid=await create('unpaid',300);await cancel(unpaid);
 assert.deepEqual(await account('organization',team),{balance:1000,reserved:0});assert.equal((await claims()).length,1);
 // A partial payment is recovered only to the extent actually transferred.
 const partial=await create('partial',400);await pay(partial,100);const partialResult=await cancel(partial);
 assert.equal(partialResult.returned,100);assert.equal(partialResult.recoveryDebt,0);
 assert.deepEqual(await account('player',player),{balance:50,reserved:0});
 assert.deepEqual(await account('organization',team),{balance:1000,reserved:0});
 // Revoked ownership must be checked even on a cached request.
 await db.exec("begin;select set_config('omcite.allow_organization_owner_transfer','on',true)");
 await db.query('update teams set owner_user_id=$2 where id=$1',[team,stranger]);
 await db.exec('commit');
 await assert.rejects(()=>cancel(original,owner,key),/CONTRACT_OWNER/);
 await db.exec('set role service_role');
 try{
  await assert.rejects(()=>db.query('select contract_recover_player_claims($1)',[player]),/permission denied/);
  await assert.rejects(()=>db.exec('delete from contract_player_claims'),/permission denied/);
 }finally{await db.exec('reset role');}
 await db.exec('set role anon');
 try{await assert.rejects(()=>db.query('select contract_player_debt_summary($1)',[player]),/permission denied/);}finally{await db.exec('reset role');}
 const recoveryEntries=(await db.query("select operation_id,sum(amount)::int total from coin_entries where operation_id in(select operation_id from contract_player_recoveries) group by operation_id")).rows;
 assert.ok(recoveryEntries.length>=4);assert.ok(recoveryEntries.every(r=>r.total===0),'every recovery conserves coins');
 console.log('PASS: owner-only cancellation, immutable history, partial/unpaid liabilities, reserve-safe refunds, automatic incoming-debt recovery, negative-cash priority, withdrawal guards, ACL replay checks and coin conservation');
}
