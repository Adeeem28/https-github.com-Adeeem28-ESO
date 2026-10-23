/** Stable priority order shared by local lists and server pagination. */
export const REPORT_PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
export function compareReportPriority(a: {urgency:string;createdAt:string;id:string}, b: {urgency:string;createdAt:string;id:string}) {
 const rank = (value:string) => {const i=REPORT_PRIORITIES.findIndex(p=>p.toLowerCase()===value.toLowerCase());return i<0?4:i;};
 return rank(a.urgency)-rank(b.urgency) || Date.parse(b.createdAt)-Date.parse(a.createdAt) || a.id.localeCompare(b.id);
}
/** Read priority buckets before slicing, so priority is respected across pages. */
export async function priorityReportPage(db:any, actor:string, filters:Record<string,unknown>, offset:number, limit:number) {
 const priorities = filters.urgency && filters.urgency !== 'All' ? [filters.urgency] : [...REPORT_PRIORITIES];
 const read = async (urgency:unknown, start:number, size:number) => {
  const result=await db.rpc('eso_report_page_v628',{p_actor:actor,p_filter:{...filters,urgency},p_offset:start,p_limit:size});
  if(result.error)throw result.error;
  return result.data as {total:number;ids:string[]};
 };
 // A single urgency already has the desired ordering; fetch its page directly.
 if(priorities.length===1)return read(priorities[0],offset,limit);
 const counts=await Promise.all(priorities.map(p=>read(p,0,1)));
 let skip=offset,remaining=limit;
 const requests:Promise<{total:number;ids:string[]}>[]=[];
 counts.forEach((bucket,i)=>{
  if(skip>=bucket.total){skip-=bucket.total;return;}
  const take=Math.min(remaining,bucket.total-skip);
  if(take>0)requests.push(read(priorities[i],skip,take));
  remaining-=take;skip=0;
 });
 return {total:counts.reduce((n,b)=>n+b.total,0),ids:(await Promise.all(requests)).flatMap(b=>b.ids)};
}
