export const TIME_ZONE='Europe/Sarajevo';
export function localParts(value:Date|string){const d=value instanceof Date?value:new Date(value),parts=new Intl.DateTimeFormat('en-US',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d),get=(t:string)=>Number(parts.find(p=>p.type===t)?.value||0);return {year:get('year'),month:get('month'),day:get('day')};}
export function localDateKey(value:Date|string){const p=localParts(value);return `${String(p.year).padStart(4,'0')}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`;}
export function shiftDateKey(key:string,days:number){const [year,month,day]=key.split('-').map(Number),d=new Date(Date.UTC(year,month-1,day));d.setUTCDate(d.getUTCDate()+days);return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;}
export function closurePeriodKeys(date=new Date()){
 const today=localDateKey(date),p=localParts(date),utcDay=new Date(Date.UTC(p.year,p.month-1,p.day)),weekday=utcDay.getUTCDay(),daysFromMonday=(weekday+6)%7,weekStart=shiftDateKey(today,-daysFromMonday),fy=fiscalYearInfo(date),fyStart=`${fy.year-1}-10-01`;
 return {today,weekStart,monthStart:`${p.year}-${String(p.month).padStart(2,'0')}-01`,fyStart};
}
export function fiscalYearInfo(date=new Date()){const p=localParts(date),year=p.month>=10?p.year+1:p.year;return {year,label:`FY${year}`,start:new Date(`${year-1}-10-01T00:00:00+02:00`),end:new Date(`${year}-10-01T00:00:00+02:00`)};}
export function inCurrentFY(value:string,now=new Date()){const d=new Date(value),fy=fiscalYearInfo(now);return d>=fy.start&&d<fy.end;}
