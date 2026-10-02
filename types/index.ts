export type Role = "Employee" | "Maintenance" | "Supervisor" | "Management" | "Admin" | "Super Admin";
export type Urgency = "Low" | "Medium" | "High" | "Critical";
export type ESOStatus = "Open" | "In Progress" | "Completed";
export interface Plant { id:string; name:string; code:string; active:boolean; }
export interface Department { id:string; name:string; code?:string|null; active:boolean; plantId?:string; }
export interface Location { id:string; name:string; active?:boolean; departmentId?:string|null; departmentName?:string|null; plantId?:string; plantName?:string|null; }
export interface User { companyId?:string; companyName?:string; companyCode?:string; plantId?:string; plantName?:string; plantCode?:string; id:string; employeeId:string; name:string; department:string; role:Role; annualTarget:number; active:boolean; }
export interface ESOReport { id:string; revision:number; locationId?:string; esoNo:string; reporterId:string; createdAt:string; location:string; plantId?:string; plantName?:string; category:"Safety"|"Environmental"; urgency:Urgency; description:string; imageData?:string; imageName?:string; completionImageData?:string; completionImageName?:string; status:ESOStatus; assignedTo?:string; assignedToName?:string; assignedToRole?:string; resolvedBy?:string; resolvedByName?:string; resolvedByRole?:string; correctiveAction?:string; completedAt?:string; taskStatus?:string; dueAt?:string; overdue?:boolean; overdueDays?:number; assignedAt?:string; startedAt?:string; isStarred?:boolean; starredBy?:string; starredByName?:string; starredAt?:string; }
export interface AppNotification { id:string; type:string; title:string; message?:string; esoReportId?:string; isRead:boolean; createdAt:string; }

export interface ClosureRatePeriod { reported:number; closed:number; open:number; rate:number; start:string; end:string; }
export interface ClosureRates { week:ClosureRatePeriod; month:ClosureRatePeriod; year:ClosureRatePeriod; }
export type HuntEventStatus = "draft"|"live"|"review"|"final"|"cancelled";
export interface HuntEvent { id:string; title:string; fiscalYear?:number; status:HuntEventStatus; scopeType:string; plantId?:string|null; locationId?:string|null; startsAt?:string|null; endsAt?:string|null; createdAt?:string; finalizedAt?:string|null; moderatorId?:string|null; }
export interface HuntTeam { teamId:string; name:string; colorKey:string; memberCount:number; members?:Array<{id:string;name:string;employeeId:string;role:string}>; submissions:number; accepted:number; excluded:number; events?:number; }
export interface HuntSubmission { id:string; eventId:string; teamId:string; reportId:string; reporterId:string; submittedAt:string; reviewStatus:"pending"|"accepted"|"duplicate"|"not_eso"; duplicateOf?:string|null; reviewedBy?:string|null; reviewedAt?:string|null; reviewNote?:string|null; report?:{id:string;report_no:string;reported_at:string;description:string;category:string;urgency:string;status:string;location_id?:string|null;plant_id?:string|null}|null; reporter?:{id:string;name:string;employeeId:string;role:string}|null; reviewer?:{id:string;name:string;employeeId:string;role:string}|null; }
export interface HuntData { year:number; events:HuntEvent[]; event:(HuntEvent&{scopeType:string})|null; teams:HuntTeam[]; leaderboard:HuntTeam[]; annualLeaderboard:HuntTeam[]; submissions:HuntSubmission[]; ownTeamId:string|null; moderatorId:string|null; isModerator:boolean; }

export type VoEStatus = "New" | "Under Review" | "Actioned" | "Closed";
export interface VoEReport { id:string; reporterId:string; reporterName?:string; employeeId?:string; department?:string; plantId?:string; plantName?:string; category:string; description:string; status:VoEStatus; adminNote?:string; sourceEsoReportId?:string; createdAt:string; updatedAt:string; }

