import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {defaultTerms} from '../../src/modules/contracts/model.ts';

export async function verifyContractFinancialStart(db,id){
 const owner=id(9510),player=id(9511),team=id(9520),contract=id(9530),zeroContract=id(9531);
 for(const user of [owner,player]){
  await db.query('insert into auth.users(id) values($1)',[user]);
  await db.query('insert into profiles(id,nickname) values($1,$2)',[user,`Financial signing ${user.slice(-4)}`]);
 }
 await db.query("insert into user_roles(user_id,role) values($1,'superadmin')",[owner]);
 await db.query("insert into teams(id,name,type,leader_id) values($1,'Financial signing organization','team',$2)",[team,owner]);
 for(const c of [contract,zeroContract])await db.query("insert into organization_contracts(id,organization_id,player_id,kind,created_by) values($1,$2,$3,'main',$4)",[c,team,player,owner]);
 const day=86400000,start=Date.now()+day;
 const version=async(c,revision,effective,signingAmount,salary)=>{
  const terms=defaultTerms(new Date(effective));terms.financial.signingAmount=signingAmount;terms.financial.salary=salary;
  await db.query('insert into organization_contract_versions(contract_id,revision,terms,created_by) values($1,$2,$3::jsonb,$4)',[c,revision,JSON.stringify(terms),owner]);
 };
 const activate=async(c,revision,effective)=>(await db.query('select contract_financial_start($1,$2,$3) id',[c,revision,new Date(effective).toISOString()])).rows[0].id;
 const credit=async amount=>db.query('select u6_coin_action($1,$2,$3,$4::jsonb)',[owner,randomUUID(),'adjust',JSON.stringify({kind:'organization',ownerId:team,amount,reason:'Signing test funding'})]);
 const account=async()=>(await db.query('select balance::int,reserved::int from coin_accounts where team_id=$1',[team])).rows[0];
 const salary=amount=>({amount,periodDays:10});
 await version(contract,1,start,100,salary(500));await credit(500);
 await assert.rejects(()=>activate(contract,1,start),/CONTRACT_FUNDS/);
 assert.deepEqual(await account(),{balance:500,reserved:0});
 for(const table of ['contract_financial_starts','contract_obligations','contract_salary_schedules'])
  assert.equal((await db.query(`select count(*)::int n from ${table} where contract_id=$1`,[contract])).rows[0].n,0,'insufficient combined funding rolls back every part');
 await credit(100);
 const original=await activate(contract,1,start);
 assert.deepEqual(await account(),{balance:500,reserved:500});
 assert.equal((await db.query('select balance::int from coin_accounts where user_id=$1',[player])).rows[0].balance,100);
 assert.equal(await activate(contract,1,start),original);assert.deepEqual(await account(),{balance:500,reserved:500});
 await assert.rejects(()=>activate(contract,1,start+1),/CONTRACT_CONFLICT/);

 await version(contract,2,start+5*day,10000,salary(500));
 assert.equal(await activate(contract,2,start+5*day),original);
 assert.deepEqual(await account(),{balance:500,reserved:500},'released portion of old period funds the unchanged renewal remainder');
 const snapshot=async()=>(await db.query('select revision,ends_at,anchor_at,next_index from contract_salary_schedules where contract_id=$1 order by revision',[contract])).rows;
 const previous=await snapshot();
 await version(contract,3,start+6*day,999999,salary(1000));
 await assert.rejects(()=>activate(contract,3,start+6*day),/CONTRACT_FUNDS/);
 assert.deepEqual(await snapshot(),previous,'failed renewal restores previous salary dates');
 assert.deepEqual(await account(),{balance:500,reserved:500},'failed renewal restores earmarked reserves');
 assert.equal((await db.query('select count(*)::int n from contract_financial_starts where contract_id=$1',[contract])).rows[0].n,2);
 await credit(200);assert.equal(await activate(contract,3,start+6*day),original);
 assert.deepEqual(await account(),{balance:700,reserved:700});
 assert.equal((await db.query('select balance::int from coin_accounts where user_id=$1',[player])).rows[0].balance,100,'renewal cannot repeat or increase original signing payment');
 assert.equal((await db.query("select count(*)::int n from contract_obligations where contract_id=$1 and kind='signing'",[contract])).rows[0].n,1);
 const rows=(await db.query('select revision,amount::int,held::int,due_at from contract_salary_periods where contract_id=$1 order by revision',[contract])).rows;
 assert.deepEqual(rows.map(r=>r.amount),[250,50,400]);assert.equal(new Date(rows[2].due_at).getTime(),start+10*day);
 // Even an initially absent welcome payment is permanently recorded as zero.
 await version(zeroContract,1,start,0,null);const zero=await activate(zeroContract,1,start);
 await version(zeroContract,2,start+day,500,null);assert.equal(await activate(zeroContract,2,start+day),zero);
 assert.equal((await db.query('select amount::int from contract_obligations where id=$1',[zero])).rows[0].amount,0);
 await db.exec('set role service_role');
 try{
  await assert.rejects(()=>activate(contract,3,start+6*day),/permission denied/);
  await assert.rejects(()=>db.exec('delete from contract_financial_starts'),/permission denied/);
 }finally{await db.exec('reset role');}
 console.log('PASS: atomic original bonus + salary funding, renewal reserve reuse, full rollback on shortage, stable payroll cadence, zero/nonzero welcome bonus never reissued, internal-only activation');
}
