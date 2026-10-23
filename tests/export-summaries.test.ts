import test from 'node:test';
import assert from 'node:assert/strict';
import {managementSummarySheets} from '../lib/export-summaries';
test('management export includes promised sheets and separates duplicate IDs across plants',()=>{
 const base={Plant:'A','Plant Code':'A',Department:'Operations','Employee ID':'100',Employee:'Test User',Status:'Open'};
 const sheets=managementSummarySheets([base,{...base,Status:'Completed'},{...base,Plant:'B','Plant Code':'B'}]);
 assert.deepEqual(sheets.map(s=>s.name),['Department Summary','Employee Performance']);
 for(const sheet of sheets){assert.equal(sheet.rows.length,2);assert.equal(sheet.rows[0]['ESO YTD'],2);assert.equal(sheet.rows[0].Completed,1);assert.equal(sheet.rows[1]['ESO YTD'],1)}
});
