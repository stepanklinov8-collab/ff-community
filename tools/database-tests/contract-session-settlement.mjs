import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function verifyContractSessionSettlement(db,{owner,player,team,session,contract,publish,document}) {
 const settle=async()=>(await db.query('select contract_session_settle($1,$2) value',[session,contract])).rows[0].value;
 const wallet=async(action,input,actor=owner)=>(await db.query('select u6_coin_action($1,$2,$3,$4::jsonb) value',[actor,randomUUID(),action,JSON.stringify(input)])).rows[0].value;
 const account=async(kind,target)=>(await db.query(`select balance::int,reserved::int from coin_accounts where ${kind==='player'?'user_id':'team_id'}=$1`,[target])).rows[0];
 const liabilities=async()=>(await db.query('select o.* from contract_obligations o where contract_id=$1 order by created_at,id',[contract])).rows;
 const moves=async()=>(await db.query('select count(*)::int n from coin_entries')).rows[0].n;
 const debt=async()=>(await db.query('select contract_player_debt_summary($1) value',[player])).rows[0].value.total;
 await db.query("insert into user_roles(user_id,role) values($1,'superadmin') on conflict do nothing",[owner]);
 await wallet('adjust',{kind:'organization',ownerId:team,amount:1000,reason:'Session test funding'});
 await publish(document);
 // Simulate a ledger failure after earlier lines in the same batch paid out.
 await db.exec(`create function public.test_contract_settlement_failure() returns trigger language plpgsql as $$
 begin if new.amount=50 then raise exception 'TEST_LEDGER_FAILURE';end if;return new;end $$;
 create trigger test_contract_settlement_failure before insert on coin_entries for each row execute function public.test_contract_settlement_failure();`);
 const beforeBatch=await moves();
 try {await assert.rejects(async()=>{const result=await settle();assert.fail('Unexpected settlement: '+JSON.stringify(result));},/TEST_LEDGER_FAILURE/);} finally {
  await db.exec('drop trigger test_contract_settlement_failure on coin_entries;drop function public.test_contract_settlement_failure();');
 }
 assert.equal(await moves(),beforeBatch);assert.equal((await liabilities()).length,0);
 assert.equal((await db.query('select count(*)::int n from contract_session_settlement_runs where contract_id=$1',[contract])).rows[0].n,0);
 assert.deepEqual(await account('organization',team),{balance:1000,reserved:0});
 assert.equal((await settle()).created,4);
 assert.deepEqual(await account('player',player),{balance:130,reserved:0});
 const count=await moves();assert.equal((await settle()).unchanged,true);assert.equal(await moves(),count);
 await wallet('withdraw_request',{amount:80,note:'Test protected reserve'},player);
 await wallet('transfer',{userId:owner,amount:30},player);

 // Remove all recorded participation after the player has spent some money.
 const absent=structuredClone(document);absent.rows.forEach(r=>{r.players[0].played=false;r.players[0].kills=0;r.kills=0;});
 absent.mvps=[];await publish(absent);
 assert.equal((await settle()).cancelled,4);
 assert.deepEqual(await account('player',player),{balance:80,reserved:80});
 assert.equal(await debt(),110);
 assert.equal((await liabilities()).every(o=>o.cancelled_at!==null&&o.cancelled_by===null),true,'automated corrections do not impersonate the owner');
 const afterReturn=await moves();await settle();assert.equal(await moves(),afterReturn);

 // Restoring participation creates a new audited generation. Incoming payouts
 // first repay old corrections; historical paid amounts are never overwritten.
 await publish(document);assert.equal((await settle()).created,4);
 assert.equal(await debt(),0);assert.deepEqual(await account('player',player),{balance:100,reserved:80});
 assert.equal((await liabilities()).filter(o=>o.cancelled_at===null).length,4);
 const sessionFee=(await liabilities()).find(o=>o.cancelled_at===null&&o.source_key.includes(':session:revision:'));
 await db.query('select contract_obligation_cancel($1,$2,$3,$4)',[owner,randomUUID(),sessionFee.id,'Owner waives session payment']);
 assert.equal(await debt(),30);
 const changed=structuredClone(document);changed.rows[0].kills=3;changed.rows[0].players[0].kills=3;
 await publish(changed);const changedResult=await settle();
 assert.equal(changedResult.created,1,'only changed kill payment is reissued; owner cancellation is not revived');
 assert.equal((await liabilities()).filter(o=>o.cancelled_at===null&&o.source_key.includes(':session:revision:')).length,0);
 assert.equal(await debt(),25);

 const org=await account('organization',team);
 await wallet('adjust',{kind:'organization',ownerId:team,amount:-org.balance,reason:'Empty test organization wallet'});
 changed.rows[1].players[0].played=true;changed.rows[1].players[0].kills=3;changed.rows[1].kills=3;
 await publish(changed);const unfunded=await settle();assert.equal(unfunded.created,2);assert.equal(unfunded.paid,0);
 const openDebt=()=>db.query('select sum(amount-paid)::int amount from contract_obligations where contract_id=$1 and cancelled_at is null',[contract]);
 assert.equal((await openDebt()).rows[0].amount,35);
 await wallet('adjust',{kind:'organization',ownerId:team,amount:100,reason:'Later top-up for manual payment'});
 await settle();assert.equal((await openDebt()).rows[0].amount,35,'retry cannot automatically pay old unfunded debt');
 await publish(changed);await settle();assert.equal((await openDebt()).rows[0].amount,35,'new publication revision alone cannot pay old debt');

 const incomplete=structuredClone(changed);incomplete.rows[0].detail='team';await publish(incomplete);
 const beforeIncomplete=await moves();assert.equal((await settle()).applied,false);assert.equal(await moves(),beforeIncomplete);
 assert.equal((await openDebt()).rows[0].amount,35,'incomplete corrected statistics cannot reverse the last confirmed settlement');
 await publish(changed);
 await assert.rejects(()=>db.query("update contract_session_settlement_runs set plan='{}' where contract_id=$1",[contract]),/CONTRACT_IMMUTABLE/);
 await db.exec('set role service_role');
 try {
  await assert.rejects(()=>settle(),/permission denied/);
  await assert.rejects(()=>db.query('select contract_obligation_cancel_internal(null,$1,$2,$3)',[randomUUID(),sessionFee.id,'Forbidden correction']),/permission denied/);
  await assert.rejects(()=>db.query('select contract_obligation_cancel(null,$1,$2,$3)',[randomUUID(),sessionFee.id,'Forged automatic cancellation']),/CONTRACT_AUTH/);
  await assert.rejects(()=>db.query('select * from contract_session_charges'),/permission denied/);
 }finally{await db.exec('reset role');}
 // Malformed confirmed facts also leave the last good settlement intact.
 const huge=structuredClone(changed);huge.rows[1].players[0].kills=1000001;await publish(huge);
 const beforeFailure=await moves();await assert.rejects(()=>settle(),/CONTRACT_INPUT/);assert.equal(await moves(),beforeFailure);
 await publish(changed);
 console.log('PASS: session payment generations, reserve-safe result corrections, retained owner cancellation, exact replay, incomplete-results hold, unfunded manual debt and private system settlement');
}
