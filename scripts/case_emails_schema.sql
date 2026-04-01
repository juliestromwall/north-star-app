-- Case Emails — logs Gmail messages to surrogacy cases
-- Run this in Supabase SQL Editor

create table case_emails (
  id bigint generated always as identity primary key,
  gmail_message_id text not null,
  gmail_thread_id text,
  case_id bigint references intake_submissions(id) on delete cascade,
  case_type text check (case_type in ('gc', 'ip', 'journey')),
  journey_id text,
  subject text,
  from_address text,
  to_address text,
  date timestamptz,
  snippet text,
  logged_by uuid references auth.users(id),
  logged_by_name text,
  created_at timestamptz not null default now()
);

create index case_emails_case_id_idx on case_emails (case_id);
create index case_emails_gmail_id_idx on case_emails (gmail_message_id);

alter table case_emails enable row level security;

create policy "Admins can manage case emails"
  on case_emails for all using (true);
