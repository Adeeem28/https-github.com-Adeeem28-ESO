export type Role = "Employee" | "Maintenance" | "Supervisor" | "Management" | "Admin" | "Super Admin";
export type Urgency = "Low" | "Medium" | "High" | "Critical";
export type ESOStatus = "Open" | "In Progress" | "Completed";
export interface Plant { id:string; name:string; code:string; active:boolean; }
export interface Department { id:string; name:string; code?:string|null; active:boolean; plantId?:string; }
export interface Location { id:string; name:string; active?:boolean; departmentId?:string|null; departmentName?:string|null; plantId?:string; plantName?:string|null; }
export interface User { companyId?:string; companyName?:string; companyCode?:string; plantId?:string; plantName?:string; plantCode?:string; id:string; employeeId:string; name:string; department:string; role:Role; annualTarget:number; active:boolean; }
export interface ESOReport { id:string; esoNo:string; reporterId:string; createdAt:string; location:string; plantId?:string; plantName?:string; category:"Safety"|"Environmental"; urgency:Urgency; description:string; imageData?:string; imageName?:string; completionImageData?:string; completionImageName?:string; status:ESOStatus; assignedTo?:string; assignedToName?:string; assignedToRole?:string; resolvedBy?:string; resolvedByName?:string; resolvedByRole?:string; correctiveAction?:string; completedAt?:string; taskStatus?:string; dueAt?:string; overdue?:boolean; overdueDays?:number; assignedAt?:string; startedAt?:string; }
export interface AppNotification { id:string; type:string; title:string; message?:string; esoReportId?:string; isRead:boolean; createdAt:string; }
