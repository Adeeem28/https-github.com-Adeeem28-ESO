import test from 'node:test';
import assert from 'node:assert/strict';
import {mapReports, type ReportRow} from '../lib/report-mapping';

const base: ReportRow = {id:'r1',revision:1,report_no:'ESO-1',reporter_id:'u1',reported_at:'2026-10-20T00:00:00Z',category:'safety',urgency:'medium',description:'Test',status:'open'};
const now=Date.parse('2026-10-23T12:00:00Z');
test('closed reports never appear overdue even with an unfinished legacy task',()=>{
 const task={status:'assigned',due_at:'2026-10-21T12:00:00Z'};
 for(const status of ['completed','closed']) {
  const [r]=mapReports([{...base,status,maintenance_tasks:[task]}],[],'u1',now);
  assert.equal(r.overdue,false);assert.equal(r.overdueDays,0);
 }
 const [open]=mapReports([{...base,maintenance_tasks:[task]}],[],'u1',now);
 assert.equal(open.overdue,true);assert.equal(open.overdueDays,2);
});
test('latest star is selected by timestamp without mutating database results',()=>{
 const stars=[{starred_by:'u1',created_at:'2026-10-20T00:00:00Z'},{starred_by:'u2',created_at:'2026-10-22T00:00:00Z'}];
 const [r]=mapReports([{...base,eso_report_stars:stars}],[{id:'u1',name:'First',role:'Employee'},{id:'u2',name:'Last',role:'Admin'}],'u1',now);
 assert.equal(r.starredBy,'u2');assert.equal(r.starredByName,'Last');assert.equal(r.starredByMe,true);assert.equal(r.starCount,2);
 assert.equal(stars[0].starred_by,'u1');
});
test('removed photos are hidden and latest corrective action is retained',()=>{
 const [r]=mapReports([{...base,eso_attachments:[{file_name:'removed.jpg',attachment_type:'report',created_at:'2026-10-20',removed_at:'2026-10-21'},{file_name:'visible.jpg',attachment_type:'report',created_at:'2026-10-22'}],corrective_actions:[{action_text:'New action',created_at:'2026-10-22'},{action_text:'Old action',created_at:'2026-10-20'}]}],[],'u1',now);
 assert.equal(r.imageName,'visible.jpg');assert.equal(r.correctiveAction,'New action');
});
