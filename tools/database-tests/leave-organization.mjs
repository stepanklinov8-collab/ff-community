import assert from 'node:assert/strict';

export async function verifyLeaveOrganization(db,id) {
 const actor=id(3),leader=id(2),other=id(9899);
 const counts=async()=>(await db.query(`select
  (select count(*)::integer from public.competition_player_facts) players,
  (select count(*)::integer from public.competition_team_facts) teams,
  (select count(*)::integer from public.organization_participation_history) history,
  (select count(*)::integer from public.event_registrations) registrations`)).rows[0];
 const before=await counts();
 await db.query(`insert into public.teams(id,name,type) values($1,'Other membership','guild')`,[other]);
 await db.query(`insert into public.team_members(team_id,user_id,role_in_team) values($1,$2,'main')`,[other,actor]);
 async function asUser(user,work,role='authenticated') {
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[user??'']);
  await db.exec(`set role ${role}`);
  try{return await work();}finally{await db.exec('reset role');}
 }
 let n=9800;
 for(const type of ['team','guild'])for(const role of ['main','member','deputy','senior_deputy']) {
  const organization=id(n++);
  await db.query(`insert into public.teams(id,name,type) values($1,'Leave matrix',$2)`,[organization,type]);
  await db.query(`insert into public.team_members(team_id,user_id,role_in_team) values($1,$2,'leader'),($1,$3,$4)`,[organization,leader,actor,role]);
  await assert.rejects(()=>asUser(leader,()=>db.query(`select public.leave_organization($1)`,[organization])),/Передайте лидерство/);
  await assert.rejects(()=>asUser(id(1),()=>db.query(`select public.leave_organization($1)`,[organization])),/не состоите/);
  await assert.rejects(()=>asUser(null,()=>db.query(`select public.leave_organization($1)`,[organization])),/Authentication required/);
  await assert.rejects(()=>asUser(null,()=>db.query(`select public.leave_organization($1)`,[organization]),'anon'),/permission denied/);
  await asUser(actor,()=>db.query(`select public.leave_organization($1)`,[organization]));
  assert.equal((await db.query(`select count(*)::integer n from public.team_members where team_id=$1 and user_id=$2`,[organization,actor])).rows[0].n,0);
  assert.equal((await db.query(`select count(*)::integer n from public.team_members where team_id=$1 and user_id=$2`,[organization,leader])).rows[0].n,1);
  assert.equal((await db.query(`select count(*)::integer n from public.team_members where team_id=$1 and user_id=$2`,[other,actor])).rows[0].n,1);
  await assert.rejects(()=>asUser(actor,()=>db.query(`select public.leave_organization($1)`,[organization])),/не состоите/);
 }
 assert.deepEqual(await counts(),before);
 console.log('PASS: leave team/guild for all non-leader roles; authenticated grants, guest/outsider/leader denial, repeat calls, other memberships and published statistics preserved');
}
