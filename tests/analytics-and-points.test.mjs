import test from 'node:test';
import assert from 'node:assert/strict';
import {analyticsPath,analyticsActive,activityDuration} from '../src/lib/analytics/model.ts';
import {formatBetPoints,BET_CURRENCY_NAME} from '../src/lib/betting-currency.ts';
import {formatCoins,SITE_CURRENCY_NAME} from '../src/lib/economy/currency.ts';
test('activity removes private query/hash values and collapses entity identifiers',()=>{
 assert.equal(analyticsPath('/profile/12345678-1234-4123-8123-123456789012?token=secret#private'),'/profile/:id');
 assert.equal(analyticsPath('/contracts?contractId=private'),'/contracts');
 assert.equal(analyticsPath(''),'/');
});
test('hidden/unfocused/idle tabs never report active time; reading window is bounded',()=>{
 assert.equal(analyticsActive(true,true,0,120000),true);
 for(const args of [[false,true,1000,2000],[true,false,1000,2000],[true,true,0,120001],[true,true,2000,1000]])assert.equal(analyticsActive(...args),false);
 assert.equal(activityDuration(3660),'1 ч 1 мин');
});
test('forecast values use AP independently from primary OMCITE Coins',()=>{
 assert.equal(BET_CURRENCY_NAME,'Arena Points');assert.equal(SITE_CURRENCY_NAME,'OMCITE Coins');
 assert.equal(formatBetPoints(1250),'1 250 AP');assert.match(formatCoins(1250),/🪙/);
});
