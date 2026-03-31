-- E-Signature Migration
-- Run this in Supabase SQL Editor to add e-signature tables

-- Templates
create table if not exists esign_templates (
  id bigint generated always as identity primary key,
  name text not null,
  category text default 'General',
  description text,
  file_path text not null,
  file_name text not null,
  file_size bigint,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table esign_templates enable row level security;
create policy "esign_templates_all" on esign_templates for all using (true);

-- Documents sent for signing
create table if not exists esign_documents (
  id bigint generated always as identity primary key,
  template_id bigint references esign_templates(id),
  case_id bigint,
  case_type text,
  title text not null,
  status text not null default 'draft',
  signers jsonb not null default '[]'::jsonb,
  file_path text,
  document_hash text,
  created_by text,
  sent_at timestamptz,
  completed_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz not null default now()
);
alter table esign_documents enable row level security;
create policy "esign_documents_all" on esign_documents for all using (true);

-- Audit log
create table if not exists esign_audit_log (
  id bigint generated always as identity primary key,
  document_id bigint references esign_documents(id) on delete cascade,
  action text not null,
  actor_name text,
  actor_email text,
  actor_role text,
  ip_address text,
  user_agent text,
  details jsonb,
  created_at timestamptz not null default now()
);
alter table esign_audit_log enable row level security;
create policy "esign_audit_log_all" on esign_audit_log for all using (true);

-- Storage bucket for e-signature files
insert into storage.buckets (id, name, public) values ('esign-documents', 'esign-documents', true)
on conflict (id) do nothing;
