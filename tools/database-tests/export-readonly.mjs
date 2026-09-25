// Read-only preflight: GET requests only, never execute migrations against the server.
// Credentials remain in memory. Export only the fields needed for migration checks.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const [envPath,outputDirectory]=process.argv.slice(2);
if(!envPath||!outputDirectory)throw new Error('Usage: node export-readonly.mjs <existing env file> <local output directory>');
const env=Object.fromEntries((await readFile(envPath,'utf8')).split(/\r?\n/).flatMap(line=>{
 const m=line.match(/^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);if(!m)return [];
 let value=m[2].trim();if(value.startsWith('"')&&value.endsWith('"')||value.startsWith("'")&&value.endsWith("'"))value=value.slice(1,-1);
 return [[m[1],value]];
}));
const endpoint=new URL(env.NEXT_PUBLIC_SUPABASE_URL),key=env.SUPABASE_SERVICE_ROLE_KEY;
if(endpoint.protocol!=='https:'||!endpoint.hostname.endsWith('.supabase.co')||!key)throw new Error('Expected the project Supabase HTTPS endpoint and service credential');
const headers={apikey:key,Authorization:`Bearer ${key}`};
const root=resolve(outputDirectory);await mkdir(root,{recursive:true});
const metaResponse=await fetch(new URL('/rest/v1/',endpoint),{method:'GET',headers:{...headers,Accept:'application/openapi+json'},signal:AbortSignal.timeout(30000)});
if(!metaResponse.ok)throw new Error(`Read-only schema request failed: HTTP ${metaResponse.status}`);
const schema=await metaResponse.json();await writeFile(resolve(root,'rest-schema.json'),JSON.stringify(schema,null,2));
const selections={
 profiles:'id nickname game_id main_rating reputation_score reputation_base legacy_game_rating reputation_events_count created_at',
 teams:'id name type verified dissolved_at main_rating results_score achievements_score reputation_score reputation_base created_at',
 team_members:'team_id user_id role_in_team position joined_at',user_roles:'user_id role',
 events:'id title type organizer_user_id organizer max_teams min_players cost roster_lock_minutes publish_at is_published comments_enabled allow_individual_registration created_by created_at updated_at public_number competition_rules moderation_status cancelled_at frozen_at',
 event_sessions:'id event_id start_time end_time registration_open_time registration_close_time max_teams responsible_user_id status reminder_minutes created_at updated_at public_number',
 event_games:'id event_id session_id game_number map_name status created_at updated_at group_id public_number replayed',
 event_registrations:'id event_id session_id team_id participant_user_id roster_json roster status created_at cancelled_at cancelled_by cancellation_reason team_name_override roster_snapshot name_snapshot group_id',
 event_game_results:'id event_id session_id game_id team_id team_name_snapshot roster_snapshot kills place points status created_by confirmed_at created_at updated_at',
 event_team_results:'id event_id session_id team_id score is_winner mvp_user_id total_kills total_points final_place status created_at updated_at',
 player_stats:'id user_id event_id session_id event_title kills matches_played status created_at updated_at',
 organization_participation_history:'id organization_id organization_name organization_type mode event_id session_id clan_war_id event_title occurred_at roster_snapshot place kills points result_status recorded_by created_at updated_at',
 rating_event_settings:'event_id hidden_coefficient category changed_by updated_at',
 round_match_results:'id team_a_id team_b_id team_a_name_snapshot team_b_name_snapshot team_a_score team_b_score team_a_kills team_b_kills status confirmed_at mode event_id clan_war_id organization_id opponent_organization_id rounds_won rounds_lost kills is_winner played_at created_at updated_at',
 clan_wars:'id game_count wins_required maps creator_team_id opponent_team_id created_by title format status scheduled_at completed_at cancelled_at created_at updated_at is_hidden creator_score opponent_score creator_kills opponent_kills',
 clan_war_rosters:'id clan_war_id team_id player_ids submitted_by created_at updated_at roster_snapshot name_snapshot',
 warnings:'id target_type target_id level penalty event_id session_id clan_war_id source category created_by created_at activated_at expires_at cancelled_at used_in_sanction update2',
 bans:'id target_type target_id is_active created_by created_at',
 betting_markets:'id event_id game_id clan_war_id subject_team_id subject_user_id mode market_type selection_value line odds status outcome locks_at settled_at created_at',
 site_bets:'id user_id market_id stake odds potential_payout payout status placed_at settled_at',site_wallets:'user_id balance',
};
const tables={},missing=[];
for(const [table,fields] of Object.entries(selections)){
 const properties=schema.definitions?.[table]?.properties;if(!properties){missing.push(table);continue;}
 const columns=fields.split(' ').filter(name=>Object.hasOwn(properties,name));
 const rows=[];
 for(let offset=0;;offset+=500){
  const url=new URL(`/rest/v1/${table}`,endpoint);url.searchParams.set('select',columns.join(','));url.searchParams.set('limit','500');url.searchParams.set('offset',String(offset));
  const order=columns.includes('id')?'id':columns.includes('user_id')?(columns.includes('team_id')?'team_id,user_id':'user_id'):columns[0];url.searchParams.set('order',order);
  const response=await fetch(url,{method:'GET',headers,signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`Read-only export of ${table} failed: HTTP ${response.status}`);
  const page=await response.json();if(!Array.isArray(page))throw new Error(`Invalid rows in ${table}`);
  rows.push(...page);if(page.length<500)break;
 }
 tables[table]=rows;console.log(`${table}: ${rows.length} rows`);
}
const snapshot={capturedAt:new Date().toISOString(),source:'Existing project database, GET-only field allowlist',schemaFile:'rest-schema.json',tables,missingTables:missing};
await writeFile(resolve(root,'snapshot.json'),JSON.stringify(snapshot,null,2));
console.log(`Export complete: ${Object.keys(tables).length} tables; ${missing.length} unavailable tables. No remote mutations.`);
