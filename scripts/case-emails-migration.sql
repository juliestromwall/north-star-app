-- Case Emails Migration
-- Run this in Supabase SQL Editor

create table if not exists case_emails (
  id bigint generated always as identity primary key,
  gmail_message_id text,
  gmail_thread_id text,
  case_id bigint not null,
  case_type text,
  subject text,
  from_address text,
  to_address text,
  date timestamptz,
  snippet text,
  logged_by text,
  logged_by_name text,
  created_at timestamptz not null default now()
);

alter table case_emails enable row level security;
create policy "case_emails_all" on case_emails for all using (true);

create index case_emails_case_id_idx on case_emails (case_id);
