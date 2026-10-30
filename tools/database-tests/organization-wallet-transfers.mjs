import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {defaultTerms} from '../../src/modules/contracts/model.ts';

export async function verifyOrganizationWalletTransfers(db,id){
 const admin=id(14000),owner=id(14001),leader=id(14002),member=id(14003),sender=id(14004),buyer=id(14005),player=id(14006);
 const organization=id(14010),recipient=id(14011),dissolved=id(14012),contract=id(14013);
 for(const user of[admin,owner,leader,member,sender,buyer,player]){await db.query('insert into auth.users(id) values($1)',[user]);await db.query('insert into profiles(id,nickname) values($1,$2)',[user,'Org wallet '+user.slice(-4)]);}
 await db.query("insert into user_roles(user_id,role) values($1,'superadmin')",[admin]);
 for(const [org,name] of[[organization,'Independent org account'],[recipient,'Recipient guild'],[dissolved,'Dissolved recipient']])await db.query('insert into teams(id,name,type,leader_id) values($1,$2,$3,$4)',[org,name,org===recipient?'guild':'team',owner]);
 await db.query('update teams set leader_id=$2 where id=$1',[organization,leader]);
 await db.query("insert into team_members(team_id,user_id,role_in_team) values($1,$2,'main'),($1,$3,'main')",[organization,member,player]);
 await db.query('update teams set dissolved_at=now() where id=$1',[dissolved]);
 const action=async(actor,kind,input,key=randomUUID())=>(await db.query('select u6_coin_action($1,$2,$3,$4::jsonb) value',[actor,key,kind,JSON.stringify(input)])).rows[0].value;
 const account=async(kind,user)=>(await db.query(`select balance::int,reserved::int,id from coin_accounts where ${kind==='player'?'user_id':'team_id'}=$1`,[user])).rows[0];
 const fund=async(kind,user,amount)=>action(admin,'adjust',{kind,ownerId:user,amount,reason:'Fund independent wallet test'});
 const requests=async(actor)=>(await db.query('select organization_wallet_withdrawals($1) value',[actor])).rows[0].value;
 await fund('player',owner,5000);await fund('player',sender,1000);await fund('player',buyer,5000);
 const key=randomUUID(),input={recipientTeamId:organization,amount:400};
 await action(sender,'transfer',input,key);await action(sender,'transfer',input,key);
 assert.equal((await account('player',sender)).balance,600);assert.equal((await account('organization',organization)).balance,400);
 assert.equal((await account('player',owner)).balance,5000,'incoming organization money never credits its owner personally');
 assert.equal((await db.query('select count(*)::int n from team_members where team_id=$1 and user_id=$2',[organization,owner])).rows[0].n,0);
 const ownerTransferKey=randomUUID();await action(owner,'transfer',{teamId:organization,userId:owner,amount:100},ownerTransferKey);
 assert.equal((await account('player',owner)).balance,5100);assert.equal((await account('organization',organization)).balance,300);
 await action(owner,'transfer',{teamId:organization,recipientTeamId:recipient,amount:150});
 assert.equal((await account('organization',recipient)).balance,150);
 await assert.rejects(()=>action(member,'transfer',{teamId:organization,recipientTeamId:recipient,amount:1}),/владелец или руководитель/);
 for(const invalid of[{recipientTeamId:dissolved,amount:1},{recipientTeamId:organization,userId:sender,amount:1},{amount:1},{teamId:organization,recipientTeamId:organization,amount:1}])await assert.rejects(()=>action(owner,'transfer',invalid),/распущена|одного получателя|тот же счёт/);
 const withdrawal=await action(owner,'withdraw_request',{teamId:organization,amount:100,note:'Organization bank details'});
 assert.equal((await account('organization',organization)).reserved,100);assert.equal((await account('player',owner)).reserved,0);
 await assert.rejects(()=>action(owner,'transfer',{teamId:organization,recipientTeamId:recipient,amount:51}),/Недостаточно/);
 await action(owner,'transfer',{teamId:organization,recipientTeamId:recipient,amount:50});
 assert.equal((await requests(owner)).find(row=>row.id===withdrawal.operationId).organizationId,organization);
 assert.equal((await requests(leader)).find(row=>row.id===withdrawal.operationId).accountName,'Independent org account');
 assert.equal((await requests(member)).some(row=>row.id===withdrawal.operationId),false,'ordinary members do not read organization bank details');
 await action(leader,'withdraw_cancel',{withdrawalId:withdrawal.operationId});
 assert.equal((await account('organization',organization)).reserved,0);
 const pending=await action(owner,'withdraw_request',{teamId:organization,amount:80,note:'Pending organization withdrawal'});
 await db.query("select set_config('omcite.allow_organization_owner_transfer','on',false)");
 await db.query('update teams set owner_user_id=$2 where id=$1',[organization,buyer]);
 await db.query("select set_config('omcite.allow_organization_owner_transfer','off',false)");
 await assert.rejects(()=>action(owner,'transfer',{teamId:organization,userId:owner,amount:100},ownerTransferKey),/владелец или руководитель/);
 await assert.rejects(()=>action(owner,'withdraw_cancel',{withdrawalId:pending.operationId}),/Нет прав/);
 assert.equal((await requests(owner)).some(row=>row.id===pending.operationId),false,'former owners lose access even to their own organization withdrawal request');
 assert.equal((await requests(buyer)).find(row=>row.id===pending.operationId).canCancel,true);
 await action(buyer,'withdraw_cancel',{withdrawalId:pending.operationId});
 await action(buyer,'transfer',{teamId:organization,userId:buyer,amount:100});
 assert.equal((await account('organization',organization)).balance,0);assert.equal((await account('player',buyer)).balance,5100);

 // A rich owner cannot subsidize a signed contract implicitly. Only an
 // explicit transfer into the organization can fund its mandatory reserves.
 const terms=defaultTerms();terms.financial.signingAmount=100;terms.financial.salary={amount:200,periodDays:10};
 const mutate=async(actor,input)=>(await db.query('select contract_mutate($1,$2::jsonb) value',[actor,JSON.stringify({...input,requestId:randomUUID()})])).rows[0].value;
 await mutate(buyer,{action:'save',contractId:contract,expectedRevision:0,organizationId:organization,playerId:player,kind:'main',eventId:null,sessionId:null,terms});
 await mutate(buyer,{action:'offer',contractId:contract,revision:1});
 const ownerBefore=await account('player',buyer);
 await assert.rejects(()=>mutate(player,{action:'accept',contractId:contract,revision:1}),/CONTRACT_FUNDS/);
 assert.deepEqual(await account('player',buyer),ownerBefore);assert.equal((await account('organization',organization)).reserved,0);
 await action(buyer,'transfer',{recipientTeamId:organization,amount:300});
 const afterExplicitFunding=await account('player',buyer);
 assert.equal((await mutate(player,{action:'accept',contractId:contract,revision:1})).status,'signed');
 assert.deepEqual(await account('player',buyer),afterExplicitFunding,'contract bonus/reserve never falls back to its signing owner');
 assert.equal((await account('organization',organization)).balance,200);assert.equal((await account('organization',organization)).reserved,200);
 assert.equal((await account('player',player)).balance,100);
 const withdrawalPaid=await action(owner,'withdraw_request',{teamId:recipient,amount:200,note:'Recipient guild payout'});
 await action(admin,'withdraw_paid',{withdrawalId:withdrawalPaid.operationId,reason:'External guild payout completed'});
 assert.equal((await account('organization',recipient)).balance,0);assert.equal((await account('player',owner)).balance,5100,'external organization payout debits only organization coins');
 const conservation=(await db.query("select e.operation_id,sum(e.amount)::int total from coin_entries e join coin_operations op on op.id=e.operation_id where op.action='transfer' and op.actor_id=any($1::uuid[]) group by e.operation_id",[[sender,owner,buyer]])).rows;
 assert.ok(conservation.every(row=>row.total===0));
 await db.exec('set role authenticated');try{await assert.rejects(()=>requests(buyer),/permission denied/);}finally{await db.exec('reset role');}
 console.log('PASS: player/organization and organization/organization transfers, off-roster owner access, protected reserves, source-only withdrawals, current/revoked owner ACL and organization-only contract funding');
}
