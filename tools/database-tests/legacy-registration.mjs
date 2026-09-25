import assert from 'node:assert/strict';
export async function verifyLegacyRegistration(db,id,base){
 const config=structuredClone(base);config.minPlayers=1;config.maxTeams=1024;
 config.sessions=[{...base.sessions[0],id:id(6200),responsibleUserId:null,startTime:new Date(Date.now()+864000000).toISOString(),endTime:new Date(Date.now()+867600000).toISOString(),maxTeams:1024,groups:[{id:id(6201),name:'Capacity two',capacity:2,games:[{id:id(6202),map:'bermuda'}]}]}];
 await db.query('select u2_event_configuration($1,null,0,$2::jsonb)',[id(1),JSON.stringify(config)]);
 const registrations=[];
 try{
  for(let n=0;n<3;n++){
   await db.query('insert into auth.users(id) values($1)',[id(6210+n)]);
   await db.query('insert into profiles(id,nickname) values($1,$2)',[id(6210+n),`Self-registration ${n}`]);
   await db.query('insert into teams(id,name) values($1,$2)',[id(6220+n),`Self team ${n}`]);
   await db.query(`insert into team_members(team_id,user_id,role_in_team) values($1,$2,'leader')`,[id(6220+n),id(6210+n)]);
   await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[id(6210+n)]);
   if(n===0)await assert.rejects(()=>db.query('select * from register_team_for_session($1,$2,$3::uuid[])',[id(6200),id(6220+n),[id(6210+n),id(6210+n)]]),/повторяться/);
   const result=(await db.query('select * from register_team_for_session($1,$2,$3::uuid[])',[id(6200),id(6220+n),[id(6210+n)]])).rows[0];
   assert.equal(result.registration_status,n<2?'confirmed':'waiting');registrations.push(result.registration_id);
  }
  await db.query(`update event_sessions set start_time=now()+interval '9 minutes' where id=$1`,[id(6200)]);
  await assert.rejects(()=>db.query('select cancel_session_registration($1)',[registrations[2]]),/Состав уже закрыт/);
  await db.query('update event_sessions set start_time=$2 where id=$1',[id(6200),config.sessions[0].startTime]);
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[id(6210)]);
  const promoted=(await db.query('select cancel_session_registration($1) id',[registrations[0]])).rows[0].id;
  assert.equal(promoted,registrations[2]);
  const row=(await db.query('select status,group_id from event_registrations where id=$1',[promoted])).rows[0];
  assert.deepEqual(row,{status:'confirmed',group_id:id(6201)});
  assert.equal((await db.query(`select count(*)::integer count from event_registrations where group_id=$1 and status='confirmed'`,[id(6201)])).rows[0].count,2);
 }finally{await db.query(`select set_config('request.jwt.claim.sub','',false)`);}
 console.log('PASS: authenticated original registration RPCs, duplicate roster rejection, truthful waiting status, ten-minute cancellation lock, capacity-aware promotion');
}
