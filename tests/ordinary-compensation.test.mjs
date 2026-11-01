import test from 'node:test';
import assert from 'node:assert/strict';
import {compensationSchema,ordinaryCompensationAmount,describeOrdinaryCompensation} from '../src/modules/contracts/ordinary-compensation.ts';
import {defaultTerms,contractTermsSchema,legacyContractTermsSchema} from '../src/modules/contracts/model.ts';

test('ordinary compensation compares fixed and exact percentage without adding',()=>{
 const max={kind:'combined',amount:40,basisPoints:2000,selection:'maximum'},min={...max,selection:'minimum'};
 assert.equal(ordinaryCompensationAmount(max,100),40);assert.equal(ordinaryCompensationAmount(max,300),60);
 assert.equal(ordinaryCompensationAmount(min,100),20);assert.equal(ordinaryCompensationAmount(min,300),40);
 assert.equal(ordinaryCompensationAmount({...max,amount:0,basisPoints:3333},101),33);
 assert.equal(ordinaryCompensationAmount({...max,amount:0,basisPoints:9999},999999999999),999899999999);
 assert.equal(ordinaryCompensationAmount({kind:'none'},0),0);
});

test('only new ordinary clauses accept combined, with implicit immutable bases',()=>{
 const mixed={kind:'combined',amount:100,basisPoints:2000,selection:'maximum'},terms=defaultTerms();
 for(const key of ['transfer','playerExit','organizationTermination'])assert.equal(contractTermsSchema.safeParse({...terms,[key]:mixed}).success,true);
 assert.equal(contractTermsSchema.safeParse({...terms,guestCompensation:mixed,guestPolicy:'allowed'}).success,false);
 const {schemaVersion,financial,...old}=terms;void schemaVersion;void financial;
 assert.equal(legacyContractTermsSchema.safeParse({...old,note:''}).success,true);
 assert.equal(legacyContractTermsSchema.safeParse({...old,note:'',playerExit:mixed}).success,false);
 for(const invalid of [{...mixed,selection:null},{...mixed,selection:'sum'},{...mixed,amount:1.5},{...mixed,basisPoints:10001},{...mixed,base:{kind:'specified',amount:1}},{...mixed,payerId:'forged'}])assert.equal(compensationSchema.safeParse(invalid).success,false);
 for(const invalid of [-1,0.1,NaN,Infinity])assert.throws(()=>ordinaryCompensationAmount(mixed,invalid));
});

test('wording identifies base and one selected amount',()=>{
 const text=describeOrdinaryCompensation({kind:'combined',amount:40,basisPoints:2000,selection:'minimum'},'от согласованной цены перехода');
 assert.match(text,/Меньшее из 40 OC и 20% от согласованной цены перехода/);assert.match(text,/не складываются/);assert.match(text,/округляется вниз/);
});
