import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {assertTestDatabaseTarget,stagingProject} from '../../src/platform/environment.ts';

const project=stagingProject;
assertTestDatabaseTarget(`https://${project}.supabase.co`);
const token=(await readFile('C:/Users/Lenovo/.supabase/access-token','utf8')).trim();
const artifactDir=new URL('./artifacts/contracts/',import.meta.url);
await mkdir(artifactDir,{recursive:true});
async function query(sql,readOnly=false){
 const response=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query${readOnly?'/read-only':''}`,{
  method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
  body:JSON.stringify({query:sql}),signal:AbortSignal.timeout(60000),
 });
 if(!response.ok)throw new Error(`Staging database request failed: HTTP ${response.status}`);
 return response.json();
}
const inspectionSql=`select
 to_regprocedure('public.organization_owner_set_leader(uuid,uuid,boolean)') is not null as ownership_ready,
 exists(select 1 from information_schema.columns where table_schema='public' and table_name='teams' and column_name='ultimate_owner_user_id') as hierarchy_ready,
 to_regclass('public.organization_contracts') is not null as proposals_ready,
 to_regprocedure('public.contract_history(uuid,uuid,integer)') is not null as history_ready,
 to_regprocedure('public.contract_prize_allocation(bigint,integer,jsonb)') is not null as allocation_ready,
 to_regprocedure('public.contract_validate_overdue_compensation(jsonb)') is not null as constructor_ready,
 to_regprocedure('public.contract_obligation_query(uuid,uuid,integer)') is not null as obligations_ready,
 to_regprocedure('public.contract_salary_process(uuid)') is not null as payroll_ready,
 to_regprocedure('public.contract_financial_start(uuid,integer,timestamptz)') is not null as funding_ready,
 to_regprocedure('public.contract_session_freeze(uuid)') is not null as session_terms_ready,
 to_regprocedure('public.contract_session_accrual_plan(uuid,uuid)') is not null as session_accrual_ready,
 to_regprocedure('public.contract_session_no_show_assessment(uuid,uuid,bigint)') is not null as no_show_ready,
 to_regprocedure('public.contract_obligation_cancel(uuid,uuid,uuid,text)') is not null as returns_ready,
 to_regprocedure('public.contract_session_settle(uuid,uuid)') is not null as settlement_ready,
 to_regprocedure('public.contract_signature_guard()') is not null
   and to_regprocedure('public.contract_mutate(uuid,jsonb)') is not null
   and to_regclass('public.contract_signatures') is not null as acceptance_ready,
 to_regprocedure('public.contract_maintenance_run()') is not null
   and to_regprocedure('public.contract_session_publish_settle(uuid)') is not null as runtime_ready,
 to_regprocedure('public.contract_freeze_before_roster_change()') is not null as freeze_guards_ready,
 to_regclass('public.contract_session_valuations') is not null
   and to_regprocedure('public.contract_no_show_cancel(uuid,uuid,uuid,text)') is not null as no_show_settlement_ready,
 coalesce(position('hasSignedHistory' in pg_get_functiondef(to_regprocedure('public.contract_query(uuid,jsonb)')))>0,false) as renewal_controls_ready,
 to_regprocedure('public.contract_limit_progress(uuid,integer)') is not null as limit_constructor_ready,
 to_regclass('public.contract_limit_closures') is not null
   and to_regprocedure('public.contract_limit_finalize(uuid,integer)') is not null as limit_execution_ready,
 to_regprocedure('public.contract_tournament_completion(uuid)') is not null as tournament_completion_ready,
 to_regclass('public.contract_tournament_terms') is not null
   and to_regprocedure('public.contract_tournament_settle(uuid,uuid)') is not null as tournament_payments_ready,
 to_regprocedure('public.organization_wallet_withdrawals(uuid)') is not null as organization_transfers_ready,
 to_regprocedure('public.contract_limit_session_progress(uuid,integer)') is not null as tournament_limits_ready,
 to_regprocedure('public.contract_session_prize_settle(uuid)') is not null as prize_shares_ready,
 to_regprocedure('public.contract_terminate(uuid,uuid,uuid,integer,text,bigint,text)') is not null as termination_ready,
 to_regprocedure('public.contract_guest_can_play(uuid,uuid,uuid)') is not null as guest_lifecycle_ready,
 to_regprocedure('public.contract_guest_settle(uuid,integer)') is not null as guest_payments_ready,
 to_regclass('public.personal_award_funds') is not null
   and to_regprocedure('public.personal_award_distribution(uuid,text,text)') is not null as personal_award_funds_ready,
 to_regprocedure('public.personal_award_settle(uuid,boolean)') is not null as personal_award_settlement_ready,
 to_regprocedure('public.podium_fund_action(uuid,uuid,uuid,text,text)') is not null as prize_fund_closure_ready,
 to_regprocedure('public.contract_rental_options(uuid,uuid,uuid,uuid,uuid)') is not null as rental_conditions_ready,
 to_regprocedure('public.contract_rental_settle(uuid,integer)') is not null as rental_payments_ready,
 to_regprocedure('public.contract_ordinary_rule(jsonb)') is not null as combined_compensation_ready,
 to_regclass('public.contract_ranking_history') is not null as ranking_history_ready,
 to_regprocedure('public.contract_ranking_settle(uuid,uuid)') is not null as ranking_payments_ready,
 (select count(*)::int from teams) organizations,
 (select count(*)::int from team_members) members,
 (select coalesce(sum(balance),0)::text from coin_accounts) balances,
 (select coalesce(sum(reserved),0)::text from coin_accounts) reserved,
 (select md5(coalesce(string_agg(id::text||':'||coalesce(leader_id::text,''),',' order by id),'')) from teams) leaders_hash`;
const before=(await query(inspectionSql,true))[0];
if(!before?.ownership_ready)throw new Error('Apply the preceding ownership migration before this update');
console.log(JSON.stringify({project,before}));
if(!process.argv.includes('--apply'))process.exit(0);
const migrations=[
 ['hierarchy_ready','202610290006_organization_hierarchy.sql'],
 ['proposals_ready','202610290007_contract_proposals.sql'],
 ['history_ready','202610290008_contract_history_validation.sql'],
 ['allocation_ready','202610290009_contract_prize_allocation.sql'],
 ['constructor_ready','202610290010_contract_constructor.sql'],
 ['obligations_ready','202610290011_contract_obligations.sql'],
 ['payroll_ready','202610290012_contract_salary_schedule.sql'],
 ['funding_ready','202610290013_contract_financial_start.sql'],
 ['session_terms_ready','202610290014_contract_session_terms.sql'],
 ['session_accrual_ready','202610290015_contract_session_accrual.sql'],
 ['no_show_ready','202610290016_contract_no_show_clause.sql'],
 ['returns_ready','202610290017_contract_payment_returns.sql'],
 ['settlement_ready','202610290018_contract_session_settlement.sql'],
 ['acceptance_ready','202610290019_contract_acceptance.sql'],
 ['runtime_ready','202610290020_contract_runtime_hooks.sql'],
 ['freeze_guards_ready','202610290021_contract_freeze_guards.sql'],
 ['no_show_settlement_ready','202610300001_contract_no_show_settlement.sql'],
 ['renewal_controls_ready','202610300002_contract_renewal_controls.sql'],
 ['limit_constructor_ready','202610300003_contract_limit_constructor.sql'],
 ['limit_execution_ready','202610300004_contract_limit_execution.sql'],
 ['tournament_completion_ready','202610300005_contract_tournament_completion.sql'],
 ['tournament_payments_ready','202610300006_contract_tournament_payments.sql'],
 ['organization_transfers_ready','202610300007_organization_wallet_transfers.sql'],
 ['tournament_limits_ready','202610300008_contract_tournament_limits.sql'],
 ['prize_shares_ready','202610300009_contract_prize_settlement.sql'],
 ['termination_ready','202610300010_contract_termination.sql'],
 ['guest_lifecycle_ready','202610300011_contract_guest_lifecycle.sql'],
 ['guest_payments_ready','202610300012_contract_guest_payments.sql'],
 ['personal_award_funds_ready','202610300013_personal_award_funds.sql'],
 ['personal_award_settlement_ready','202610300014_personal_award_settlement.sql'],
 ['prize_fund_closure_ready','202610300015_prize_fund_closure.sql'],
 ['rental_conditions_ready','202610300016_rental_conditions.sql'],
 ['rental_payments_ready','202610300017_rental_payments.sql'],
 ['combined_compensation_ready','202610300018_contract_combined_compensation.sql'],
 ['ranking_history_ready','202610310001_contract_ranking_history.sql'],
 ['ranking_payments_ready','202610310002_contract_ranking_payments.sql'],
];
const throughArg=process.argv.find(value=>value.startsWith('--through='))?.slice('--through='.length);
if(throughArg&&!migrations.some(([,name])=>name===throughArg))throw new Error('Unknown staging migration checkpoint');
const selectedMigrations=throughArg?migrations.filter(([,name])=>name<=throughArg):migrations;
const names=selectedMigrations.filter(([ready])=>!before[ready]).map(([,name])=>name);
if(!names.length){console.log('The staging schema is already installed');process.exit(0);}
const sources=await Promise.all(names.map(async name=>({name,sql:await readFile(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8')})));
const body=sources.map(({sql})=>sql.replace(/^begin;\s*$/mi,'').replace(/^commit;\s*$/mi,'')).join('\n');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backupFunctions=[
 'is_organization_owner','set_initial_organization_owner','prevent_direct_organization_owner_change','can_manage_organization_contracts',
 'organization_owner_set_leader','organization_owner_set_contract_access','u6_coin_action','contract_query','contract_mutate','contract_validate_terms','contract_history',
 'contract_obligation_create','contract_obligation_pay','contract_obligation_identity_guard','contract_obligation_query','contract_obligation_cancel_internal',
 'contract_has_debt','contract_signature_guard','contract_maintenance_run','contract_session_publish_settle','contract_freeze_before_roster_change',
 'contract_session_freeze','contract_session_freeze_at','contract_freeze_due_values','contract_session_no_show_assessment',
 'contract_player_has_debt','contract_recover_player_claims','contract_player_debt_summary','contract_session_accrual_plan','contract_session_settle',
 'contract_session_fine_settle','contract_limit_progress','organization_can_spend','organization_wallet_withdrawals','contract_tournament_completion',
 'contract_tournament_accrual_plan','contract_tournament_settle_all','contract_limit_finalize',
 'u6_settle_session_prizes','contract_session_settle_before_tournament','contract_obligation_create',
 'register_team_for_session','update_team_registration_roster','u2_registration_action','u5_reserve_eligible','u2_registration_guard',
 'contract_terminate','contract_obligation_cancel_internal','contract_obligation_query','contract_tournament_freeze',
];
const signatures=await query(`select oid::regprocedure::text signature,pg_get_functiondef(oid) definition from pg_proc where pronamespace='public'::regnamespace and proname=any(array[${backupFunctions.map(name=>"'"+name+"'").join(',')}])`,true);
await writeFile(new URL(`before-functions-${stamp}.json`,artifactDir),JSON.stringify(signatures,null,2));
await query(`begin;set local lock_timeout='5s';set local statement_timeout='45s';${body}\nrollback;`);
const rollback=(await query(inspectionSql,true))[0];
if(JSON.stringify(rollback)!==JSON.stringify(before))throw new Error('Staging dry-run rollback changed the observed state');
await query(`begin;set local lock_timeout='5s';set local statement_timeout='45s';${body}\ncommit;`);
await query("notify pgrst, 'reload schema';");
const after=(await query(inspectionSql,true))[0];
if(selectedMigrations.some(([ready])=>!after[ready]))throw new Error('Staging schema verification failed');
for(const key of ['organizations','members','balances','reserved','leaders_hash'])if(after[key]!==before[key])throw new Error(`Unexpected change to ${key}`);
const owners=(await query('select count(*)::int n from teams where owner_team_id is null and ultimate_owner_user_id is distinct from owner_user_id',true))[0];
if(owners.n!==0)throw new Error('Unexpected ultimate ownership backfill');
await writeFile(new URL(`staging-applied-${stamp}.json`,artifactDir),JSON.stringify({project,appliedAt:new Date().toISOString(),migrations:sources.map(({name,sql})=>({name,sha256:createHash('sha256').update(sql).digest('hex')})),before,after,rollbackVerified:true},null,2));
console.log(JSON.stringify({project,applied:names,rollbackVerified:true,after,productionChanged:false}));
