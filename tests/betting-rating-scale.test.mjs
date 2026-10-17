import assert from 'node:assert/strict';
import {calculateFixedOdds} from '../src/lib/betting-odds.ts';

const base={marketType:'win',selectionValue:'win',averageKills:6,averagePlace:4,
 sampleSize:10,fieldSize:8,maximumOdds:15};
const legacy=calculateFixedOdds({...base,teamRating:50,opponentRating:40,ratingScale:100});
const updated=calculateFixedOdds({...base,teamRating:499.5,opponentRating:399.6,ratingScale:999});
assert.ok(Math.abs(legacy.rawOdds-updated.rawOdds)<1e-10,
 'Rescaling the main rating must preserve the odds implied by the same relative strength');
const stronger=calculateFixedOdds({...base,teamRating:900,opponentRating:400,ratingScale:999});
assert.ok(stronger.rawOdds<updated.rawOdds,
 'Main ratings above 100 must remain distinguishable in the betting model');
console.log('PASS: new main rating scale preserves relative odds and distinguishes stronger teams');
