import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
export async function verifyMainCoins(db,id,base){
 const owner=id(996001),alice=id(996002),bob=id(996003),admin=id(996004);
 for(const [i,user] of [owner,alice,bob,admin].entries()){
  await db.query('insert into auth.users(id) values($1)',[user]);
  await db.query('insert into profiles(id,nickname) values($1,$2)',[user,`Wallet ${i}`]);
 }
 await db.query("insert into user_roles(user_id,role) values($1,'superadmin'),($2,'admin')",[owner,admin]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
 await db.query('insert into site_wallets(user_id,balance) values($1,123456)',[alice]);
 const action=async(actor,kind,input,key=randomUUID())=>(await db.query('select u6_coin_action($1,$2,$3,$4::jsonb) value',[actor,key,kind,JSON.stringify(input)])).rows[0].value;
 const account=async(user,team=false)=>(await db.query(`select balance::int,reserved::int,id from coin_accounts where ${team?'team_id':'user_id'}=$1`,[user])).rows[0];
 const credit=async(user,amount)=>action(owner,'adjust',{kind:'player',ownerId:user,amount,reason:'Test award'});
 await assert.rejects(()=>action(alice,'transfer',{userId:bob,amount:1}),/Недостаточно/);
 assert.equal((await db.query('select balance::int from site_wallets where user_id=$1',[alice])).rows[0].balance,123456,'Demo money is not spendable');
 await assert.rejects(()=>action(admin,'adjust',{kind:'player',ownerId:alice,amount:100,reason:'Test'}),/Нет прав/);
 await action(owner,'permission',{userId:admin,enabled:true});
 await action(admin,'adjust',{kind:'player',ownerId:alice,amount:500,reason:'Test'});
 await action(owner,'permission',{userId:admin,enabled:false});
 await assert.rejects(()=>action(admin,'adjust',{kind:'player',ownerId:alice,amount:1,reason:'Test'}),/Нет прав/);
 const transferKey=randomUUID(),transfer={userId:bob,amount:200};
 await action(alice,'transfer',transfer,transferKey);await action(alice,'transfer',transfer,transferKey);
 assert.equal((await account(alice)).balance,300);assert.equal((await account(bob)).balance,200);
 await assert.rejects(()=>action(alice,'transfer',{...transfer,amount:201},transferKey),/Конфликт/);
 const withdrawal=await action(alice,'withdraw_request',{fullNameLatin:'Test Player',transferCountry:'Россия',amount:250,note:'Тестовые реквизиты'});
 assert.equal((await account(alice)).reserved,250);
 await assert.rejects(()=>action(alice,'transfer',{userId:bob,amount:51}),/Недостаточно/);
 await assert.rejects(()=>action(bob,'withdraw_cancel',{withdrawalId:withdrawal.operationId}),/Нет прав/);
 await action(owner,'withdraw_reject',{withdrawalId:withdrawal.operationId,reason:'Requisites correction'});
 assert.equal((await account(alice)).reserved,0);assert.equal((await account(alice)).balance,300);
 const paid=await action(alice,'withdraw_request',{fullNameLatin:'Test Player',transferCountry:'Россия',amount:100,note:'Тестовые реквизиты'}),paidKey=randomUUID();
 await action(owner,'withdraw_paid',{withdrawalId:paid.operationId,reason:'External transfer confirmed'},paidKey);
 await action(owner,'withdraw_paid',{withdrawalId:paid.operationId,reason:'External transfer confirmed'},paidKey);
 assert.equal((await account(alice)).balance,200);assert.equal((await account(alice)).reserved,0);
 await assert.rejects(()=>action(owner,'withdraw_paid',{withdrawalId:paid.operationId,reason:'Repeat'}),/уже/);
 await action(bob,'transfer',{userId:alice,amount:200});
 await action(owner,'reverse',{operationId:transferKey,reason:'Mistaken recipient'});
 assert.equal((await account(bob)).balance,-200);
 await assert.rejects(()=>action(bob,'transfer',{userId:alice,amount:1}),/Недостаточно/);
 await credit(bob,250);assert.equal((await account(bob)).balance,50);
 await assert.rejects(()=>action(owner,'reverse',{operationId:transferKey,reason:'Again'}),/уже/);
 assert.equal((await db.query('select balance::int from site_wallets where user_id=$1',[alice])).rows[0].balance,123456);
 const perms=(await db.query("select has_function_privilege('authenticated','u6_coin_action(uuid,uuid,text,jsonb)','execute') member,has_function_privilege('service_role','u6_coin_entry(uuid,uuid,bigint,bigint)','execute') helper")).rows[0];
 assert.deepEqual(perms,{member:false,helper:false});
 console.log('PASS: main/demo isolation, delegated admin rights, idempotent transfers, withdrawal reserves, paid/rejected/duplicate requests, reversal debt and automatic repayment');

 await credit(owner,2000);
 const config=structuredClone(base),session=id(996010),group=id(996011),game=id(996012);
 config.prizePlan=[250,150,100];config.type='training';config.rules.mode='training';config.organizerUserId=owner;config.title='Funded training';
 config.sessions=[{...base.sessions[0],id:session,startTime:'2031-01-06T16:00:00Z',endTime:'2031-01-06T17:00:00Z',registrationOpenTime:null,registrationCloseTime:null,responsibleUserId:null,stage:'ordinary',sourceSessionId:null,
  groups:[{id:group,name:'A',capacity:12,games:[{id:game,map:'bermuda'}]}]}];
 const created=(await db.query('select u2_event_configuration($1,null,0,$2::jsonb) value',[owner,JSON.stringify(config)])).rows[0].value;
 assert.equal((await account(owner)).reserved,500);
 await db.query('select u2_event_configuration($1,$2,1,$3::jsonb)',[owner,created.eventId,JSON.stringify(config)]);
 assert.equal((await account(owner)).reserved,500,'Repeated save does not double reserve');
 await credit(owner,-1500);
 const failed=structuredClone(config);failed.sessions[0].id=id(996020);failed.sessions[0].groups[0].id=id(996021);failed.sessions[0].groups[0].games[0].id=id(996022);
 await assert.rejects(()=>db.query('select u2_event_configuration($1,null,0,$2::jsonb)',[owner,JSON.stringify(failed)]),/не хватает 500/);
 assert.equal((await db.query('select count(*)::int n from event_sessions where id=$1',[id(996020)])).rows[0].n,0,'Creation and reservation rollback together');
 await credit(owner,1500);
 const teams=[id(996030),id(996031),id(996032)],regs=[id(996040),id(996041),id(996042)];
 for(let i=0;i<3;i++){
  await db.query('insert into teams(id,name,type) values($1,$2,\'team\')',[teams[i],`Prize team ${i}`]);
  await db.query("insert into event_registrations(id,event_id,session_id,group_id,team_id,roster_json) values($1,$2,$3,$4,$5,'[]')",[regs[i],created.eventId,session,group,teams[i]]);
 }
 await db.query("insert into team_members(team_id,user_id,role_in_team) values($1,$2,'leader')",[teams[0],owner]);
 const rows=teams.map((teamId,i)=>({registrationId:regs[i],teamId,userId:null,gameId:game,groupId:group,played:true,reason:'no_show',detail:'team',place:i+1,kills:10-i,points:22-i,players:[],fieldSize:3,rounds:null}));
 const standings=teams.map((teamId,i)=>({registrationId:regs[i],teamId,userId:null,groupId:group,name:`Prize team ${i}`,place:i+1,kills:10-i,points:22-i,placeSum:i+1,wins:i===0?1:0,gamesPlayed:1,bonus:0,manual:false}));
 const pub={rows,standings,rules:config.rules,mvps:[],prizes:[{registrationId:regs[2],amount:999999}]};
 const draft={rows,warnings:[],manualOrder:[],prizes:[]};
 const revision=(await db.query('select configuration_revision from event_sessions where id=$1',[session])).rows[0].configuration_revision;
 const save=(expected,document,key=randomUUID())=>db.query('select u2_save_results($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)',[owner,session,expected,revision,key,key,JSON.stringify(draft),JSON.stringify(document)]);
 const key=randomUUID();await save(0,pub,key);await save(0,pub,key);
 assert.deepEqual(await Promise.all(teams.map(async t=>(await account(t,true)).balance)),[250,150,100]);
 assert.equal((await account(owner)).balance,1500);assert.equal((await account(owner)).reserved,0);
 assert.equal(Number((await db.query("select (published->'prizes'->0->>'amount')::int amount from competition_publications where session_id=$1",[session])).rows[0].amount),250,'Forged client award is ignored');
 await action(owner,'transfer',{teamId:teams[0],userId:alice,amount:250});
 const corrected=structuredClone(pub);corrected.standings[0].place=3;corrected.standings[2].place=1;
 await save(1,corrected);
 assert.deepEqual(await Promise.all(teams.map(async t=>(await account(t,true)).balance)),[-150,150,250]);
 assert.equal((await account(owner)).balance,1500);
 const ledgerBefore=(await db.query('select count(*)::int n from coin_entries')).rows[0].n;
 await save(2,corrected);
 assert.equal((await db.query('select count(*)::int n from coin_entries')).rows[0].n,ledgerBefore,'Same financial result creates no extra entries');
 await db.query("update event_sessions set status='cancelled' where id=$1",[session]);
 assert.equal((await account(owner)).balance,2000);assert.equal((await account(owner)).reserved,0);
 assert.deepEqual(await Promise.all(teams.map(async t=>(await account(t,true)).balance)),[-250,0,0]);
 console.log('PASS: 500-coin atomic reservation, insufficient funds rollback, podium 250/150/100, forged prize rejection, publication idempotency, corrected standings/debt and cancellation refund');

 // Verify that the real creator grant is migrated once while ordinary demo
 // money stays in betting. Uses the exact migration block on test-only rows.
 await db.query('insert into site_wallets(user_id,balance) values($1,1000900)',[owner]);
 await db.query("insert into currency_ledger(id,user_id,amount,balance_after,operation_type,reference_type,description) values('6b387a6c-b825-477d-a7b1-f8cf95d4efbb',$1,1000000,1000900,'correction','creator_grant','Test')",[owner]);
 const migration=await readFile(new URL('../../supabase/migrations/202610290003_main_coin_wallets.sql',import.meta.url),'utf8');
 const block=migration.slice(migration.lastIndexOf('do $$'),migration.lastIndexOf('commit;'));
 await db.exec(block);await db.exec(block);
 assert.equal((await account(owner)).balance,1002000);
 assert.equal((await db.query('select balance::int from site_wallets where user_id=$1',[owner])).rows[0].balance,900);
 console.log('PASS: creator grant moves once to primary wallet; demo starting funds do not migrate');

 await action(owner,'reset',{kind:'player',ownerId:owner,reason:'Scheduler fixture'});await credit(owner,1000);
 const recurring=structuredClone(config);recurring.title='Funded recurring';recurring.trainingSchedule={enabled:true,startsOn:'2026-11-02'};
 recurring.sessions[0].id=id(996060);recurring.sessions[0].startTime='2026-10-04T16:00:00Z';recurring.sessions[0].endTime='2026-10-04T17:00:00Z';
 recurring.sessions[0].groups[0].id=id(996061);recurring.sessions[0].groups[0].games[0].id=id(996062);
 const recurringId=(await db.query('select u2_event_configuration($1,null,0,$2::jsonb) value',[owner,JSON.stringify(recurring)])).rows[0].value.eventId;
 const run=async()=>(await db.query("select u3_extend_training_schedules('2026-11-02T08:00:00Z') value")).rows[0].value;
 const first=await run();
 assert.ok(first.fundingErrors.some(e=>e.eventId===recurringId));
 assert.equal((await db.query('select count(*)::int n from event_prize_funds f join event_sessions s on s.id=f.session_id where s.event_id=$1',[recurringId])).rows[0].n,2);
 assert.equal((await account(owner)).reserved,1000);
 const after=(await db.query('select training_generated_through,prize_funding_error from events where id=$1',[recurringId])).rows[0];
 assert.equal(after.training_generated_through,null);assert.match(after.prize_funding_error,/Недостаточно/);
 await run();assert.equal((await account(owner)).reserved,1000,'Insufficient retry cannot double reserve');
 await credit(owner,3000);await run();
 assert.equal((await db.query('select count(*)::int n from event_prize_funds f join event_sessions s on s.id=f.session_id where s.event_id=$1',[recurringId])).rows[0].n,8);
 assert.equal((await account(owner)).reserved,4000);
 assert.equal((await db.query('select prize_funding_error from events where id=$1',[recurringId])).rows[0].prize_funding_error,null);
 console.log('PASS: recurring sessions reserve independently, insufficient funds leave no unpaid session, warnings/retry after top-up preserve earlier funded dates');
}
