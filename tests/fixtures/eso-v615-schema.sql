-- Synthetic fixture reconstructed from metadata only. No production rows.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema extensions;
create extension pgcrypto with schema extensions;
grant usage on schema public,extensions to anon,authenticated,service_role;
create sequence public."eso_report_number_seq";
create table public."companies" ("id" uuid default gen_random_uuid() not null,
"name" text not null,
"code" text not null,
"active" boolean default true not null,
"created_at" timestamp with time zone default now() not null,
"plan" text default 'Trial'::text not null,
"subscription_status" text default 'trial'::text not null,
"updated_at" timestamp with time zone default now() not null);
create table public."corrective_actions" ("id" uuid default gen_random_uuid() not null,
"eso_report_id" uuid not null,
"maintenance_task_id" uuid,
"action_text" text not null,
"created_by" uuid,
"created_at" timestamp with time zone default now() not null,
"company_id" uuid not null,
"plant_id" uuid not null);
create table public."departments" ("id" uuid default gen_random_uuid() not null,
"name" text not null,
"code" text,
"active" boolean default true not null,
"created_at" timestamp with time zone default now() not null,
"company_id" uuid not null,
"plant_id" uuid not null);
create table public."employees" ("id" uuid default gen_random_uuid() not null,
"employee_no" text not null,
"first_name" text not null,
"last_name" text not null,
"department_id" uuid,
"job_title" text,
"role" text default 'employee'::text not null,
"password_hash" text,
"annual_eso_target" integer default 12 not null,
"active" boolean default true not null,
"created_at" timestamp with time zone default now() not null,
"updated_at" timestamp with time zone default now() not null,
"company_id" uuid not null,
"plant_id" uuid not null);
create table public."eso_attachments" ("id" uuid default gen_random_uuid() not null,
"eso_report_id" uuid not null,
"storage_path" text not null,
"file_name" text,
"mime_type" text,
"uploaded_by" uuid,
"attachment_type" text default 'report'::text not null,
"created_at" timestamp with time zone default now() not null,
"company_id" uuid not null,
"plant_id" uuid not null);
create table public."eso_reports" ("id" uuid default gen_random_uuid() not null,
"report_no" text default ((('ESO-'::text || to_char((CURRENT_DATE)::timestamp with time zone, 'YYYY'::text)) || '-'::text) || lpad((nextval('eso_report_number_seq'::regclass))::text, 5, '0'::text)) not null,
"reporter_id" uuid not null,
"location_id" uuid,
"category" text default 'safety'::text not null,
"description" text not null,
"urgency" text not null,
"status" text default 'open'::text not null,
"reported_at" timestamp with time zone default now() not null,
"completed_at" timestamp with time zone,
"closed_at" timestamp with time zone,
"created_at" timestamp with time zone default now() not null,
"updated_at" timestamp with time zone default now() not null,
"company_id" uuid not null,
"plant_id" uuid not null,
"is_starred" boolean default false not null,
"starred_by" uuid,
"starred_at" timestamp with time zone,
"reclassified_to_voe" boolean default false not null);
create table public."eso_status_history" ("id" bigint generated always as identity not null,
"eso_report_id" uuid not null,
"old_status" text,
"new_status" text not null,
"changed_by" uuid,
"note" text,
"changed_at" timestamp with time zone default now() not null,
"company_id" uuid not null,
"plant_id" uuid not null);
create table public."locations" ("id" uuid default gen_random_uuid() not null,
"name" text not null,
"department_id" uuid,
"active" boolean default true not null,
"created_at" timestamp with time zone default now() not null,
"company_id" uuid not null,
"plant_id" uuid not null);
create table public."maintenance_tasks" ("id" uuid default gen_random_uuid() not null,
"eso_report_id" uuid not null,
"assigned_to" uuid,
"assigned_by" uuid,
"priority" text,
"due_at" timestamp with time zone,
"status" text default 'unassigned'::text not null,
"assigned_at" timestamp with time zone,
"started_at" timestamp with time zone,
"completed_at" timestamp with time zone,
"created_at" timestamp with time zone default now() not null,
"updated_at" timestamp with time zone default now() not null,
"completion_note" text,
"completed_by" uuid,
"company_id" uuid not null,
"plant_id" uuid not null);
create table public."notifications" ("id" uuid default gen_random_uuid() not null,
"user_id" uuid not null,
"type" text not null,
"title" text not null,
"message" text,
"eso_report_id" uuid,
"maintenance_task_id" uuid,
"is_read" boolean default false not null,
"created_at" timestamp with time zone default now() not null,
"company_id" uuid not null,
"plant_id" uuid not null);
create table public."plants" ("id" uuid default gen_random_uuid() not null,
"company_id" uuid not null,
"name" text not null,
"code" text not null,
"active" boolean default true not null,
"created_at" timestamp with time zone default now() not null);
create table public."platform_owners" ("id" uuid default gen_random_uuid() not null,
"username" text not null,
"display_name" text not null,
"password_hash" text not null,
"active" boolean default true not null,
"created_at" timestamp with time zone default now() not null,
"updated_at" timestamp with time zone default now() not null);
create table public."push_subscriptions" ("id" uuid default gen_random_uuid() not null,
"company_id" uuid not null,
"plant_id" uuid not null,
"user_id" uuid not null,
"endpoint" text not null,
"p256dh" text not null,
"auth" text not null,
"user_agent" text,
"active" boolean default true not null,
"created_at" timestamp with time zone default now() not null,
"updated_at" timestamp with time zone default now() not null);
create table public."report_reclassification_history" ("id" uuid default gen_random_uuid() not null,
"company_id" uuid not null,
"plant_id" uuid not null,
"eso_report_id" uuid,
"voe_report_id" uuid,
"from_type" text not null,
"to_type" text not null,
"reason" text not null,
"changed_by" uuid not null,
"changed_at" timestamp with time zone default now() not null);
create table public."task_reminder_events" ("id" uuid default gen_random_uuid() not null,
"company_id" uuid not null,
"plant_id" uuid not null,
"maintenance_task_id" uuid not null,
"event_key" text not null,
"sent_at" timestamp with time zone default now() not null);
create table public."voe_reports" ("id" uuid default gen_random_uuid() not null,
"company_id" uuid not null,
"plant_id" uuid not null,
"reporter_id" uuid not null,
"category" text not null,
"description" text not null,
"status" text default 'new'::text not null,
"admin_note" text,
"source_eso_report_id" uuid,
"created_at" timestamp with time zone default now() not null,
"updated_at" timestamp with time zone default now() not null,
"closed_at" timestamp with time zone,
"closed_by" uuid);
alter table public."voe_reports" add constraint "voe_reports_pkey" PRIMARY KEY (id);
alter table public."report_reclassification_history" add constraint "report_reclassification_history_pkey" PRIMARY KEY (id);
alter table public."departments" add constraint "departments_code_key" UNIQUE (code);
alter table public."departments" add constraint "departments_pkey" PRIMARY KEY (id);
alter table public."employees" add constraint "employees_pkey" PRIMARY KEY (id);
alter table public."locations" add constraint "locations_name_key" UNIQUE (name);
alter table public."locations" add constraint "locations_pkey" PRIMARY KEY (id);
alter table public."eso_reports" add constraint "eso_reports_pkey" PRIMARY KEY (id);
alter table public."eso_reports" add constraint "eso_reports_report_no_key" UNIQUE (report_no);
alter table public."plants" add constraint "plants_pkey" PRIMARY KEY (id);
alter table public."maintenance_tasks" add constraint "maintenance_tasks_eso_report_id_key" UNIQUE (eso_report_id);
alter table public."maintenance_tasks" add constraint "maintenance_tasks_pkey" PRIMARY KEY (id);
alter table public."corrective_actions" add constraint "corrective_actions_pkey" PRIMARY KEY (id);
alter table public."eso_attachments" add constraint "eso_attachments_pkey" PRIMARY KEY (id);
alter table public."eso_status_history" add constraint "eso_status_history_pkey" PRIMARY KEY (id);
alter table public."companies" add constraint "companies_pkey" PRIMARY KEY (id);
alter table public."notifications" add constraint "notifications_pkey" PRIMARY KEY (id);
alter table public."platform_owners" add constraint "platform_owners_pkey" PRIMARY KEY (id);
alter table public."push_subscriptions" add constraint "push_subscriptions_pkey" PRIMARY KEY (id);
alter table public."push_subscriptions" add constraint "push_subscriptions_user_id_endpoint_key" UNIQUE (user_id, endpoint);
alter table public."task_reminder_events" add constraint "task_reminder_events_maintenance_task_id_event_key_key" UNIQUE (maintenance_task_id, event_key);
alter table public."task_reminder_events" add constraint "task_reminder_events_pkey" PRIMARY KEY (id);
alter table public."voe_reports" add constraint "voe_reports_category_check" CHECK ((category = ANY (ARRAY['workplace_conditions'::text, 'compensation_benefits'::text, 'process_improvement'::text, 'equipment_tools'::text, 'work_organization'::text, 'management_communication'::text, 'employee_wellbeing'::text, 'other'::text])));
alter table public."voe_reports" add constraint "voe_reports_closed_by_fkey" FOREIGN KEY (closed_by) REFERENCES employees(id) ON DELETE SET NULL;
alter table public."voe_reports" add constraint "voe_reports_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."voe_reports" add constraint "voe_reports_plant_id_fkey" FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE;
alter table public."voe_reports" add constraint "voe_reports_reporter_id_fkey" FOREIGN KEY (reporter_id) REFERENCES employees(id) ON DELETE RESTRICT;
alter table public."voe_reports" add constraint "voe_reports_source_eso_report_id_fkey" FOREIGN KEY (source_eso_report_id) REFERENCES eso_reports(id) ON DELETE SET NULL;
alter table public."voe_reports" add constraint "voe_reports_status_check" CHECK ((status = ANY (ARRAY['new'::text, 'under_review'::text, 'actioned'::text, 'closed'::text])));
alter table public."report_reclassification_history" add constraint "report_reclassification_history_changed_by_fkey" FOREIGN KEY (changed_by) REFERENCES employees(id) ON DELETE RESTRICT;
alter table public."report_reclassification_history" add constraint "report_reclassification_history_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."report_reclassification_history" add constraint "report_reclassification_history_eso_report_id_fkey" FOREIGN KEY (eso_report_id) REFERENCES eso_reports(id) ON DELETE SET NULL;
alter table public."report_reclassification_history" add constraint "report_reclassification_history_from_type_check" CHECK ((from_type = ANY (ARRAY['eso'::text, 'voe'::text])));
alter table public."report_reclassification_history" add constraint "report_reclassification_history_plant_id_fkey" FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE;
alter table public."report_reclassification_history" add constraint "report_reclassification_history_to_type_check" CHECK ((to_type = ANY (ARRAY['eso'::text, 'voe'::text])));
alter table public."report_reclassification_history" add constraint "report_reclassification_history_voe_report_id_fkey" FOREIGN KEY (voe_report_id) REFERENCES voe_reports(id) ON DELETE SET NULL;
alter table public."departments" add constraint "departments_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."departments" add constraint "departments_plant_id_fkey" FOREIGN KEY (plant_id) REFERENCES plants(id);
alter table public."employees" add constraint "employees_annual_eso_target_check" CHECK ((annual_eso_target >= 0));
alter table public."employees" add constraint "employees_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."employees" add constraint "employees_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
alter table public."employees" add constraint "employees_plant_id_fkey" FOREIGN KEY (plant_id) REFERENCES plants(id);
alter table public."employees" add constraint "employees_role_check" CHECK ((role = ANY (ARRAY['employee'::text, 'maintenance'::text, 'supervisor'::text, 'management'::text, 'admin'::text, 'super_admin'::text])));
alter table public."locations" add constraint "locations_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."locations" add constraint "locations_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
alter table public."locations" add constraint "locations_plant_id_fkey" FOREIGN KEY (plant_id) REFERENCES plants(id);
alter table public."eso_reports" add constraint "eso_reports_category_check" CHECK ((category = ANY (ARRAY['safety'::text, 'environmental'::text])));
alter table public."eso_reports" add constraint "eso_reports_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."eso_reports" add constraint "eso_reports_location_id_fkey" FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;
alter table public."eso_reports" add constraint "eso_reports_plant_id_fkey" FOREIGN KEY (plant_id) REFERENCES plants(id);
alter table public."eso_reports" add constraint "eso_reports_reporter_id_fkey" FOREIGN KEY (reporter_id) REFERENCES employees(id) ON DELETE RESTRICT;
alter table public."eso_reports" add constraint "eso_reports_star_consistency" CHECK ((((is_starred = false) AND (starred_at IS NULL)) OR ((is_starred = true) AND (starred_at IS NOT NULL))));
alter table public."eso_reports" add constraint "eso_reports_starred_by_fkey" FOREIGN KEY (starred_by) REFERENCES employees(id) ON DELETE SET NULL;
alter table public."eso_reports" add constraint "eso_reports_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'assigned'::text, 'in_progress'::text, 'waiting'::text, 'completed'::text, 'closed'::text])));
alter table public."eso_reports" add constraint "eso_reports_urgency_check" CHECK ((urgency = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])));
alter table public."plants" add constraint "plants_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."maintenance_tasks" add constraint "maintenance_tasks_assigned_by_fkey" FOREIGN KEY (assigned_by) REFERENCES employees(id) ON DELETE SET NULL;
alter table public."maintenance_tasks" add constraint "maintenance_tasks_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES employees(id) ON DELETE SET NULL;
alter table public."maintenance_tasks" add constraint "maintenance_tasks_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."maintenance_tasks" add constraint "maintenance_tasks_completed_by_fkey" FOREIGN KEY (completed_by) REFERENCES employees(id) ON DELETE SET NULL;
alter table public."maintenance_tasks" add constraint "maintenance_tasks_eso_report_id_fkey" FOREIGN KEY (eso_report_id) REFERENCES eso_reports(id) ON DELETE CASCADE;
alter table public."maintenance_tasks" add constraint "maintenance_tasks_plant_id_fkey" FOREIGN KEY (plant_id) REFERENCES plants(id);
alter table public."maintenance_tasks" add constraint "maintenance_tasks_priority_check" CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])));
alter table public."maintenance_tasks" add constraint "maintenance_tasks_status_check" CHECK ((status = ANY (ARRAY['unassigned'::text, 'assigned'::text, 'in_progress'::text, 'waiting'::text, 'completed'::text])));
alter table public."corrective_actions" add constraint "corrective_actions_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."corrective_actions" add constraint "corrective_actions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES employees(id) ON DELETE SET NULL;
alter table public."corrective_actions" add constraint "corrective_actions_eso_report_id_fkey" FOREIGN KEY (eso_report_id) REFERENCES eso_reports(id) ON DELETE CASCADE;
alter table public."corrective_actions" add constraint "corrective_actions_maintenance_task_id_fkey" FOREIGN KEY (maintenance_task_id) REFERENCES maintenance_tasks(id) ON DELETE SET NULL;
alter table public."corrective_actions" add constraint "corrective_actions_plant_id_fkey" FOREIGN KEY (plant_id) REFERENCES plants(id);
alter table public."eso_attachments" add constraint "eso_attachments_attachment_type_check" CHECK ((attachment_type = ANY (ARRAY['report'::text, 'corrective_action'::text, 'completion'::text])));
alter table public."eso_attachments" add constraint "eso_attachments_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."eso_attachments" add constraint "eso_attachments_eso_report_id_fkey" FOREIGN KEY (eso_report_id) REFERENCES eso_reports(id) ON DELETE CASCADE;
alter table public."eso_attachments" add constraint "eso_attachments_plant_id_fkey" FOREIGN KEY (plant_id) REFERENCES plants(id);
alter table public."eso_attachments" add constraint "eso_attachments_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES employees(id) ON DELETE SET NULL;
alter table public."eso_status_history" add constraint "eso_status_history_changed_by_fkey" FOREIGN KEY (changed_by) REFERENCES employees(id) ON DELETE SET NULL;
alter table public."eso_status_history" add constraint "eso_status_history_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."eso_status_history" add constraint "eso_status_history_eso_report_id_fkey" FOREIGN KEY (eso_report_id) REFERENCES eso_reports(id) ON DELETE CASCADE;
alter table public."eso_status_history" add constraint "eso_status_history_plant_id_fkey" FOREIGN KEY (plant_id) REFERENCES plants(id);
alter table public."notifications" add constraint "notifications_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id);
alter table public."notifications" add constraint "notifications_eso_report_id_fkey" FOREIGN KEY (eso_report_id) REFERENCES eso_reports(id) ON DELETE CASCADE;
alter table public."notifications" add constraint "notifications_maintenance_task_id_fkey" FOREIGN KEY (maintenance_task_id) REFERENCES maintenance_tasks(id) ON DELETE CASCADE;
alter table public."notifications" add constraint "notifications_plant_id_fkey" FOREIGN KEY (plant_id) REFERENCES plants(id);
alter table public."notifications" add constraint "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES employees(id) ON DELETE CASCADE;
alter table public."push_subscriptions" add constraint "push_subscriptions_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."push_subscriptions" add constraint "push_subscriptions_plant_id_fkey" FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE;
alter table public."push_subscriptions" add constraint "push_subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES employees(id) ON DELETE CASCADE;
alter table public."task_reminder_events" add constraint "task_reminder_events_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
alter table public."task_reminder_events" add constraint "task_reminder_events_maintenance_task_id_fkey" FOREIGN KEY (maintenance_task_id) REFERENCES maintenance_tasks(id) ON DELETE CASCADE;
alter table public."task_reminder_events" add constraint "task_reminder_events_plant_id_fkey" FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE;
CREATE INDEX idx_voe_company_plant_created ON public.voe_reports USING btree (company_id, plant_id, created_at DESC);
CREATE INDEX idx_voe_reporter_created ON public.voe_reports USING btree (reporter_id, created_at DESC);
CREATE INDEX idx_voe_status ON public.voe_reports USING btree (company_id, plant_id, status);
CREATE INDEX idx_reclass_eso ON public.report_reclassification_history USING btree (eso_report_id, changed_at DESC);
CREATE INDEX idx_reclass_voe ON public.report_reclassification_history USING btree (voe_report_id, changed_at DESC);
CREATE INDEX idx_departments_company ON public.departments USING btree (company_id);
CREATE INDEX idx_departments_plant ON public.departments USING btree (plant_id);
CREATE UNIQUE INDEX departments_company_plant_name_uq ON public.departments USING btree (company_id, plant_id, lower(name));
CREATE INDEX idx_employees_department ON public.employees USING btree (department_id);
CREATE INDEX idx_employees_employee_no ON public.employees USING btree (employee_no);
CREATE INDEX idx_employees_company ON public.employees USING btree (company_id);
CREATE UNIQUE INDEX employees_company_employee_no_uidx ON public.employees USING btree (company_id, employee_no) WHERE (company_id IS NOT NULL);
CREATE INDEX idx_employees_plant ON public.employees USING btree (plant_id);
CREATE UNIQUE INDEX employees_company_plant_no_uq ON public.employees USING btree (company_id, plant_id, employee_no);
CREATE INDEX idx_locations_company ON public.locations USING btree (company_id);
CREATE INDEX idx_locations_plant ON public.locations USING btree (plant_id);
CREATE INDEX idx_reports_reporter ON public.eso_reports USING btree (reporter_id);
CREATE INDEX idx_reports_status ON public.eso_reports USING btree (status);
CREATE INDEX idx_reports_reported_at ON public.eso_reports USING btree (reported_at DESC);
CREATE INDEX idx_reports_location ON public.eso_reports USING btree (location_id);
CREATE INDEX idx_eso_reports_company ON public.eso_reports USING btree (company_id);
CREATE INDEX idx_eso_reports_plant ON public.eso_reports USING btree (plant_id);
CREATE INDEX idx_reports_company_plant_reported_at ON public.eso_reports USING btree (company_id, plant_id, reported_at DESC);
CREATE INDEX idx_reports_company_reporter_reported_at ON public.eso_reports USING btree (company_id, reporter_id, reported_at DESC);
CREATE INDEX idx_reports_starred ON public.eso_reports USING btree (company_id, plant_id, starred_at DESC) WHERE (is_starred = true);
CREATE UNIQUE INDEX plants_company_code_uq ON public.plants USING btree (company_id, lower(code));
CREATE INDEX idx_plants_company ON public.plants USING btree (company_id);
CREATE INDEX idx_tasks_assigned_to ON public.maintenance_tasks USING btree (assigned_to);
CREATE INDEX idx_tasks_status_assignee ON public.maintenance_tasks USING btree (status, assigned_to);
CREATE INDEX idx_maintenance_tasks_company ON public.maintenance_tasks USING btree (company_id);
CREATE INDEX idx_maintenance_tasks_plant ON public.maintenance_tasks USING btree (plant_id);
CREATE INDEX idx_maintenance_tasks_due_active ON public.maintenance_tasks USING btree (company_id, plant_id, due_at) WHERE ((status <> 'completed'::text) AND (due_at IS NOT NULL));
CREATE INDEX idx_tasks_company_plant_assignee_status ON public.maintenance_tasks USING btree (company_id, plant_id, assigned_to, status);
CREATE INDEX idx_corrective_actions_company ON public.corrective_actions USING btree (company_id);
CREATE INDEX idx_corrective_actions_plant ON public.corrective_actions USING btree (plant_id);
CREATE INDEX idx_corrective_actions_report_created_at ON public.corrective_actions USING btree (eso_report_id, created_at DESC);
CREATE INDEX idx_attachments_report ON public.eso_attachments USING btree (eso_report_id);
CREATE INDEX idx_eso_attachments_company ON public.eso_attachments USING btree (company_id);
CREATE INDEX idx_eso_attachments_plant ON public.eso_attachments USING btree (plant_id);
CREATE INDEX idx_attachments_report_type_created_at ON public.eso_attachments USING btree (eso_report_id, attachment_type, created_at DESC);
CREATE INDEX idx_eso_status_history_company ON public.eso_status_history USING btree (company_id);
CREATE INDEX idx_eso_status_history_plant ON public.eso_status_history USING btree (plant_id);
CREATE INDEX idx_status_history_report_changed_at ON public.eso_status_history USING btree (eso_report_id, changed_at DESC);
CREATE UNIQUE INDEX companies_code_ci_uq ON public.companies USING btree (lower(code));
CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_company ON public.notifications USING btree (company_id);
CREATE INDEX idx_notifications_plant ON public.notifications USING btree (plant_id);
CREATE UNIQUE INDEX platform_owners_username_ci_uq ON public.platform_owners USING btree (lower(username));
CREATE INDEX idx_push_subscriptions_company_plant ON public.push_subscriptions USING btree (company_id, plant_id);
CREATE INDEX idx_push_subscriptions_user_active ON public.push_subscriptions USING btree (user_id, active);
CREATE INDEX idx_task_reminder_events_task ON public.task_reminder_events USING btree (maintenance_task_id);
CREATE OR REPLACE FUNCTION public.admin_reset_eso_password(p_user_id uuid, p_new_password text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
 if coalesce(length(p_new_password),0)<6 then raise exception 'Password must be at least 6 characters'; end if;
 update public.employees set password_hash=crypt(p_new_password,gen_salt('bf')) where id=p_user_id and role<>'employee';
 return found;
end;$function$;
CREATE OR REPLACE FUNCTION public.admin_set_eso_password(p_user_id uuid, p_new_password text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if coalesce(length(p_new_password),0) < 6 then raise exception 'Password must be at least 6 characters'; end if;
  update public.employees set password_hash=crypt(p_new_password,gen_salt('bf')) where id=p_user_id;
  return found;
end;
$function$;
CREATE OR REPLACE FUNCTION public.change_eso_password(p_user_id uuid, p_current_password text, p_new_password text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare ok boolean;
begin
  if coalesce(length(p_new_password),0) < 6 then raise exception 'Password must be at least 6 characters'; end if;
  select (password_hash is not null and password_hash = crypt(p_current_password,password_hash)) into ok
  from public.employees where id=p_user_id and active=true and role<>'employee';
  if not coalesce(ok,false) then raise exception 'Current password is incorrect'; end if;
  update public.employees set password_hash=crypt(p_new_password,gen_salt('bf')) where id=p_user_id;
  return true;
end;
$function$;
CREATE OR REPLACE FUNCTION public.create_eso_employee(p_employee_no text, p_first_name text, p_last_name text, p_department_id uuid, p_role text, p_password text DEFAULT NULL::text, p_target integer DEFAULT 12)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare new_id uuid;
begin
 if p_role not in ('employee','maintenance','supervisor','admin','super_admin') then raise exception 'Invalid role'; end if;
 if p_role <> 'employee' and coalesce(length(p_password),0) < 6 then raise exception 'Password must be at least 6 characters'; end if;
 insert into public.employees(employee_no,first_name,last_name,department_id,role,password_hash,annual_eso_target,active)
 values(trim(p_employee_no),trim(p_first_name),trim(p_last_name),p_department_id,p_role,case when p_role='employee' then null else crypt(p_password,gen_salt('bf')) end,p_target,true)
 returning id into new_id;
 return new_id;
end;
$function$;
CREATE OR REPLACE FUNCTION public.platform_create_company(p_name text, p_code text, p_plan text, p_subscription_status text, p_plant_name text, p_plant_code text, p_admin_employee_no text, p_admin_first_name text, p_admin_last_name text, p_admin_password text)
 RETURNS TABLE(company_id uuid, plant_id uuid, admin_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_company uuid; v_plant uuid; v_admin uuid;
begin
if length(trim(coalesce(p_name,'')))=0 or length(trim(coalesce(p_code,'')))=0 then raise exception 'Company name and code are required.'; end if;
if length(trim(coalesce(p_plant_name,'')))=0 or length(trim(coalesce(p_plant_code,'')))=0 then raise exception 'First plant name and code are required.'; end if;
if length(trim(coalesce(p_admin_employee_no,'')))=0 then raise exception 'Super Admin Employee ID is required.'; end if;
if length(coalesce(p_admin_password,'')) < 6 then raise exception 'Super Admin password must be at least 6 characters.'; end if;
insert into public.companies(name,code,active,plan,subscription_status) values(trim(p_name),upper(trim(p_code)),true,coalesce(nullif(trim(p_plan),''),'Trial'),coalesce(nullif(trim(p_subscription_status),''),'trial')) returning id into v_company;
insert into public.plants(company_id,name,code,active) values(v_company,trim(p_plant_name),upper(trim(p_plant_code)),true) returning id into v_plant;
insert into public.employees(company_id,plant_id,employee_no,first_name,last_name,department_id,role,annual_eso_target,active,password_hash) values(v_company,v_plant,trim(p_admin_employee_no),trim(p_admin_first_name),trim(p_admin_last_name),null,'super_admin',12,true,crypt(p_admin_password,gen_salt('bf'))) returning id into v_admin;
return query select v_company,v_plant,v_admin;
end; $function$;
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.verify_eso_company_login(p_company_code text, p_employee_no text, p_password text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, employee_no text, first_name text, last_name text, role text, department_id uuid, department_name text, annual_eso_target integer, active boolean, company_id uuid, company_code text, company_name text, plant_id uuid, plant_code text, plant_name text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select e.id,e.employee_no,e.first_name,e.last_name,e.role,e.department_id,d.name,e.annual_eso_target,e.active,c.id,c.code,c.name,p.id,p.code,p.name
  from public.employees e
  join public.companies c on c.id=e.company_id and c.active=true
  join public.plants p on p.id=e.plant_id and p.company_id=c.id and p.active=true
  left join public.departments d on d.id=e.department_id
  where lower(c.code)=lower(trim(p_company_code)) and e.employee_no=trim(p_employee_no) and e.active=true
    and (e.role='employee' or (p_password is not null and e.password_hash is not null and e.password_hash=crypt(p_password,e.password_hash)))
  limit 1;
$function$;
CREATE OR REPLACE FUNCTION public.verify_eso_login(p_employee_no text, p_password text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, employee_no text, first_name text, last_name text, department_name text, role text, annual_eso_target integer, active boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select e.id,e.employee_no,e.first_name,e.last_name,d.name,e.role,e.annual_eso_target,e.active
  from public.employees e
  left join public.departments d on d.id=e.department_id
  where e.employee_no=p_employee_no and e.active=true
    and (
      e.role='employee'
      or
      (p_password is not null and e.password_hash is not null and e.password_hash = crypt(p_password,e.password_hash))
    )
  limit 1;
$function$;
CREATE OR REPLACE FUNCTION public.verify_eso_login_simple(p_employee_no text, p_password text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, employee_no text, first_name text, last_name text, department_name text, role text, annual_eso_target integer, active boolean, company_id uuid, plant_id uuid, company_code text, company_name text, plant_code text, plant_name text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select e.id,
         e.employee_no,
         e.first_name,
         e.last_name,
         d.name as department_name,
         e.role,
         e.annual_eso_target,
         e.active,
         e.company_id,
         e.plant_id,
         c.code as company_code,
         c.name as company_name,
         p.code as plant_code,
         p.name as plant_name
  from public.employees e
  left join public.departments d on d.id=e.department_id
  join public.companies c on c.id=e.company_id and c.active=true
  left join public.plants p on p.id=e.plant_id and p.active=true
  where e.employee_no=trim(p_employee_no)
    and e.active=true
    and (
      lower(e.role)='employee'
      or (
        p_password is not null
        and e.password_hash is not null
        and e.password_hash = crypt(p_password,e.password_hash)
      )
    )
  limit 1;
$function$;
CREATE OR REPLACE FUNCTION public.verify_eso_login_tenant(p_employee_no text, p_password text DEFAULT NULL::text, p_company_code text DEFAULT NULL::text, p_plant_code text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, employee_no text, first_name text, last_name text, role text, annual_eso_target integer, active boolean, department_name text, company_id uuid, company_name text, company_code text, plant_id uuid, plant_name text, plant_code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare matches integer;
begin
  if coalesce(trim(p_company_code),'')='' and coalesce(trim(p_plant_code),'')='' then
    select count(*) into matches from employees e where e.employee_no=trim(p_employee_no) and e.active=true;
    if matches<>1 then return; end if;
  end if;
  return query
  select e.id,e.employee_no,e.first_name,e.last_name,e.role,e.annual_eso_target,e.active,d.name,c.id,c.name,c.code,p.id,p.name,p.code
  from employees e join companies c on c.id=e.company_id and c.active=true join plants p on p.id=e.plant_id and p.company_id=c.id and p.active=true left join departments d on d.id=e.department_id
  where e.employee_no=trim(p_employee_no) and e.active=true
    and (coalesce(trim(p_company_code),'')='' or lower(c.code)=lower(trim(p_company_code)))
    and (coalesce(trim(p_plant_code),'')='' or lower(p.code)=lower(trim(p_plant_code)))
    and (e.role='employee' or (e.password_hash is not null and e.password_hash=crypt(coalesce(p_password,''),e.password_hash)))
  limit 1;
end $function$;
CREATE OR REPLACE FUNCTION public.verify_platform_owner_login(p_username text, p_password text)
 RETURNS TABLE(id uuid, username text, display_name text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$ select po.id,po.username,po.display_name from public.platform_owners po where lower(po.username)=lower(trim(p_username)) and po.active=true and po.password_hash=crypt(coalesce(p_password,''),po.password_hash) limit 1; $function$;
CREATE TRIGGER trg_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_reports_updated_at BEFORE UPDATE ON public.eso_reports FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON public.maintenance_tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
create view public.eso_tenant_integrity as  SELECT r.id AS eso_report_id,
    r.report_no,
    r.company_id AS report_company,
    e.company_id AS reporter_company,
    l.company_id AS location_company,
    t.company_id AS task_company,
    r.plant_id AS report_plant,
    e.plant_id AS reporter_plant,
    l.plant_id AS location_plant,
    t.plant_id AS task_plant
   FROM eso_reports r
     JOIN employees e ON e.id = r.reporter_id
     LEFT JOIN locations l ON l.id = r.location_id
     LEFT JOIN maintenance_tasks t ON t.eso_report_id = r.id;
grant all on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;
grant all on public."companies" to anon,authenticated;
alter table public."companies" enable row level security;
grant all on public."corrective_actions" to anon,authenticated;
alter table public."corrective_actions" enable row level security;
grant all on public."departments" to anon,authenticated;
alter table public."departments" enable row level security;
grant all on public."employees" to anon,authenticated;
alter table public."employees" enable row level security;
grant all on public."eso_attachments" to anon,authenticated;
alter table public."eso_attachments" enable row level security;
grant all on public."eso_reports" to anon,authenticated;
alter table public."eso_reports" enable row level security;
grant all on public."eso_status_history" to anon,authenticated;
alter table public."eso_status_history" enable row level security;
grant all on public."eso_tenant_integrity" to anon,authenticated;
grant all on public."locations" to anon,authenticated;
alter table public."locations" enable row level security;
grant all on public."maintenance_tasks" to anon,authenticated;
alter table public."maintenance_tasks" enable row level security;
grant all on public."notifications" to anon,authenticated;
alter table public."notifications" enable row level security;
grant all on public."plants" to anon,authenticated;
grant all on public."platform_owners" to anon,authenticated;
alter table public."push_subscriptions" enable row level security;
grant all on public."report_reclassification_history" to anon,authenticated;
alter table public."report_reclassification_history" enable row level security;
alter table public."task_reminder_events" enable row level security;
grant all on public."voe_reports" to anon,authenticated;
alter table public."voe_reports" enable row level security;
revoke execute on function public."admin_set_eso_password"(p_user_id uuid, p_new_password text) from public,anon,authenticated;
grant execute on function public."admin_set_eso_password"(p_user_id uuid, p_new_password text) to service_role;
revoke execute on function public."change_eso_password"(p_user_id uuid, p_current_password text, p_new_password text) from public,anon,authenticated;
grant execute on function public."change_eso_password"(p_user_id uuid, p_current_password text, p_new_password text) to service_role;
revoke execute on function public."create_eso_employee"(p_employee_no text, p_first_name text, p_last_name text, p_department_id uuid, p_role text, p_password text, p_target integer) from public,anon,authenticated;
grant execute on function public."create_eso_employee"(p_employee_no text, p_first_name text, p_last_name text, p_department_id uuid, p_role text, p_password text, p_target integer) to service_role;
revoke execute on function public."verify_eso_login"(p_employee_no text, p_password text) from public,anon,authenticated;
grant execute on function public."verify_eso_login"(p_employee_no text, p_password text) to service_role;
