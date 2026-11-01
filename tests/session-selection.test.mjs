import test from 'node:test';
import assert from 'node:assert/strict';
import {selectResultsSession} from '../src/lib/competition/session-selection.ts';
test('latest played session wins over late publication, correction or unpublished future dates',()=>{
 const old={id:'old',startTime:'2026-09-01',publishedAt:'2026-11-01'},latest={id:'new',startTime:'2026-10-30',publishedAt:'2026-10-30'},future={id:'future',startTime:'2099-01-01',publishedAt:null};
 const rows=[future,old,latest];assert.equal(selectResultsSession(rows)?.id,'new');assert.equal(selectResultsSession(rows,'old')?.id,'old');assert.equal(selectResultsSession(rows,'future')?.id,'future');assert.equal(selectResultsSession(rows,'foreign'),null);assert.equal(selectResultsSession([]),null);
});
