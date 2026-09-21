-- ESO V5.9.1 — Push subscriptions + escalation delivery tracking
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  plant_id uuid not null references public.plants(id) on delete cascade,
  user_id uuid not null references public.employees(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, endpoint)
);
create index if not exists idx_push_subscriptions_user_active on public.push_subscriptions(user_id,active);
create index if not exists idx_push_subscriptions_company_plant on public.push_subscriptions(company_id,plant_id);

create table if not exists public.task_reminder_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  plant_id uuid not null references public.plants(id) on delete cascade,
  maintenance_task_id uuid not null references public.maintenance_tasks(id) on delete cascade,
  event_key text not null,
  sent_at timestamptz not null default now(),
  unique(maintenance_task_id,event_key)
);
create index if not exists idx_task_reminder_events_task on public.task_reminder_events(maintenance_task_id);

alter table public.push_subscriptions enable row level security;
alter table public.task_reminder_events enable row level security;
-- These tables are accessed only by the server with the Supabase secret/service role.
revoke all on public.push_subscriptions from anon, authenticated;
revoke all on public.task_reminder_events from anon, authenticated;
