export type Actor = { id: string; role: string; company_id: string; plant_id: string };
export function inScope(me: Actor, r: any) { return me.company_id === r.company_id && (me.role === 'super_admin' || me.plant_id === r.plant_id); }
export function canResolve(role: string) { return ['maintenance','supervisor','management','admin','super_admin'].includes(role); }
export function isAdmin(role: string) { return ['admin','super_admin'].includes(role); }
export function canReadReport(me: Actor, r: any) { return inScope(me,r) && (me.role !== 'employee' || r.reporter_id === me.id); }
export function canEditReport(me: Actor, r: any) { return !r.reclassified_to_voe && canReadReport(me,r) && (r.reporter_id === me.id || isAdmin(me.role) || me.role === 'management'); }
export function canEditCompletion(me: Actor, r: any, t: any) { return !r.reclassified_to_voe && canReadReport(me,r) && canResolve(me.role) && (isAdmin(me.role) || t?.assigned_to === me.id || t?.completed_by === me.id); }
export function canonicalCategory(value: unknown) {
 const v=String(value||'safety').trim().toLowerCase();
 return ({safety:'safety',environmental:'environmental',sigurnost:'safety','okoliš':'environmental',okolis:'environmental',sicherheit:'safety',umwelt:'environmental',seguridad:'safety','medio ambiente':'environmental'} as Record<string,string>)[v] || v;
}
export function canonicalUrgency(value: unknown) {
 const v=String(value||'medium').trim().toLowerCase();
 return ({low:'low',medium:'medium',high:'high',critical:'critical',niska:'low',srednja:'medium',visoka:'high','kritična':'critical',kriticna:'critical',niedrig:'low',mittel:'medium',hoch:'high',kritisch:'critical',baja:'low',media:'medium',alta:'high','crítica':'critical',critica:'critical'} as Record<string,string>)[v] || v;
}
export const MAX_PHOTOS = 8;
export const MAX_UPLOAD_BYTES = 3_500_000;
