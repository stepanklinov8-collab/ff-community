import test from 'node:test';
import assert from 'node:assert/strict';
import {rentalCompensationAmount,rentalCompensationSchema,describeRentalCompensation} from '../src/modules/contracts/rental-terms.ts';
import {defaultTerms,defaultRentalTerms,contractTermsSchema,querySchema} from '../src/modules/contracts/model.ts';
const org='00000000-0000-4000-8000-000000000123';
test('rental prizes belong to the host by default; explicit player clauses remain possible',()=>{
 const rental=defaultRentalTerms();assert.equal(rental.trainingShareBps,0);assert.equal(rental.tournamentShareBps,0);assert.equal(rental.personalShareBps,0);
 assert.equal(defaultTerms().personalShareBps,10000);rental.personalShareBps=5000;assert.equal(contractTermsSchema.parse(rental).personalShareBps,5000);
});
test('both rental percentage bases are exact, independent and rounded down once',()=>{
 assert.equal(rentalCompensationAmount({kind:'percent',basis:'organization_prizes',basisPoints:2000},270n,110n),54n);
 assert.equal(rentalCompensationAmount({kind:'percent',basis:'player_payments',basisPoints:2000},270n,110n),22n);
 assert.equal(rentalCompensationAmount({kind:'percent',basis:'player_payments',basisPoints:1255},0n,300n),37n);
 assert.equal(rentalCompensationAmount({kind:'percent',basis:'organization_prizes',basisPoints:10000},2000000000000n,0n),2000000000000n);
});
test('rental combined min/max selects rather than adds; empty bases and zero clauses are valid',()=>{
 const rule={kind:'combined',amount:40,basis:'player_payments',basisPoints:2000,selection:'maximum'};
 assert.equal(rentalCompensationAmount(rule,999n,100n),40n);assert.equal(rentalCompensationAmount(rule,0n,300n),60n);
 assert.equal(rentalCompensationAmount({...rule,selection:'minimum'},0n,100n),20n);
 assert.equal(rentalCompensationAmount({...rule,selection:'minimum'},0n,0n),0n);
 assert.equal(rentalCompensationAmount({kind:'none'},5n,10n),0n);
});
test('unknown bases, caller-selected payer, fractional coins, duplicate organizations and unrelated query fields are rejected',()=>{
 for(const rule of [{kind:'percent',basisPoints:2000},{kind:'percent',basis:'all_wallet_income',basisPoints:20},{kind:'fixed',amount:.5},{kind:'fixed',amount:40,payer:'player'},{kind:'combined',amount:40,basis:'player_payments',basisPoints:20,selection:'sum'}])assert.equal(rentalCompensationSchema.safeParse(rule).success,false);
 const terms=defaultRentalTerms();terms.financial.rentalCompensations=[{organizationId:org,compensation:{kind:'none'}},{organizationId:org,compensation:{kind:'fixed',amount:10}}];assert.equal(contractTermsSchema.safeParse(terms).success,false);
 assert.equal(querySchema.safeParse({rentalOptions:'true',organizationId:org,rentalPlayerId:org,rentalEventId:org}).success,true);
 assert.equal(querySchema.safeParse({rentalPlayerId:org}).success,false);assert.equal(querySchema.safeParse({rentalPayments:'true',contractId:org,payments:'true'}).success,false);
});
test('the generated rental clause makes both the basis and the host-funded payer explicit',()=>{
 const text=describeRentalCompensation({kind:'combined',amount:40,basis:'organization_prizes',basisPoints:2000,selection:'maximum'});
 assert.match(text,/Большее/);assert.match(text,/призовые организации/);assert.match(text,/нанявшая организация/);assert.match(text,/выплата игроку не уменьшается/);
});
