import test from 'node:test';
import assert from 'node:assert/strict';
import {compareReportPriority,priorityReportPage} from '../lib/report-priority';
test('report priority precedes date and paging crosses priority boundaries',async()=>{
 const rows=['Low','Critical','Medium','High'].map((urgency,i)=>({id:String(i),urgency,createdAt:`2026-10-${24-i}T00:00:00Z`}));
 assert.deepEqual(rows.sort(compareReportPriority).map(r=>r.urgency),['Critical','High','Medium','Low']);
 const buckets:Record<string,string[]>={Critical:['c1','c2'],High:['h1','h2','h3'],Medium:['m1'],Low:['l1']};
 const db={rpc:async(_name:string,args:any)=>({data:{total:buckets[args.p_filter.urgency].length,ids:buckets[args.p_filter.urgency].slice(args.p_offset,args.p_offset+args.p_limit)}})};
 assert.deepEqual(await priorityReportPage(db,'actor',{},1,4),{total:7,ids:['c2','h1','h2','h3']});
 assert.deepEqual(await priorityReportPage(db,'actor',{},5,4),{total:7,ids:['m1','l1']});
 assert.deepEqual(await priorityReportPage(db,'actor',{urgency:'High'},1,2),{total:3,ids:['h2','h3']});
});
test('single urgency uses one database request and propagates failures',async()=>{
 const calls:any[]=[];
 const db={rpc:async(_name:string,args:any)=>{calls.push(args);return {data:{total:120,ids:['h51']}};}};
 assert.deepEqual(await priorityReportPage(db,'actor',{urgency:'High',mine:true},50,50),{total:120,ids:['h51']});
 assert.equal(calls.length,1);
 assert.deepEqual(calls[0],{p_actor:'actor',p_filter:{urgency:'High',mine:true},p_offset:50,p_limit:50});
 await assert.rejects(priorityReportPage({rpc:async()=>({error:new Error('Unavailable')})},'actor',{urgency:'High'},0,50),/Unavailable/);
});
