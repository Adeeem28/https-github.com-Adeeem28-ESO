-- Reference migration for ESO Management System v4.
-- Already applied to the connected ESO Supabase project.

alter table public.employees drop constraint if exists employees_role_check;
alter table public.employees add constraint employees_role_check
check (role in ('employee','maintenance','supervisor','management','admin','super_admin'));

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.employees(id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  eso_report_id uuid references public.eso_reports(id) on delete cascade,
  maintenance_task_id uuid references public.maintenance_tasks(id) on delete cascade,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user_unread
  on public.notifications(user_id,is_read,created_at desc);
alter table public.notifications enable row level security;
