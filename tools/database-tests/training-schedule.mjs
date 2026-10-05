import assert from 'node:assert/strict';
export async function verifyTrainingSchedule(db,id,base){
 const config=structuredClone(base);
 config.type='training';config.rules.mode='training';config.organizerUserId=id(1);
 config.trainingSchedule={enabled:true,startsOn:'2026-10-05'};
 config.sessions=[{...config.sessions[0],id:id(7100),stage:'ordinary',startTime:'2026-10-04T16:00:00Z',endTime:'2026-10-04T17:00:00Z',
   groups:[{id:id(7101),name:'Template',capacity:15,roomId:'private',roomPassword:'private',roomNote:'old',games:[{id:id(7102),map:'solara'}]}]}];
 const event=(await db.query('select public.u2_event_configuration($1,null,0,$2::jsonb) value',[id(1),JSON.stringify(config)])).rows[0].value.eventId;
 const original=(await db.query('select * from public.event_sessions where id=$1',[id(7100)])).rows[0];
 await db.query(`insert into public.event_sessions(id,event_id,start_time,end_time,status) values($1,$2,'2026-10-06T17:00Z','2026-10-06T18:00Z','cancelled')`,[id(7103),event]);
 const run=async(now)=>(await db.query('select public.u3_extend_training_schedules($1) value',[now])).rows[0].value;
 assert.equal((await run('2026-10-05T08:00Z')).sessions,7);
 const sessions=(await db.query(`select to_char(start_time at time zone 'Europe/Moscow','YYYY-MM-DD HH24:MI') start,
   to_char(end_time at time zone 'Europe/Moscow','HH24:MI') finish,
   to_char(registration_open_time at time zone 'Europe/Moscow','HH24:MI') opens,
   to_char(registration_close_time at time zone 'Europe/Moscow','HH24:MI') closes
   from public.event_sessions where event_id=$1 and id<>$2 and status<>'cancelled' order by start_time`,[event,id(7100)])).rows;
 assert.deepEqual(sessions.map(s=>s.start),['2026-10-05 19:00','2026-10-08 19:00','2026-10-11 19:00','2026-10-12 19:00','2026-10-13 19:00','2026-10-15 19:00','2026-10-18 19:00']);
 assert.ok(sessions.every(s=>s.finish==='20:00'&&s.opens==='10:00'&&s.closes==='18:59'));
 assert.deepEqual((await db.query('select * from public.event_sessions where id=$1',[id(7100)])).rows[0],original);
 assert.equal((await db.query(`select count(*)::int n from public.event_groups g join public.event_sessions s on s.id=g.session_id
   where s.event_id=$1 and s.id<>$2 and (g.room_id<>'' or g.room_password<>'' or g.room_note<>'')`,[event,id(7100)])).rows[0].n,0);
 assert.equal((await run('2026-10-05T08:01Z')).sessions,0);
 const cycle=(await db.query(`select g.map_name,count(*)::int n from public.event_games g join public.event_sessions s on s.id=g.session_id
   where s.event_id=$1 and s.training_rotation_position between 0 and 4 group by g.map_name order by g.map_name`,[event])).rows;
 assert.deepEqual(cycle,[{map_name:'bermuda',n:3},{map_name:'kalahari',n:3},{map_name:'nexterra',n:3},{map_name:'purgatory',n:3},{map_name:'solara',n:3}]);
 assert.equal((await run('2026-10-12T08:00Z')).sessions,4);
 assert.equal((await db.query('select max(training_rotation_position)::int n from public.event_sessions where event_id=$1',[event])).rows[0].n,10);
 await db.query(`update public.events set frozen_at=now() where id=$1`,[event]);
 assert.equal((await run('2026-10-19T08:00Z')).sessions,0);
 await db.query(`update public.events set frozen_at=null,pending_changes='{}' where id=$1`,[event]);
 assert.equal((await run('2026-10-19T08:00Z')).sessions,0);
 await db.query(`update public.events set pending_changes=null,training_schedule=null where id=$1`,[event]);
 assert.equal((await run('2026-10-19T08:00Z')).sessions,0);
 const permissions=(await db.query(`select has_function_privilege('anon','public.u3_extend_training_schedules(timestamptz)','execute') anon,
 has_function_privilege('authenticated','public.u3_extend_training_schedules(timestamptz)','execute') member,
 has_function_privilege('service_role','public.u3_extend_training_schedules(timestamptz)','execute') service`)).rows[0];
 assert.deepEqual(permissions,{anon:false,member:false,service:true});
 // New unverified organizers still need approval, including template changes.
 const draft=structuredClone(config);draft.organizerUserId=id(3);draft.trainingSchedule=null;
 draft.sessions[0].id=id(7120);draft.sessions[0].groups[0].id=id(7121);draft.sessions[0].groups[0].games[0].id=id(7122);
 const second=(await db.query('select public.u2_event_configuration($1,null,0,$2::jsonb) value',[id(1),JSON.stringify(draft)])).rows[0].value;
 draft.trainingSchedule=config.trainingSchedule;
 const pending=(await db.query('select public.u2_event_configuration($1,$2,1,$3::jsonb) value',[id(3),second.eventId,JSON.stringify(draft)])).rows[0].value;
 assert.equal(pending.pending,true);
 assert.equal((await db.query('select training_schedule from public.events where id=$1',[second.eventId])).rows[0].training_schedule,null);
 console.log('PASS: recurring Moscow trainings, schedule times, idempotency, cancelled dates, preserved history, disabled/frozen/pending events and permissions');
}
