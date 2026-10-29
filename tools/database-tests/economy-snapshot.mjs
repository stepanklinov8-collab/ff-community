import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
export async function verifyEconomySnapshot(db){
 const snapshot=JSON.parse(await readFile(new URL('./artifacts/economy-release/recovery-snapshot-private.json',import.meta.url),'utf8'));
 assert.equal(snapshot.project,'ojtqdfdqicozzqlgjtnm');
 const tables=['auth.users','public.profiles','public.user_roles','public.teams','public.team_members','public.events','public.event_sessions','public.event_groups','public.event_games','public.event_registrations','public.rating_event_settings','public.competition_publications','public.competition_team_facts','public.competition_player_facts','public.competition_game_forecasts','public.competition_award_entries','public.competition_ratings','public.organization_participation_history','public.player_stats','public.site_wallets','public.currency_ledger','public.economy_settings'];
 await db.exec("set session_replication_role='replica'");
 for(const table of tables){
  assert.ok(Array.isArray(snapshot.data[table]),`Missing table ${table}`);
  const [schema,name]=table.split('.');
  const columns=(await db.query("select column_name from information_schema.columns where table_schema=$1 and table_name=$2 and is_generated='NEVER' order by ordinal_position",[schema,name])).rows.map(r=>r.column_name);
  assert.ok(columns.length,`Missing local table ${table}`);
  const available=columns.filter(c=>snapshot.data[table].length===0||Object.hasOwn(snapshot.data[table][0],c));
  await db.exec(`delete from ${table}`);
  if(snapshot.data[table].length){
   const names=available.map(c=>'"'+c+'"').join(',');
   await db.query(`insert into ${table}(${names}) select ${names} from jsonb_populate_recordset(null::${table},$1::jsonb)`,[JSON.stringify(snapshot.data[table])]);
  }
 }
 await db.exec("set session_replication_role='origin'");
 const beforeWallet=(await db.query('select count(*) count,sum(balance) total from site_wallets')).rows;
 const originalRatings=new Map(snapshot.data['public.competition_ratings'].filter(r=>r.mode==='main'&&r.target_type==='player').map(r=>[r.target_id,Number(r.exact_rating)]));
 const start=performance.now();
 for(const p of snapshot.data['public.profiles'])await db.query('select recalculate_player_rating($1)',[p.id]);
 for(const t of snapshot.data['public.teams'])await db.query('select recalculate_organization_rating($1)',[t.id]);
 const recalcMs=Math.round(performance.now()-start);
 const current=(await db.query("select target_id,exact_rating from competition_ratings where target_type='player' and mode='main'")).rows;
 assert.equal(current.length,originalRatings.size,'No player gained/lost rating eligibility');
 for(const row of current)assert.ok(Math.abs(Number(row.exact_rating)-originalRatings.get(row.target_id))<.000001,'Player rating formula must remain unchanged');
 const queryStart=performance.now();
 const organizations=(await db.query("select id,name,main_rating,u2_cost_for_target('team',id) cost from teams order by main_rating desc")).rows;
 const priceMs=Math.round(performance.now()-queryStart);
 assert.ok(organizations.every(t=>Number.isInteger(Number(t.cost))&&Number(t.cost)>=0));
 assert.ok(organizations.every(t=>Number(t.main_rating)>=0&&Number(t.main_rating)<=999));
 assert.deepEqual((await db.query('select count(*) count,sum(balance) total from site_wallets')).rows,beforeWallet);
 const leaderboardStart=performance.now();
 const board=(await db.query("select u2_leaderboard('main','team','',50,0,'cost') result")).rows[0].result;
 assert.ok(board.items.length>0);
 const leaderboardMs=Math.round(performance.now()-leaderboardStart);
 const report={sourceCapturedAt:snapshot.captured_at,profiles:snapshot.data['public.profiles'].length,organizations:organizations.length,playerRatingsPreserved:current.length,recalcMs,priceMs,leaderboardMs,top:organizations.slice(0,3)};
 await writeFile(new URL('./artifacts/economy-release/production-data-rehearsal.json',import.meta.url),JSON.stringify(report,null,2));
 console.log(JSON.stringify({productionDataRehearsal:true,...report}));
}
