// Supabase's 1000-row cap must not silently truncate exports or annual totals.
export async function fetchAll(query:any){
 const rows:any[]=[];const pageSize=500;
 for(let offset=0;;offset+=pageSize){const result=await query.range(offset,offset+pageSize-1);if(result.error)return {data:null,error:result.error};const page=result.data||[];rows.push(...page);if(page.length<pageSize)return {data:rows,error:null};}
}
