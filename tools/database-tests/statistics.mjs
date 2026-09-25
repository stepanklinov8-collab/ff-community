import assert from 'node:assert/strict';
export async function verifyStatistics(db,id){
 const leaderboard=async(mode='main',query='Statistic',offset=0,limit=50)=>(await db.query(`select public.u2_leaderboard($1,'player',$2,$3,$4) value`,[mode,query,limit,offset])).rows[0].value;
 for(let n=2000;n<2004;n++){
  await db.query(`insert into auth.users(id) values($1)`,[id(n)]);
  await db.query(`insert into public.profiles(id,nickname) values($1,$2)`,[id(n),`Statistic ${n}`]);
  await db.query(`insert into public.competition_ratings(target_type,target_id,mode,exact_rating,display_rating,wins,games) values('player',$1,'main',$2,round($2::numeric,1),$3,5)`,[id(n),n<2002?'99.941':'99.940',n===2003?0:1]);
 }
 const page=await leaderboard();
 assert.deepEqual(page.items.map(x=>x.id),[id(2000),id(2001),id(2002),id(2003)]);
 assert.deepEqual(page.items.map(x=>Number(x.position)),[1,1,3,4]);
 assert.ok(page.items.every(x=>x.rating===99.9&&!('exact_rating' in x)));
 assert.equal((await leaderboard('main','Statistic 2002')).items[0].position,3,'Search keeps global position');
 assert.equal((await leaderboard('bo')).items.length,0,'No BO place before first confirmed series');
 const first=await leaderboard('main','Statistic',0,2),second=await leaderboard('main','Statistic',2,2);
 assert.equal(first.hasMore,true);assert.equal(second.hasMore,false);
 assert.deepEqual([...first.items,...second.items].map(x=>x.id),page.items.map(x=>x.id));
 const event=(await db.query(`select event_id from public.event_sessions where id=$1`,[id(700)])).rows[0].event_id;
 await db.query(`insert into public.events(id,title,type) values($1,'Historical solo','solo')`,[id(2050)]);
 await db.query(`insert into public.player_stats(user_id,event_id,kills,matches_played,status) values($1,$2,123,4,'approved')`,[id(2003),id(2050)]);
 assert.equal((await leaderboard('main','Statistic 2003')).items[0].kills,0);
 assert.equal((await leaderboard('solo','Statistic 2003')).items[0].kills,123);
 const history=(await db.query(`select place,deaths,assists,games from public.competition_public_history where target_id=$1 and mode='solo'`,[id(2003)])).rows[0];
 assert.deepEqual(history,{place:null,deaths:null,assists:null,games:4});
 // Old aggregate writes cannot bypass a canonical publication, even via the old trigger chain.
 await assert.rejects(()=>db.query(`insert into public.player_stats(user_id,event_id,session_id,kills,matches_played,status) values($1,$2,$3,999,8,'approved')`,[id(2003),event,id(700)]),/уже опубликованы/);
 await db.query(`insert into auth.users(id) select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(3000,4004) n`);
 await db.query(`insert into public.profiles(id,nickname) select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Pagination '||n from generate_series(3000,4004) n`);
 const tail=await leaderboard('main','Pagination',1000);
 assert.equal(tail.items.length,5);assert.equal(tail.hasMore,false);
 assert.equal(await db.query(`select has_table_privilege('anon','public.competition_public_history','SELECT') allowed`).then(r=>r.rows[0].allowed),false);
 console.log('PASS: exact hidden rating order, 1/1/3 shared ranks, preserved search positions, pagination beyond 1,000, mode isolation, legacy unknown values and guarded legacy writes');
}
