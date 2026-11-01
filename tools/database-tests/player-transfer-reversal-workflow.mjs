import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {verifyPlayerTransferExecution} from './player-transfer-execution.mjs';

export async function verifyPlayerTransferReversalWorkflow(db,id){
 const fixture=n=>id(n+100000);await verifyPlayerTransferExecution(db,fixture);
 const admin=fixture(93000),player=fixture(93001),employer=fixture(93002),guildOwner=fixture(93003),deal=fixture(93030);
 const input=(action,extra={})=>({action,requestId:randomUUID(),dealId:deal,revision:1,...extra});
 let transactional=false;
 const mutate=async(actor,value)=>{
  if(transactional)await db.exec('savepoint mutation');
  try{const result=(await db.query('select player_transfer_mutate($1,$2::jsonb) value',[actor,JSON.stringify(value)])).rows[0].value;if(transactional)await db.exec('release savepoint mutation');return result;}
  catch(error){if(transactional)await db.exec('rollback to savepoint mutation;release savepoint mutation');throw error;}
 };
 const detail=async actor=>(await db.query('select player_transfer_query($1,$2::jsonb) value',[actor,JSON.stringify({dealId:deal})])).rows[0].value;
 await mutate(player,input('dispute',{reason:'Discuss a completed transfer'}));
 const review=input('reverse_review',{cause:'mutual',reason:'Mutual cancellation of the transfer'});
 await assert.rejects(()=>mutate(employer,review),/MARKET_ADMIN/);
 await db.exec('begin');transactional=true;
 try{
  let proposal=(await mutate(admin,review)).proposalId;
  const former=(await detail(admin)).reversal,home=(await detail(guildOwner)).reversal;
  assert.equal(former.proposal.mode,'fixed','the approved timing is selected by the trusted server');
  assert.equal(former.proposal.consents.find(r=>r.party==='previous').canSign,true);
  assert.equal(home.proposal.paid,null,'retained guild never gains new employment payment details');
  assert.equal((await detail(employer)).reversal.proposal.paid.signing,100);
  await assert.rejects(()=>mutate(employer,input('reverse_consent',{proposalId:proposal,party:'player'})),/MARKET_FINANCE/);
  await assert.rejects(()=>mutate(admin,input('reverse_complete',{proposalId:proposal,mode:'fixed'})),/CONTRACT_INPUT/);
  await assert.rejects(()=>mutate(admin,input('reverse_complete',{proposalId:proposal})),/MARKET_PLAYER_MUTUAL/);
  const first=input('reverse_consent',{proposalId:proposal,party:'player'});await mutate(player,first);await mutate(player,first);
  assert.equal((await db.query("select count(*)::int n from player_transfer_reverse_consents where deal_id=$1 and party='player'",[deal])).rows[0].n,1);
  const revised=(await mutate(admin,input('reverse_review',{cause:'mutual',reason:'Mutual cancellation with clarified decision'}))).proposalId;
  assert.notEqual(revised,proposal);
  await assert.rejects(()=>mutate(player,input('reverse_consent',{proposalId:proposal,party:'player'})),/MARKET_CONFLICT/);
  await assert.rejects(()=>mutate(admin,input('reverse_complete',{proposalId:proposal})),/MARKET_CONFLICT/);
  proposal=revised;
  for(const [actor,party] of [[player,'player'],[employer,'organization'],[employer,'buyer'],[admin,'previous']])await mutate(actor,input('reverse_consent',{proposalId:proposal,party}));
  assert.equal((await detail(admin)).reversal.proposal.canExecute,true);
  const complete=input('reverse_complete',{proposalId:proposal}),result=await mutate(admin,complete);
  assert.equal(result.status,'reversed');assert.deepEqual(await mutate(admin,complete),result);
  assert.equal((await detail(player)).reversal.proposal.consents.every(r=>!r.canSign),true);
  assert.equal((await detail(admin)).reversal.proposal.canExecute,false);
  await db.query("delete from user_roles where user_id=$1 and role='superadmin'",[admin]);
  await assert.rejects(()=>mutate(admin,complete),/MARKET_ADMIN/);
 }finally{transactional=false;await db.exec('rollback');}
 assert.equal((await db.query('select count(*)::int n from player_transfer_reversal_proposals where deal_id=$1',[deal])).rows[0].n,0);
 console.log('PASS: immutable reviewed reversal proposal, role-specific privacy, all mutual parties, decision revision invalidates signatures, strict public input, trusted fixed timing, atomic completion and replay/current-authority checks');
}
