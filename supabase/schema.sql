-- Production database starter schema for ESO Management System.
-- Run this in the Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  employee_id text unique not null,
  full_name text not null,
  department_id uuid references departments(id),
  role text not null check (role in ('Employee','Maintenance','Admin','Super Admin')),
  password_hash text,
  annual_target integer not null default 12,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists eso_reports (
  id uuid primary key default gen_random_uuid(),
  eso_no text unique not null,
  reporter_id uuid not null references employees(id),
  created_at timestamptz not null default now(),
  location text not null,
  category text not null check (category in ('Safety','Environmental')),
  urgency text not null check (urgency in ('Low','Medium','High','Critical')),
  description text not null,
  attachment_path text,
  status text not null default 'Open' check (status in ('Open','In Progress','Completed')),
  assigned_to uuid references employees(id),
  corrective_action text,
  completed_at timestamptz
);

create index if not exists idx_eso_reporter on eso_reports(reporter_id);
create index if not exists idx_eso_status on eso_reports(status);
create index if not exists idx_eso_created on eso_reports(created_at desc);

insert into storage.buckets (id, name, public)
values ('eso-attachments', 'eso-attachments', false)
on conflict (id) do nothing;

-- IMPORTANT: Before production, configure RLS/auth policies according to company rules.
