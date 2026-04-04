-- Case/Journey Tasks
create table if not exists case_tasks (
  id bigint generated always as identity primary key,
  case_id bigint,
  case_type text not null default 'surrogate', -- surrogate, ip, journey
  title text not null,
  description text,
  status text not null default 'open', -- open, in_progress, complete
  priority text not null default 'normal', -- low, normal, high, urgent
  due_date date,
  assigned_to text, -- admin email
  created_by text,
  completed_at timestamptz,
  completed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table case_tasks enable row level security;
create policy "case_tasks_all" on case_tasks for all using (true);

-- Index for fast lookups
create index if not exists idx_case_tasks_case on case_tasks(case_id, case_type);
create index if not exists idx_case_tasks_assigned on case_tasks(assigned_to, status);
