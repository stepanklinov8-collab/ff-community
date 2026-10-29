import assert from 'node:assert/strict';
import {splitContractPrize} from '../../src/modules/contracts/calculations.ts';

export async function verifyContractPrizeAllocation(db,id){
 const allocate=async(prize,games,rows)=>(await db.query('select contract_prize_allocation($1,$2,$3::jsonb) value',[prize,games,JSON.stringify(rows)])).rows[0].value;
 const recipient=n=>({playerId:id(9800+n),shareBps:2000,playedGames:3,participation:{mode:'any'},guestObligations:[]});
 const scenarios=[
  [250,3,[1,2,3,4].map(recipient)],
  [250,3,[]],
  [250,3,[{...recipient(1),playedGames:0}]],
  [250,3,[{...recipient(1),playedGames:1,participation:{mode:'proportional'},guestObligations:[
   {organizationId:id(9851),compensation:{kind:'percent',basisPoints:2000}},
   {organizationId:id(9852),compensation:{kind:'percent',basisPoints:1000}},
   {organizationId:id(9853),compensation:{kind:'fixed',amount:1000}},
  ]}]],
  [101,3,[{...recipient(1),shareBps:3333,playedGames:1},{...recipient(2),shareBps:6667,playedGames:1}]],
  [250,3,[{...recipient(1),playedGames:1,participation:{mode:'minimum',games:2}}]],
  [250,3,[{...recipient(1),playedGames:2,participation:{mode:'minimum',games:2}}]],
  [0,3,[recipient(1)]],
  [1000000000000,1000000,[{...recipient(1),shareBps:9999,playedGames:999999,participation:{mode:'proportional'}}]],
 ];
 for(const [prize,games,rows] of scenarios){
  const result=await allocate(prize,games,rows);
  assert.deepEqual(result,splitContractPrize(prize,games,rows),'database and displayed preview must agree exactly');
  assert.equal(result.organizationAmount+result.payouts.reduce((sum,p)=>sum+p.net+p.toOrganizations.reduce((n,o)=>n+o.amount,0),0),prize,'every coin is accounted for');
 }
 await assert.rejects(()=>allocate(1,3,[{...recipient(1),shareBps:10000},{...recipient(2),shareBps:1}]),/CONTRACT_TOTAL_SHARE/);
 await assert.rejects(()=>allocate(100,3,[{...recipient(1),guestObligations:[{organizationId:id(9851),compensation:{kind:'percent',basisPoints:6000}},{organizationId:id(9852),compensation:{kind:'percent',basisPoints:5000}}]}]),/CONTRACT_GUEST_TOTAL_SHARE/);
 await assert.rejects(()=>allocate(250,3,[recipient(1),recipient(1)]),/CONTRACT_ALLOCATION_DUPLICATE/);
 await assert.rejects(()=>allocate(250,3,[{...recipient(1),playedGames:null}]),/CONTRACT_ALLOCATION_INPUT/);
 await assert.rejects(()=>allocate(250,3,[{...recipient(1),playedGames:4}]),/CONTRACT_ALLOCATION_INPUT/);
 await assert.rejects(()=>allocate(250,0,[]),/CONTRACT_ALLOCATION_INPUT/);
 for(const role of ['authenticated','service_role']){
  await db.exec(`set role ${role}`);
  try{await assert.rejects(()=>allocate(250,3,[recipient(1)]),/permission denied/);}finally{await db.exec('reset role');}
 }
 console.log('PASS: exact server contract prize allocation, participation thresholds, all guest obligations, no rounding oversubscription, coin conservation and internal-only access');
}
