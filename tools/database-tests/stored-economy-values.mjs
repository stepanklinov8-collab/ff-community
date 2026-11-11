import assert from 'node:assert/strict';
export async function verifyStoredEconomyValues(db,id){
 const owner=id(29001),player=id(29002),teammate=id(29003),team=id(29004),guild=id(29005);
 const scalar=async(sql,args=[])=>(await db.query(sql,args)).rows[0].value;
 assert.equal(Number(await scalar(`select count(*)::int value from (
  select id from profiles where u5_player_value_exact(id) is distinct from u8_calculate_player_value(id)
  union all select id from teams where u5_organization_value_exact(id) is distinct from u8_calculate_organization_value(id)
 ) mismatches`)),0,'All prior publication, prize, cancellation, roster, weight and contract scenarios leave current stored prices');
 for(const [user,name] of [[owner,'Stored value owner'],[player,'Stored value player'],[teammate,'Stored value teammate']]){
  await db.query('insert into auth.users(id) values($1)',[user]);await db.query('insert into profiles(id,nickname) values($1,$2)',[user,name]);
 }
 await db.query("insert into teams(id,name,type,leader_id) values($1,'Stored price team','team',$3),($2,'Stored price guild','guild',$3)",[team,guild,owner]);
 await db.query("insert into team_members(team_id,user_id,role_in_team) values($1,$2,'main'),($1,$3,'main'),($4,$2,'main')",[team,player,teammate,guild]);
 const check=async()=>{
  for(const user of [owner,player,teammate])assert.equal(String(await scalar('select u5_player_value_exact($1) value',[user])),String(await scalar('select u8_calculate_player_value($1) value',[user])),'exact player formula preserved');
  for(const org of [team,guild])assert.equal(String(await scalar('select u5_organization_value_exact($1) value',[org])),String(await scalar('select u8_calculate_organization_value($1) value',[org])),'exact organization formula preserved');
  assert.equal(Number(await scalar('select count(*)::int value from economy_value_refresh_queue')),0,'no calculation jobs are left for a page reader');
 };
 await check();assert.equal(Number(await scalar('select u2_cost_for_target(\'player\',$1) value',[player])),0);
 await db.query("insert into competition_ratings(target_type,target_id,mode,exact_rating,display_rating,games,kills,wins) values('player',$1,'main',120.5,121,12,60,3),('player',$2,'main',80.25,80,12,36,1)",[player,teammate]);
 await check();const first=Number(await scalar('select u2_cost_for_target(\'player\',$1) value',[player]));assert(first>0);
 await db.query("update competition_ratings set exact_rating=130.5,display_rating=131 where target_type='player' and target_id=$1 and mode='main'",[player]);
 await check();assert(Number(await scalar('select u2_cost_for_target(\'player\',$1) value',[player]))>first);
 const beforeRoster=Number(await scalar('select u5_organization_value_exact($1) value',[team]));
 await db.query('delete from team_members where team_id=$1 and user_id=$2',[team,teammate]);await check();assert(Number(await scalar('select u5_organization_value_exact($1) value',[team]))<beforeRoster);
 // The relative-strength denominator belongs to all organizations, so changing
 // one organization's rating must refresh the others too.
 await db.query('update teams set main_rating=500 where id=$1',[guild]);await check();
 const stamp=await scalar("select calculated_at::text value from economy_value_cache where target_type='player' and target_id=$1",[player]);
 await db.query("update profiles set nickname='Stored renamed',contact_social_url='https://t.me/stored_example' where id=$1",[player]);
 assert.equal(await scalar("select calculated_at::text value from economy_value_cache where target_type='player' and target_id=$1",[player]),stamp,'a nickname/contact edit does not execute price formulas');
 // Once per commit, even when one operation changes the same source repeatedly.
 await db.exec("create table test_price_writes(target uuid); create function test_price_write() returns trigger language plpgsql as $$begin insert into test_price_writes values(new.target_id);return new;end $$;create trigger test_price_updates after update on economy_value_cache for each row execute function test_price_write();");
 await db.exec(`begin;update competition_ratings set exact_rating=140 where target_type='player' and target_id='${player}' and mode='main';update competition_ratings set exact_rating=150 where target_type='player' and target_id='${player}' and mode='main';commit;`);
 assert.equal(Number(await scalar('select count(*)::int value from test_price_writes where target=$1',[player])),1);
 await db.exec('drop trigger test_price_updates on economy_value_cache;drop function test_price_write();drop table test_price_writes;');await check();
 // Stage changes also affect earlier prize eligibility, even without changing
 // the recorded kills or the displayed rating of an individual player.
 const event=id(29006),session=id(29007),next=id(29008),registration=id(29009);
 await db.query("insert into events(id,title,type,organizer_user_id) values($1,'Stored stage test','tournament',$2)",[event,owner]);
 await db.query("insert into event_sessions(id,event_id,start_time,end_time) values($1,$2,now()+interval '1 day',now()+interval '1 day 1 hour')",[session,event]);
 await db.query('insert into competition_publications(session_id,published,first_published_at) values($1,$2::jsonb,now())',[session,JSON.stringify({rules:{mode:'tournament'},rows:[],standings:[{teamId:team,registrationId:registration,place:1,gamesPlayed:1}],prizes:[{registrationId:registration,amount:250}]})]);
 const singleStage=Number(await scalar('select u5_organization_value_exact($1) value',[team]));await check();
 await db.query("insert into event_sessions(id,event_id,start_time,end_time,source_session_id) values($1,$2,now()+interval '2 day',now()+interval '2 day 1 hour',$3)",[next,event,session]);
 await check();assert(Number(await scalar('select u5_organization_value_exact($1) value',[team]))<singleStage,'adding a stage updates earlier prize value');
 await db.query('update event_sessions set source_session_id=null where id=$1',[next]);await check();
 assert.equal(Number(await scalar('select u5_organization_value_exact($1) value',[team])),singleStage,'changing only the stage source refreshes eligibility');
 const original=await scalar("select pg_get_functiondef('public.u8_calculate_player_value(uuid)'::regprocedure) value");
 const cacheBefore=await scalar("select md5(string_agg(to_jsonb(c)::text,',' order by c.target_type,c.target_id)) value from economy_value_cache c");
 await db.exec("create or replace function public.u8_calculate_player_value(p_user uuid) returns numeric language plpgsql stable security definer set search_path=public as $$begin raise exception 'TEST_EXPENSIVE_FORMULA_MUST_NOT_RUN_ON_READ';end $$;");
 try{
  assert(Number(await scalar('select u2_cost_for_target(\'player\',$1) value',[player]))>0);
  const board=await scalar("select u2_leaderboard('main','player','Stored',10,0,'cost') value");assert(board.items.some(row=>row.id===player));
  const organizations=await scalar("select u2_leaderboard('main','team','Stored',10,0,'cost') value");assert(organizations.items.some(row=>row.id===team));
  assert.equal(await scalar("select md5(string_agg(to_jsonb(c)::text,',' order by c.target_type,c.target_id)) value from economy_value_cache c"),cacheBefore,'page reads neither execute formulas nor update prices');
  await assert.rejects(()=>db.query("update competition_ratings set exact_rating=160 where target_type='player' and target_id=$1 and mode='main'",[player]),/TEST_EXPENSIVE_FORMULA/,'a failed recalculation rolls back the source and snapshot atomically');
  assert.equal(Number(await scalar("select exact_rating value from competition_ratings where target_type='player' and target_id=$1 and mode='main'",[player])),150);
 }finally{await db.exec(original);}
 await check();
 for(const role of ['anon','authenticated','service_role']){
  assert.equal(await scalar("select has_table_privilege($1,'public.economy_value_cache','UPDATE') value",[role]),false);
  assert.equal(await scalar("select has_function_privilege($1,'public.u8_calculate_player_value(uuid)','EXECUTE') value",[role]),false);
 }
 console.log('PASS: exact stored player/organization prices, roster/global strength changes, no recomputation on reads, one refresh per transaction, rollback safety and private write/calculation permissions');
}
