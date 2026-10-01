export const TIME_ZONE='Europe/Sarajevo';
export function localParts(value:Date|string){const d=value instanceof Date?value:new Date(value),parts=new Intl.DateTimeFormat('en-US',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d),get=(t:string)=>Number(parts.find(p=>p.type===t)?.value||0);return {year:get('year'),month:get('month'),day:get('day')};}
export function fiscalYearInfo(date=new Date()){const p=localParts(date),year=p.month>=10?p.year+1:p.year;return {year,label:`FY${year}`,start:new Date(`${year-1}-10-01T00:00:00+02:00`),end:new Date(`${year}-10-01T00:00:00+02:00`)};}
export function inCurrentFY(value:string,now=new Date()){const d=new Date(value),fy=fiscalYearInfo(now);return d>=fy.start&&d<fy.end;}
