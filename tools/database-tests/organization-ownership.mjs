import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

export async function verifyOrganizationOwnership(db, id) {
 const owner=id(6),oldLeader=id(2),nextLeader=id(3),delegate=id(4),outsider=id(5),notMember=id(7),team=id(8800),guild=id(8801);
 await db.query(`insert into auth.users(id) values($1),($2),($3),($4) on conflict(id) do nothing`,[delegate,outsider,owner,notMember]);
 await db.query(`insert into public.profiles(id,nickname) values($1,'Contract delegate'),($2,'Outsider'),($3,'Organization owner'),($4,'Non-member') on conflict(id) do nothing`,[delegate,outsider,owner,notMember]);
 await db.query(`insert into public.teams(id,name,type,leader_id) values($1,'Ownership team','team',$2),($3,'Ownership guild','guild',$4)`,[team,oldLeader,guild,nextLeader]);
 await db.query(`insert into public.team_members(team_id,user_id,role_in_team) values
  ($1,$2,'leader'),($1,$3,'main'),($1,$4,'main'),($1,$5,'main'),
  ($6,$3,'leader'),($6,$5,'main')`,[team,oldLeader,nextLeader,delegate,outsider,guild]);
 await db.exec(`begin;
  select set_config('omcite.allow_organization_owner_transfer','on',true);
  update public.teams set owner_user_id='${owner}' where id='${team}';
  commit;`);

 async function asUser(user,work,role='authenticated') {
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[user??'']);
  await db.exec(`set role ${role}`);
  try{return await work();}finally{await db.exec('reset role');}
 }
 assert.equal((await db.query(`select public.is_organization_owner($1,$2) value`,[team,owner])).rows[0].value,true);
 assert.equal((await db.query(`select public.can_manage_team($1,$2) value`,[team,owner])).rows[0].value,true,'owner can use organization management/registration permissions outside the roster');
 assert.equal((await db.query(`select public.is_owner($1) value`,[owner])).rows[0].value,false,'organization ownership never grants site-owner privileges');
 assert.equal((await db.query(`select owner_user_id from public.teams where id=$1`,[id(9952)])).rows[0].owner_user_id,id(9951),'legacy backfill uses the current leader');
 assert.equal((await db.query(`select count(*)::integer n from public.team_members where team_id=$1`,[id(9952)])).rows[0].n,1,'backfill does not change existing rosters');
 await assert.rejects(()=>db.query(`update public.teams set owner_user_id=$2 where id=$1`,[team,oldLeader]),/Изменить владельца можно только завершённой сделкой/);

 const setLeader=(actor,newLeader,remove)=>asUser(actor,()=>db.query(`select public.organization_owner_set_leader($1,$2,$3)`,[team,newLeader,remove]));
 await assert.rejects(()=>setLeader(oldLeader,delegate,false),/Только владелец/);
 await assert.rejects(()=>setLeader(owner,notMember,false),/должен состоять/);
 await setLeader(owner,nextLeader,false);
 assert.equal((await db.query(`select leader_id from public.teams where id=$1`,[team])).rows[0].leader_id,nextLeader);
 assert.equal((await db.query(`select role_in_team from public.team_members where team_id=$1 and user_id=$2`,[team,oldLeader])).rows[0].role_in_team,'main');
 assert.equal((await db.query(`select owner_user_id from public.teams where id=$1`,[team])).rows[0].owner_user_id,owner,'changing leader does not change owner');
 await setLeader(owner,delegate,true);
 assert.equal((await db.query(`select leader_id from public.teams where id=$1`,[team])).rows[0].leader_id,delegate);
 assert.equal((await db.query(`select count(*)::integer n from public.team_members where team_id=$1 and user_id=$2`,[team,nextLeader])).rows[0].n,0,'owner can choose to remove the former leader from the roster');
 assert.equal((await db.query(`select count(*)::integer n from public.team_members where team_id=$1 and user_id=$2`,[team,oldLeader])).rows[0].n,1,'former leader remains when the removal option was not selected');
 assert.equal((await db.query(`select count(*)::integer n from public.organization_control_audit where team_id=$1 and action='leader_removed_from_roster'`,[team])).rows[0].n,1);

 await asUser(owner,()=>db.query(`select public.organization_owner_set_contract_access($1,$2,true)`,[team,outsider]));
 assert.equal((await db.query(`select public.can_manage_organization_contracts($1,$2) value`,[team,outsider])).rows[0].value,true);
 assert.equal((await db.query(`select public.can_manage_team($1,$2) value`,[team,outsider])).rows[0].value,false,'contract access does not grant general organization-management permissions');
 assert.equal((await asUser(outsider,()=>db.query(`select count(*)::integer n from public.organization_contract_access where team_id=$1`,[team]))).rows[0].n,0,'delegate cannot read the owner-only access list');
 assert.equal((await asUser(owner,()=>db.query(`select count(*)::integer n from public.organization_contract_access where team_id=$1`,[team]))).rows[0].n,1,'owner can view delegated access');
 await db.query(`delete from public.team_members where team_id=$1 and user_id=$2`,[team,outsider]);
 assert.equal((await db.query(`select public.can_manage_organization_contracts($1,$2) value`,[team,outsider])).rows[0].value,false,'leaving the roster revokes delegated contract access');
 assert.equal((await db.query(`select count(*)::integer n from public.organization_control_audit where team_id=$1 and action='contract_access_revoked_member_removed'`,[team])).rows[0].n,1);

 const foundation=await readFile(new URL('../../supabase/migrations/202609010001_omcite_foundation.sql',import.meta.url),'utf8');
 const registrationStart=foundation.indexOf('create or replace function public.register_team_for_session(');
 const registrationEnd=foundation.indexOf('create or replace function public.cancel_session_registration(',registrationStart);
 await db.exec(foundation.slice(registrationStart,registrationEnd));
 await db.exec(`grant execute on function public.register_team_for_session(uuid,uuid,uuid[]) to authenticated`);
 const event=id(8820),session=id(8821);
 await db.query(`insert into public.events(id,title,type,organizer_user_id,max_teams,min_players) values($1,'Owner registration test','tournament',$2,12,1)`,[event,owner]);
 await db.query(`insert into public.event_sessions(id,event_id,start_time,end_time,registration_open_time,registration_close_time,max_teams,status)
  values($1,$2,now()+interval '3 days',now()+interval '3 days 1 hour',now()-interval '1 hour',now()+interval '2 days',12,'scheduled')`,[session,event]);
 const registered=await asUser(owner,()=>db.query(`select * from public.register_team_for_session($1,$2,$3::uuid[])`,[session,team,[delegate]]));
 assert.equal(registered.rows[0].registration_status,'confirmed','off-roster owner can register the organization using its existing player roster');
 assert.equal((await db.query(`select registered_by from public.event_registrations where id=$1`,[registered.rows[0].registration_id])).rows[0].registered_by,owner);

 const orgAccount=(await db.query(`select public.u6_coin_account('organization',$1) account`,[team])).rows[0].account;
 await db.query(`update public.coin_accounts set balance=500 where id=$1`,[orgAccount]);
 const transferInput={teamId:team,userId:nextLeader,amount:100};
 await db.query(`select public.u6_coin_action($1,$2,'transfer',$3::jsonb)`,[owner,id(8810),JSON.stringify(transferInput)]);
 assert.equal(Number((await db.query(`select balance from public.coin_accounts where id=$1`,[orgAccount])).rows[0].balance),400,'owner can transfer organizational funds while outside the roster');
 await assert.rejects(()=>db.query(`select public.u6_coin_action($1,$2,'transfer',$3::jsonb)`,[oldLeader,id(8811),JSON.stringify({...transferInput,amount:10})]),/владелец или руководитель/);
 const withdrawal={teamId:team,amount:50,note:'Тестовые реквизиты'};
 await db.query(`select public.u6_coin_action($1,$2,'withdraw_request',$3::jsonb)`,[owner,id(8812),JSON.stringify(withdrawal)]);
 assert.equal(Number((await db.query(`select reserved from public.coin_accounts where id=$1`,[orgAccount])).rows[0].reserved),50,'owner can reserve an organization withdrawal');

 console.log('PASS: owner/leader separation, legacy owner backfill, off-roster owner authority, optional leader removal, scoped contract delegation, automatic revocation, site-role isolation, organization transfers and withdrawal reserve');
}
