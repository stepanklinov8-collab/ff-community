import assert from 'node:assert/strict';
import test from 'node:test';
import {walletRequestSchema} from '../src/lib/economy/wallet-schema.ts';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const valid=operation=>walletRequestSchema.safeParse({requestId:id(1),operation}).success;
test('transfers name exactly one player or organization and an independent optional organization source',()=>{
 assert.equal(valid({action:'transfer',userId:id(2),amount:1}),true);
 assert.equal(valid({action:'transfer',recipientTeamId:id(2),amount:1}),true);
 assert.equal(valid({action:'transfer',teamId:id(3),recipientTeamId:id(2),amount:100}),true);
 assert.equal(valid({action:'transfer',teamId:id(3),userId:id(2),amount:100}),true);
 for(const op of[{action:'transfer',amount:1},{action:'transfer',userId:id(2),recipientTeamId:id(3),amount:1},
  {action:'transfer',recipientTeamId:id(2),amount:0.5},{action:'transfer',recipientTeamId:id(2),amount:-1},
  {action:'transfer',recipientTeamId:id(2),amount:1,sourceUserId:id(4)}])assert.equal(valid(op),false);
});
