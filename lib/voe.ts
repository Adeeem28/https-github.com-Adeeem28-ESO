import type {VoEStatus} from '@/types';
export const VOE_CATEGORIES:Record<string,string>={workplace_conditions:'Workplace & Working Conditions',compensation_benefits:'Compensation & Benefits',process_improvement:'Process Improvement',equipment_tools:'Equipment & Tools',work_organization:'Work Organization',management_communication:'Management & Communication',employee_wellbeing:'Employee Wellbeing',other:'Other'};
export const VOE_STATUSES:Record<string,VoEStatus>={new:'New',under_review:'Under Review',actioned:'Actioned',closed:'Closed'};
export function voeNotes(note:string|null,sourceId:string|null,reason?:string){
 const legacy=!!sourceId&&!!note?.startsWith('Reclassified from ESO:');
 return {adminNote:legacy?undefined:note||undefined,transferReason:reason||(legacy?note!.slice('Reclassified from ESO:'.length).trim():undefined)};
}
