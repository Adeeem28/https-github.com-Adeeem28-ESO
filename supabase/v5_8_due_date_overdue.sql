-- ESO V5.8 — Due Dates & Overdue Corrective Actions
-- The maintenance_tasks.due_at column already exists in the core schema.
-- This partial index accelerates active overdue / due-soon task queries.
create index if not exists idx_maintenance_tasks_due_active
  on public.maintenance_tasks(company_id, plant_id, due_at)
  where status <> 'completed' and due_at is not null;
