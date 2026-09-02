export type Role = "Employee" | "Maintenance" | "Supervisor" | "Admin" | "Super Admin";
export type Urgency = "Low" | "Medium" | "High" | "Critical";
export type ESOStatus = "Open" | "In Progress" | "Completed";
export interface Department { id:string; name:string; active:boolean; }
export interface User { id:string; employeeId:string; name:string; department:string; role:Role; password?:string; annualTarget:number; active:boolean; }
export interface ESOReport { id:string; esoNo:string; reporterId:string; createdAt:string; location:string; category:"Safety"|"Environmental"; urgency:Urgency; description:string; imageData?:string; imageName?:string; status:ESOStatus; assignedTo?:string; correctiveAction?:string; completedAt?:string; }
