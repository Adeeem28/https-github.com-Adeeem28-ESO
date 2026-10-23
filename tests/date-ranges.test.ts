import test from 'node:test';
import assert from 'node:assert/strict';
import {exportDateRange,localDayStart} from '../lib/fiscal-year';
test('export boundaries match Sarajevo calendar days rather than UTC days',()=>{
 assert.deepEqual(exportDateRange('2026-10-22','2026-10-22'),{from:'2026-10-21T22:00:00.000Z',to:'2026-10-22T22:00:00.000Z'});
 assert.equal(localDayStart('2026-01-10'),'2026-01-09T23:00:00.000Z');
});
test('DST days have correct 23/25 hour intervals',()=>{
 for(const [date,hours] of [['2026-03-29',23],['2026-10-25',25]] as const){const range=exportDateRange(date,date);assert.equal((Date.parse(range.to!)-Date.parse(range.from!))/3600000,hours)}
});
test('invalid dates and reversed export intervals are rejected',()=>{
 for(const date of ['2026-02-30','2026-13-01','tomorrow','2026-1-01'])assert.throws(()=>exportDateRange(null,date));
 assert.throws(()=>exportDateRange('2026-10-23','2026-10-22'));
});
