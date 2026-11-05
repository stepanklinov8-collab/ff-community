import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {defaultTerms} from '../../src/modules/contracts/model.ts';

export async function verifyContractSalary(db,id){
 const owner=id(9410),player=id(9411),team=id(9420);
 for(const user of [owner,player]){await db.query('insert into auth.users(id) values($1)',[user]);await db.query('insert into profiles(id,nickname) values($1,$2)',[user,`Payroll ${user.slice(-4)}`]);}
 await db.query("insert into user_roles(user_id,role) values($1,'superadmin')",[owner]);
 await db.query("insert into teams(id,name,type,leader_id) values($1,'Payroll organization','team',$2)",[team,owner]);
 await db.query("insert into team_members(team_id,user_id,role_in_team) values($1,$2,'leader'),($1,$3,'main')",[team,owner,player]);
 const now=(await db.query("select date_trunc('second',clock_timestamp()) value")).rows[0].value;
 const stamp=new Date(now).getTime(),day=86400000;
 let fixture=9430;
 const createContract=async(start,end,amount=1000,periodDays=10)=>{
   const contract=id(fixture++),terms=defaultTerms(new Date(start));
   terms.endsAt=end===null?null:new Date(end).toISOString();terms.financial.salary={amount,periodDays};
   await db.query("insert into organization_contracts(id,organization_id,player_id,kind,created_by) values($1,$2,$3,'main',$4)",[contract,team,player,owner]);
   await db.query('insert into organization_contract_versions(contract_id,revision,terms,created_by) values($1,1,$2::jsonb,$3)',[contract,JSON.stringify(terms),owner]);
   return {contract,terms};
 };
 const initialize=async(contract,effective)=>(await db.query('select contract_salary_schedule_create($1,1,$2)',[contract,new Date(effective).toISOString()]));
 const process=async(contract)=>(await db.query('select contract_salary_process($1) value',[contract])).rows[0].value;
 const account=async()=>(await db.query('select balance::int,reserved::int from coin_accounts where team_id=$1',[team])).rows[0];
 const credit=async(amount)=>db.query('select u6_coin_action($1,$2,$3,$4::jsonb)',[owner,randomUUID(),'adjust',JSON.stringify({kind:'organization',ownerId:team,amount,reason:'Payroll test funding'})]);
 const obligations=async(contract)=>(await db.query('select id,amount::int,paid::int,held::int,due_at from contract_obligations where contract_id=$1 order by due_at',[contract])).rows;
 await credit(2500);
 const {contract}=await createContract(stamp-25*day,stamp);
 await initialize(contract,stamp-25*day);
 assert.deepEqual(await account(),{balance:2500,reserved:1000});
 assert.equal((await db.query('select contract_has_debt($1) value',[team])).rows[0].value,true,'late payroll processing must not permit withdrawal after payday');
 await assert.rejects(()=>db.query('select u6_coin_action($1,$2,$3,$4::jsonb)',[owner,randomUUID(),'withdraw_request',JSON.stringify({fullNameLatin:'Test Player',transferCountry:'Россия',teamId:team,amount:100,note:'Test payment details'})]),/CONTRACT_DEBT_WITHDRAWAL/);
 await initialize(contract,stamp-25*day);
 assert.deepEqual(await account(),{balance:2500,reserved:1000},'schedule retry must not reserve twice');
 assert.equal((await process(contract)).processed,3);
 const due=await obligations(contract);
 assert.deepEqual(due.map(row=>row.amount),[1000,1000,500]);
 assert.deepEqual(due.map(row=>row.paid),[1000,0,0],'only period funded in advance is automatic; late discovered debts remain manual');
 assert.deepEqual(due.map(row=>new Date(row.due_at).getTime()),[stamp-15*day,stamp-5*day,stamp]);
 assert.deepEqual(await account(),{balance:1500,reserved:0});
 await process(contract);assert.equal((await obligations(contract)).length,3);
 await credit(1);await process(contract);assert.deepEqual((await obligations(contract)).map(row=>row.paid),[1000,0,0],'top-up does not trigger automatic payment of old debt');
 for(const row of due.slice(1).reverse()) await db.query('select contract_debt_pay($1,$2,$3,$4)',[owner,randomUUID(),row.id,row.amount]);
 assert.deepEqual(await account(),{balance:1,reserved:0});

 const short=await createContract(stamp-3.5*day,stamp,1000,10);
 await assert.rejects(()=>initialize(short.contract,stamp-3.5*day),/CONTRACT_FUNDS/);
 assert.equal((await db.query('select count(*)::int n from contract_salary_schedules where contract_id=$1',[short.contract])).rows[0].n,0,'failed initialization rolls back schedule');
 await credit(349);await initialize(short.contract,stamp-3.5*day);
 assert.deepEqual(await account(),{balance:350,reserved:350});
 await process(short.contract);assert.equal((await obligations(short.contract))[0].paid,350);

 await credit(1000);
 const invalidated=await createContract(stamp-10*day,stamp);
 await initialize(invalidated.contract,stamp-10*day);await credit(-900);
 await process(invalidated.contract);
 assert.equal((await obligations(invalidated.contract))[0].paid,0,'administrative debit cannot force spending another reserve');
 assert.equal((await obligations(invalidated.contract))[0].held,1000,'funding shortfall preserves designated reserve');
 await credit(900);await process(invalidated.contract);
 assert.equal((await obligations(invalidated.contract))[0].paid,0,'failed automatic due payment is not retried on top-up');
 const invalidDebt=(await obligations(invalidated.contract))[0];
 await db.query('select contract_debt_pay($1,$2,$3,$4)',[owner,randomUUID(),invalidDebt.id,1000]);

 await credit(100);
 const future=await createContract(stamp+day,null,100,9);
 await initialize(future.contract,stamp+day);
 assert.equal((await process(future.contract)).processed,0);
 assert.equal((await obligations(future.contract)).length,0,'future reserve is not earned salary');
 assert.equal((await db.query('select contract_has_debt($1) value',[team])).rows[0].value,false);
 // Bounded catch-up with a cursor: second call advances, never repeats page 1.
 await credit(1);
 const long=await createContract(stamp-205*day,stamp,1,1);
 await initialize(long.contract,stamp-205*day);
 assert.deepEqual(await process(long.contract),{processed:100,hasMore:true});
 assert.deepEqual(await process(long.contract),{processed:100,hasMore:true});
 assert.deepEqual(await process(long.contract),{processed:5,hasMore:false});
 assert.equal((await obligations(long.contract)).length,205);
 assert.equal((await process(long.contract)).processed,0);
 // Revisions split only unposted accrual and retain the original N-day clock.
 const revision=async(f,number,start,amount=1000,days=10)=>{
  const terms=structuredClone(f.terms);terms.startsAt=new Date(start).toISOString();terms.endsAt=null;terms.financial.salary={amount,periodDays:days};
  await db.query('insert into organization_contract_versions(contract_id,revision,terms,created_by) values($1,$2,$3::jsonb,$4)',[f.contract,number,JSON.stringify(terms),owner]);
 };
 const close=async(c,rev,end)=>db.query('select contract_salary_schedule_close($1,$2,$3,$4)',[c,rev,new Date(end).toISOString(),'amended']);
 const periods=async(c)=>(await db.query('select revision,period_index,starts_at,due_at,amount::int,held::int,cancelled_at from contract_salary_periods where contract_id=$1 order by revision,period_index',[c])).rows;
 await credit(1000);
 const renewed=await createContract(stamp-5*day,null);
 await initialize(renewed.contract,stamp-5*day);
 await revision(renewed,2,stamp);
 await assert.rejects(()=>db.query('select contract_salary_schedule_create($1,2,$2)',[renewed.contract,new Date(stamp).toISOString()]),/CONTRACT_PAYROLL_OVERLAP/);
 await close(renewed.contract,1,stamp);
 let split=await periods(renewed.contract);
 assert.equal(split[0].amount,500);assert.equal(split[0].held,500);
 const afterClose=await account();await close(renewed.contract,1,stamp);assert.deepEqual(await account(),afterClose,'repeated shortening cannot release twice');
 await db.query('select contract_salary_schedule_create($1,2,$2)',[renewed.contract,new Date(stamp).toISOString()]);
 split=await periods(renewed.contract);
 assert.deepEqual(split.map(p=>p.amount),[500,500]);
 assert.equal(new Date(split[1].due_at).getTime(),stamp+5*day,'renewal preserves next pay date instead of starting a new full period');
 await process(renewed.contract);
 assert.equal((await obligations(renewed.contract))[0].paid,500);
 await assert.rejects(()=>close(renewed.contract,1,stamp-day),/CONTRACT_PAYROLL_ALREADY_POSTED/);
 const heldBeforeCancel=(await account()).reserved;
 await close(renewed.contract,2,stamp);
 assert.equal((await account()).reserved,heldBeforeCancel-500);
 assert.ok((await periods(renewed.contract))[1].cancelled_at);
 await process(renewed.contract);assert.equal((await obligations(renewed.contract)).length,1,'cancelled future salary does not become a debt');

 // Exact seconds through a DST boundary; sub-coin final accrual floors once.
 await db.exec("set timezone='America/New_York'");
 const dstStart=Date.parse('2027-03-13T12:00:00Z');
 const dst=await createContract(dstStart,dstStart+1.25*day,101,2);
 await credit(63);await initialize(dst.contract,dstStart);
 const dstPeriod=(await periods(dst.contract))[0];
 assert.equal(dstPeriod.amount,63);assert.equal(new Date(dstPeriod.due_at).getTime(),dstStart+1.25*day);
 await close(dst.contract,1,dstStart-day);await process(dst.contract);
 assert.equal((await obligations(dst.contract)).length,0);
 await db.exec("set timezone='Europe/Moscow'");
 // A missed reserve may still be funded BEFORE its due date, without paying
 // any existing overdue debt or changing the original period calendar.
 const needsFunding=await createContract(stamp+day,null,1000,10);
 await db.query('insert into contract_salary_schedules(contract_id,revision,starts_at,anchor_at,amount,period_days) values($1,1,$2,$2,1000,10)',[needsFunding.contract,new Date(stamp+day).toISOString()]);
 await db.query('select contract_salary_prepare($1,1,0,false)',[needsFunding.contract]);
 assert.equal((await periods(needsFunding.contract))[0].held,0);
 const outstandingBefore=(await obligations(long.contract)).map(row=>row.paid);
 await credit(1000);await process(needsFunding.contract);
 assert.equal((await periods(needsFunding.contract))[0].held,1000);
 assert.deepEqual((await obligations(long.contract)).map(row=>row.paid),outstandingBefore);
 const fundingBalance=await account();await process(needsFunding.contract);assert.deepEqual(await account(),fundingBalance);
 await db.exec('set role service_role');
 try{
  await assert.rejects(()=>db.query('select contract_salary_schedule_create($1,1,now())',[future.contract]),/permission denied/);
  await assert.rejects(()=>db.query('select contract_salary_process($1)',[future.contract]),/permission denied/);
  await assert.rejects(()=>db.query('update contract_salary_schedules set next_index=0'),/permission denied/);
  await assert.rejects(()=>close(future.contract,1,stamp),/permission denied/);
 }finally{await db.exec('reset role');}
 console.log('PASS: payroll period reserves, exact N-day cadence, proportional last period, preserved due dates, bounded catch-up, no top-up auto-debt payment and isolated internal scheduling');
}
