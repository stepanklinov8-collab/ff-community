import assert from 'node:assert/strict';
export async function verifyReserveQueue(db,id,base){
 const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
 const session=id(99001),group=id(99002),config=structuredClone(base);
 config.minPlayers=1;config.maxTeams=2;config.cost=0;
 const startTime=new Date(Date.now()+86400000).toISOString();
 config.sessions=[{...base.sessions[0],id:session,startTime,endTime:new Date(Date.parse(startTime)+3600000).toISOString(),registrationOpenTime:new Date(Date.now()-86400000).toISOString(),registrationCloseTime:new Date(Date.now()+3600000).toISOString(),responsibleUserId:id(3),maxTeams:2,groups:[{id:group,name:'Reserve',capacity:2,games:[{id:id(99003),map:'bermuda'}]}]}];
 const event=(await scalar('select u2_event_configuration($1,null,0,$2::jsonb)',[id(1),JSON.stringify(config)])).eventId;
 const regs=[];
 try{
  for(let n=0;n<5;n++){
   const user=id(99010+n),team=id(99020+n);
   await db.query('insert into auth.users(id) values($1)',[user]);
   await db.query('insert into profiles(id,nickname) values($1,$2)',[user,`Reserve ${n}`]);
   await db.query('insert into teams(id,name) values($1,$2)',[team,`Reserve ${n}`]);
   await db.query("insert into team_members(team_id,user_id,role_in_team) values($1,$2,'leader')",[team,user]);
   await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
   const row=(await db.query('select * from register_team_for_session($1,$2,$3::uuid[])',[session,team,[user]])).rows[0];
   assert.equal(row.registration_status,n<2?'confirmed':'waiting');regs.push(row.registration_id);
  }
  await db.query("select set_config('request.jwt.claim.sub','',false)");
  assert.equal(Number(await scalar("select count(*) from event_registrations where session_id=$1 and status='waiting'",[session])),3,'Reserve can exceed main capacity');
  await db.query("update event_registrations set created_at='2026-01-01' where id=any($1::uuid[])",[regs.slice(2)]);
  const fifo=(await db.query("select id from event_registrations where session_id=$1 and status='waiting' order by created_at,id",[session])).rows.map(r=>r.id);
  await db.query("update event_registrations set status='cancelled' where id=$1",[regs[0]]);
  assert.equal(await scalar('select status from event_registrations where id=$1',[fifo[0]]),'confirmed','FIFO tie broken by ID');
  await db.query("update event_sessions set registration_close_time=now()-interval '1 second' where id=$1",[session]);
  await db.query("update event_registrations set status='cancelled' where id=$1",[regs[1]]);
  assert.equal(await scalar('select status from event_registrations where id=$1',[fifo[1]]),'waiting','No automatic promotion after close');
  let operation=99100;
  const promote=(actor,reg,action='promote')=>db.query('select u2_registration_action($1,$2,(select configuration_revision from event_sessions where id=$2),$3::jsonb,$4)',[id(actor),session,JSON.stringify({action,id:reg,status:'confirmed'}),id(operation++)]);
  await assert.rejects(()=>promote(99010,fifo[1]),/Нет|доступ|прав/i,'Participant cannot promote itself');
  await assert.rejects(()=>promote(3,fifo[1]),/организатор или администратор/);
  await assert.rejects(()=>promote(3,fifo[1],'edit'),/организатор или администратор/,'Generic edit cannot bypass permission');
  const reserveTeam=await scalar('select team_id from event_registrations where id=$1',[fifo[1]]);
  await db.query('update teams set verified=false where id=$1',[reserveTeam]);
  await assert.rejects(()=>promote(1,fifo[1]),/Проверьте состав/,'Manual promotion rejects ineligible team');
  await db.query('update teams set verified=true where id=$1',[reserveTeam]);
  await promote(1,fifo[1]);
  assert.equal(await scalar('select status from event_registrations where id=$1',[fifo[1]]),'confirmed','Admin may promote after close before lock');
  await db.query("update event_sessions set start_time=now()+interval '9 minutes' where id=$1",[session]);
  await db.query("update event_registrations set status='cancelled' where id=$1",[fifo[0]]);
  await assert.rejects(()=>promote(1,fifo[2]),/состав заблокирован/,'Manual promotion ends at roster lock');
  await db.query("update event_sessions set registration_close_time=now()+interval '8 minutes' where id=$1",[session]);
  assert.equal(await scalar('select u5_fill_reserve($1)',[session]),fifo[2],'Automatic promotion remains allowed until actual registration close');
  assert.equal(Number(await scalar("select count(*) from event_registrations where session_id=$1 and status='confirmed'",[session])),2);
  assert.equal(await scalar("select has_function_privilege('authenticated','u5_fill_reserve(uuid)','execute')"),false);
  assert.equal(await scalar('select event_id from event_sessions where id=$1',[session]),event);
 }finally{await db.query("select set_config('request.jwt.claim.sub','',false)");}
 console.log('PASS: reserve above capacity, FIFO, deadline, admin/responsible/participant permissions, generic edit bypass prevention, eligibility and roster lock');
}
