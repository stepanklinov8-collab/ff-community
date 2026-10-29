import test from 'node:test';
import assert from 'node:assert/strict';
import {noShowPenaltySchema,previewNoShowPenalty,describeNoShowPenalty} from '../src/modules/contracts/no-show-penalty.ts';
import {defaultTerms,contractTermsSchema} from '../src/modules/contracts/model.ts';

const facts={registered:true,playedGames:0,confirmed:true,cancelled:false,playerValue:2501};
test('no-show fine requires an explicit clause and confirmed registered complete absence',()=>{
 const rule={kind:'fixed',amount:350};
 assert.equal(previewNoShowPenalty(rule,facts).amount,350);
 for(const change of [{registered:false},{playedGames:1},{confirmed:false},{cancelled:true},{technicalAbsence:true}])
  assert.deepEqual(previewNoShowPenalty(rule,{...facts,...change}),{applies:false,amount:0});
 assert.deepEqual(previewNoShowPenalty({kind:'none'},facts),{applies:false,amount:0});
});
test('fixed/percentage combinations choose one result and floor the percentage exactly',()=>{
 assert.equal(previewNoShowPenalty({kind:'percent',basisPoints:1000},facts).amount,250);
 const rule={kind:'combined',amount:350,basisPoints:1000,selection:'maximum'};
 assert.equal(previewNoShowPenalty(rule,facts).amount,350);
 assert.equal(previewNoShowPenalty({...rule,selection:'minimum'},facts).amount,250);
 assert.equal(previewNoShowPenalty({kind:'percent',basisPoints:3333},{...facts,playerValue:999999999999}).amount,333299999999);
 assert.match(describeNoShowPenalty(rule),/не складываются/);
 assert.match(describeNoShowPenalty(rule),/Владелец/);
 assert.match(describeNoShowPenalty(rule),/на начало сессии/);
});
test('old immutable terms have no invented penalty; new constructor clause round-trips',()=>{
 const old=defaultTerms();delete old.financial.noShowPenalty;
 assert.equal(contractTermsSchema.parse(old).financial.noShowPenalty,undefined);
 const next=structuredClone(old);next.financial.noShowPenalty={kind:'combined',amount:500,basisPoints:200,selection:'minimum'};
 assert.deepEqual(contractTermsSchema.parse(next).financial.noShowPenalty,next.financial.noShowPenalty);
 assert.equal(noShowPenaltySchema.safeParse({kind:'combined',amount:100,basisPoints:100}).success,false);
 for(const invalid of [{kind:'fixed',amount:-1},{kind:'fixed',amount:1.5},{kind:'percent',basisPoints:10001},{kind:'none',text:'fine every day'},{kind:'percent',basisPoints:100,base:'contract_debt'}])
  assert.equal(noShowPenaltySchema.safeParse(invalid).success,false);
});
