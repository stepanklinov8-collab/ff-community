import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {defaultTerms} from '../../src/modules/contracts/model.ts';
export async function verifyPlayerTransferContractGate(db,id){
 const owner=id(91000),player=id(91001),employer=id(91002),oldOrg=id(91010),newOrg=id(91011),oldContract=id(91020),deal=id(91030),newContract=id(91031);
 for(const user of [owner,player,employer]){await db.query('insert into auth.users(id) values($1)',[user]);await db.query('insert into profiles(id,nickname) values($1,$2)',[user,'Contract gate '+user.slice(-4)]);}
 await db.query("insert into user_roles(user_id,role) values($1,'superadmin')",[owner]);
 for(const [organization,leader] of [[oldOrg,owner],[newOrg,employer]])await db.query("insert into teams(id,name,type,leader_id,verified) values($1,$2,'team',$3,true)",[organization,'Contract gate '+organization.slice(-4),leader]);
 await db.query("insert into team_members(team_id,user_id,role_in_team) values($1,$2,'main')",[oldOrg,player]);
 const oldTerms=defaultTerms(new Date(Date.now()-86400000));oldTerms.transferRequiresConsent=false;
 await db.query("insert into organization_contracts(id,organization_id,player_id,kind,created_by) values($1,$2,$3,'main',$4)",[oldContract,oldOrg,player,owner]);
 await db.query("insert into organization_contract_versions(contract_id,revision,terms,created_by,status,offered_at) values($1,1,$2::jsonb,$3,'offered',now()-interval '1 day')",[oldContract,JSON.stringify(oldTerms),owner]);
 await db.query("insert into contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at) values($1,1,$2,$3,1,now()-interval '1 day',now()-interval '1 day')",[oldContract,owner,player]);
 const terms=defaultTerms();terms.financial.signingAmount=100;terms.financial.salary={amount:50,periodDays:7};
 const quote=(await db.query('select player_transfer_quote($1,$2,300) value',[player,newOrg])).rows[0].value;
 await db.query("insert into market_deals(id,kind,player_id,organization_id,buyer_organization_id,created_by) values($1,'player',$2,$3,$3,$4)",[deal,player,newOrg,employer]);
 await db.query("insert into market_versions(deal_id,revision,price,expires_at,asset_revision,buyer_revision,seller_user_id,status,created_by,author_side,transfer_plan,new_terms,new_contract_id) values($1,1,300,now()+interval '7 days',1,1,$2,'offered',$3,'buyer',$4::jsonb,$5::jsonb,$6)",[deal,player,employer,JSON.stringify(quote),JSON.stringify(terms),newContract]);
 await db.query("insert into market_consents(deal_id,revision,party,signed_by) values($1,1,'seller',$2)",[deal,player]);
 const wallet=async(kind,ownerId,amount)=>db.query('select u6_coin_action($1,$2,$3,$4::jsonb)',[owner,randomUUID(),'adjust',JSON.stringify({kind,ownerId,amount,reason:'Receiving organization start reserve test'})]);
 await wallet('player',employer,1000);await wallet('organization',newOrg,149);
 const prepare=()=>db.query('select player_transfer_prepare_contract($1,$2,1)',[employer,deal]);
 await assert.rejects(prepare,/MARKET_FUNDS/);assert.equal((await db.query('select count(*)::int n from organization_contracts where id=$1',[newContract])).rows[0].n,0);
 await wallet('organization',newOrg,1);await prepare();
 assert.equal((await db.query('select count(*)::int n from contract_agreements where contract_id=$1',[newContract])).rows[0].n,0,'the organization offer is not the player signature or an active replacement');
 assert.equal((await db.query('select ended_at from contract_agreements where contract_id=$1',[oldContract])).rows[0].ended_at,null,'the old contract remains fully active throughout preparation');
 assert.deepEqual((await db.query('select balance::int,reserved::int from coin_accounts where team_id=$1',[newOrg])).rows[0],{balance:150,reserved:150});
 assert.equal((await db.query('select balance::int from coin_accounts where user_id=$1',[employer])).rows[0].balance,1000,'rich employer personal funds are never the contract source');
 assert.equal((await db.query('select team_id from team_members where user_id=$1',[player])).rows[0].team_id,oldOrg);
 const query=(await db.query('select contract_query($1,$2::jsonb) value',[player,JSON.stringify({contractId:newContract})])).rows[0].value;
 assert.equal(query.contracts[0].transferDealId,deal);assert.equal(query.contracts[0].transferPending,true);assert.equal(query.contracts[0].canEdit,false);
 await assert.rejects(()=>db.query('select contract_mutate($1,$2::jsonb)',[player,JSON.stringify({action:'accept',requestId:randomUUID(),contractId:newContract,revision:1})]),/CONTRACT_TRANSFER_REQUIRED/,'regular signing must never bypass the price and old-contract cutover');
 await assert.rejects(()=>db.query('select contract_mutate($1,$2::jsonb)',[employer,JSON.stringify({action:'cancel',requestId:randomUUID(),contractId:newContract,revision:1})]),/CONTRACT_TRANSFER_REQUIRED/);
 // Price, contract startup and an unrelated obligation can share one source.
 // Cancelling the unsigned deal must release exactly its two own holds.
 await wallet('organization',newOrg,340);
 const source=(await db.query("select u6_coin_account('organization',$1) id",[newOrg])).rows[0].id;
 const reserveOperation=randomUUID();
 await db.query("insert into coin_operations(id,actor_id,action,input,description) values($1,$2,'test_transfer_holds','{}','Transfer price and unrelated protected reserve')",[reserveOperation,owner]);
 await db.query('select u6_coin_entry($1,$2,0,340)',[reserveOperation,source]);
 await db.query('insert into market_escrows(deal_id,revision,account_id,amount,held) values($1,1,$2,300,300)',[deal,source]);
 await db.query('select market_release($1,1,$2)',[deal,player]);await db.query('select market_release($1,1,$2)',[deal,player]);
 assert.deepEqual((await db.query('select balance::int,reserved::int from coin_accounts where team_id=$1',[newOrg])).rows[0],{balance:490,reserved:40});
 assert.equal((await db.query('select held::int from market_escrows where deal_id=$1',[deal])).rows[0].held,0);
 assert.equal((await db.query('select held::int from player_transfer_startup_escrows where deal_id=$1',[deal])).rows[0].held,0);
 for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query("select has_function_privilege($1,'public.player_transfer_prepare_contract(uuid,uuid,integer)','execute') allowed",[role])).rows[0].allowed,false,'private preparation cannot be called through a public RPC');
 assert.equal((await db.query('select status from organization_contract_versions where contract_id=$1',[newContract])).rows[0].status,'cancelled');
 assert.equal((await db.query('select ended_at from contract_agreements where contract_id=$1',[oldContract])).rows[0].ended_at,null,'expiry/withdrawal releases only the unsigned new proposal, never the old agreement');
 // A completed transfer reversal restores membership, not the ended agreement.
 // Exercise the existing database guard independently of the unfinished deal
 // controller: changing the roster must never reopen a signed historical row.
 await db.query("update contract_agreements set ended_at=clock_timestamp(),end_reason='player_transfer' where contract_id=$1",[oldContract]);
 const ended=(await db.query('select ended_at from contract_agreements where contract_id=$1',[oldContract])).rows[0].ended_at;
 await db.query('delete from team_members where team_id=$1 and user_id=$2',[oldOrg,player]);
 await db.query("insert into team_members(team_id,user_id,role_in_team) values($1,$2,'main')",[oldOrg,player]);
 assert.equal((await db.query('select contract_has_active_membership($1,$2) active',[oldOrg,player])).rows[0].active,false,'returning to the roster alone does not restore the ended contract');
 await assert.rejects(()=>db.query('update contract_agreements set ended_at=null,end_reason=null where contract_id=$1',[oldContract]),/CONTRACT_IMMUTABLE/);
 await assert.rejects(()=>db.query("update contract_agreements set ended_at=clock_timestamp()+interval '1 day' where contract_id=$1",[oldContract]),/CONTRACT_IMMUTABLE/);
 assert.deepEqual((await db.query('select ended_at from contract_agreements where contract_id=$1',[oldContract])).rows[0].ended_at,ended,'an attempted reversal cannot restart the old salary or extend the old term');
 console.log('PASS: receiving-organization-only startup reserve, atomic insufficient-funds rollback, actual employer offer without player signature, preserved old agreement/roster, normal API signing bypass blocked and repeat-safe unsigned proposal release');
 console.log('PASS: restored roster leaves the old agreement ended; reopening or extending that signed revision is rejected');
}
