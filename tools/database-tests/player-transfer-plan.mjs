import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {defaultTerms} from '../../src/modules/contracts/model.ts';
export async function verifyPlayerTransferPlan(db,id){
 const owner=id(90000),player=id(90001),guildOwner=id(90002),newOwner=id(90003),source=id(90010),destination=id(90011),guild=id(90012),main=id(90020),retained=id(90021);
 for(const user of [owner,player,guildOwner,newOwner]){await db.query('insert into auth.users(id) values($1)',[user]);await db.query('insert into profiles(id,nickname) values($1,$2)',[user,'Transfer plan '+user.slice(-4)]);}
 for(const [organization,type,leader] of [[source,'team',owner],[destination,'team',newOwner],[guild,'guild',guildOwner]])await db.query('insert into teams(id,name,type,leader_id,verified) values($1,$2,$3,$4,true)',[organization,'Transfer '+organization.slice(-4),type,leader]);
 await db.query("insert into team_members(team_id,user_id,role_in_team) values($1,$3,'main'),($2,$3,'main')",[source,guild,player]);
 const mainTerms=defaultTerms(new Date(Date.now()-86400000));mainTerms.transfer={kind:'percent',basisPoints:2000};mainTerms.transferRequiresConsent=false;
 const guildTerms=defaultTerms(new Date(Date.now()-86400000));guildTerms.guestPolicy='consent';guildTerms.guestCompensation={kind:'percent',basisPoints:5000};
 for(const [contract,organization,signer,terms] of [[main,source,owner,mainTerms],[retained,guild,guildOwner,guildTerms]]){
  await db.query("insert into organization_contracts(id,organization_id,player_id,kind,created_by) values($1,$2,$3,'main',$4)",[contract,organization,player,signer]);
  await db.query("insert into organization_contract_versions(contract_id,revision,terms,created_by,status,offered_at) values($1,1,$2::jsonb,$3,'offered',now()-interval '1 day')",[contract,JSON.stringify(terms),signer]);
  await db.query("insert into contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at) values($1,1,$2,$3,1,now()-interval '1 day',now()-interval '1 day')",[contract,signer,player]);
 }
 const quote=async(price=10000,overrides=[])=> (await db.query('select player_transfer_quote($1,$2,$3,$4::jsonb) value',[player,destination,price,JSON.stringify(overrides)])).rows[0].value;
 const original=(await db.query('select contract_id,revision,ended_at from contract_agreements where contract_id=any($1::uuid[]) order by contract_id',[[main,retained]])).rows;
 const value=await quote();assert.equal(value.organizationFees,2000);assert.equal(value.playerAmount,8000);assert.equal(value.oldOrganizationId,source);
 assert.equal(value.contracts.find(c=>c.contractId===main).requiresConsent,false,'the signed transfer clause can provide standing consent');
 assert.deepEqual({...value.contracts.find(c=>c.contractId===retained),termsHash:null},{contractId:retained,organizationId:guild,revision:1,ownershipRevision:1,relation:'retained',rawFee:0,fee:0,override:false,requiresConsent:true,termsHash:null},'the other-type contract survives, requires its permission and never takes an automatic second fee');
 assert.deepEqual((await db.query('select contract_id,revision,ended_at from contract_agreements where contract_id=any($1::uuid[]) order by contract_id',[[main,retained]])).rows,original,'planning never terminates either old agreement');
 const negotiated=await quote(10000,[{contractId:main,amount:40}]);assert.equal(negotiated.organizationFees,40);assert.equal(negotiated.playerAmount,9960);assert.equal(negotiated.contracts.find(c=>c.contractId===main).requiresConsent,true,'a proposed exception always requires explicit organization approval');
 for(const overrides of [[{contractId:retained,amount:1}],[{contractId:id(99999),amount:1}],[{contractId:main,amount:-1}],[{contractId:main,amount:1.5}],[{contractId:main,amount:1,payerId:player}],[{contractId:main,amount:1},{contractId:main,amount:2}]])await assert.rejects(()=>quote(10000,overrides));
 const expensive=structuredClone(mainTerms);expensive.transfer={kind:'fixed',amount:20000};
 await db.query("update contract_agreements set ended_at=clock_timestamp(),end_reason='test revision' where contract_id=$1 and revision=1",[main]);
 await db.query("insert into organization_contract_versions(contract_id,revision,terms,created_by,status,offered_at) values($1,2,$2::jsonb,$3,'offered',clock_timestamp())",[main,JSON.stringify(expensive),owner]);
 await db.query('insert into contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at) values($1,2,$2,$3,1,clock_timestamp(),clock_timestamp())',[main,owner,player]);
 const excess=await quote();assert.equal(excess.organizationFees,20000);assert.equal(excess.requiresFeeException,true);assert.equal(excess.playerAmount,0,'an excess never becomes a negative player payout or an automatic extra charge');
 const agreed=await quote(10000,[{contractId:main,amount:6000}]);assert.equal(agreed.organizationFees,6000);assert.equal(agreed.playerAmount,4000);assert.equal(agreed.requiresFeeException,false);
 assert.equal((await db.query('select terms from organization_contract_versions where contract_id=$1 and revision=2',[main])).rows[0].terms.transfer.amount,20000,'a deal exception does not rewrite the main contract');
 await db.query("update contract_agreements set ended_at=clock_timestamp(),end_reason='test ending' where contract_id=$1 and revision=2",[main]);await db.query('delete from team_members where team_id=$1 and user_id=$2',[source,player]);
 const free=await quote();assert.equal(free.oldOrganizationId,null);assert.equal(free.organizationFees,0);assert.equal(free.playerAmount,10000);assert.equal(free.contracts[0].contractId,retained);
 await db.query("insert into team_members(team_id,user_id,role_in_team) values($1,$2,'main')",[destination,player]);await assert.rejects(()=>quote(),/MARKET_PLAYER_ALREADY_MEMBER/);
 const guarded=id(90090);await db.query("insert into market_deals(id,kind,player_id,organization_id,buyer_user_id,created_by) values($1,'player',$2,$3,$4,$4)",[guarded,player,destination,newOwner]);
 await db.query("insert into market_versions(deal_id,revision,price,expires_at,asset_revision,seller_user_id,status,created_by,author_side) values($1,1,100,now()+interval '7 days',1,$2,'offered',$3,'buyer')",[guarded,player,newOwner]);
 await assert.rejects(()=>db.query('select market_mutate($1,$2::jsonb)',[newOwner,JSON.stringify({action:'complete',requestId:randomUUID(),dealId:guarded,revision:1})]),/MARKET_PLAYER_FLOW/,'organization-sale endpoints must never transfer ownership of a player destination');
 assert.equal((await db.query('select owner_user_id from teams where id=$1',[destination])).rows[0].owner_user_id,newOwner);
 await db.exec('set role authenticated');try{await assert.rejects(()=>quote(),/permission denied/);}finally{await db.exec('reset role');}
 console.log('PASS: private player transfer quote, exact main-organization split, retained guild restriction with zero second fee, negotiated exceptions, overflow hold, free-agent scope and unchanged old contracts during preparation');
}
