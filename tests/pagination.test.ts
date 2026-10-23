import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchAll,fetchByIds} from '../lib/pagination';
test('pagination reads beyond the default database cap and stops at the end',async()=>{
 const rows=Array.from({length:1201},(_,id)=>({id})),calls:number[]=[];
 const result=await fetchAll({range:async(start:number,end:number)=>{calls.push(start);return{data:rows.slice(start,end+1),error:null}}});
 assert.equal(result.data?.length,1201);assert.deepEqual(calls,[0,500,1000]);
});
test('later page failures never return partial results as a complete dataset',async()=>{
 const result=await fetchAll({range:async(start:number)=>start===0?{data:Array(500).fill({id:1}),error:null}:{data:null,error:{message:'Unavailable'}}});
 assert.equal(result.data,null);assert.equal(result.error?.message,'Unavailable');
});
test('ID lookups deduplicate and bound filters without dropping records',async()=>{
 const batches:number[]=[];const ids=Array.from({length:1201},(_,i)=>String(i));
 const result=await fetchByIds([...ids,...ids.slice(0,20)],batch=>{batches.push(batch.length);return{range:async()=>({data:batch.map(id=>({id})),error:null})}});
 assert.equal(result.data?.length,1201);assert.ok(batches.every(n=>n<=100));assert.equal(batches.length,13);
});
