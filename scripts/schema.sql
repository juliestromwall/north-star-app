-- ABC Surrogacy — Supabase Schema
-- Run this in Supabase SQL Editor to set up the database

-- ── Admin Notes ──────────────────────────────────────────

create table admin_notes (
  id bigint generated always as identity primary key,
  created_by uuid references auth.users(id) not null default auth.uid(),
  title text,
  message text not null,
  target_user_ids uuid[],
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table admin_notes enable row level security;

create policy "Master admins can do everything with notes"
  on admin_notes for all using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'master_admin'
  );

create policy "Admin-role users can view active notes targeting them"
  on admin_notes for select using (
    is_active = true
    and (
      target_user_ids is null
      or auth.uid() = any(target_user_ids)
    )
  );

-- ── Admin Note Dismissals ────────────────────────────────

create table admin_note_dismissals (
  id bigint generated always as identity primary key,
  note_id bigint references admin_notes(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null default auth.uid(),
  dismissed_at timestamptz not null default now(),
  unique (note_id, user_id)
);

alter table admin_note_dismissals enable row level security;

create policy "Users can view own dismissals"
  on admin_note_dismissals for select using (auth.uid() = user_id);

create policy "Users can insert own dismissals"
  on admin_note_dismissals for insert with check (auth.uid() = user_id);

create policy "Master admins can view all dismissals"
  on admin_note_dismissals for select using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'master_admin'
  );

-- ── Intake Submissions ───────────────────────────────────

create table intake_submissions (
  id bigint generated always as identity primary key,
  intake_type text not null check (intake_type in ('gc', 'ip')),
  qualified boolean not null,
  dq_reasons text[] not null default '{}',
  applicant_name text not null,
  applicant_email text not null,
  applicant_phone text not null,
  country text,
  state_region text,
  city text,
  zip_postal_code text,
  answers jsonb not null,
  tracking jsonb not null default '{}'::jsonb,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  fbclid text,
  ttclid text,
  resolved_source text,
  referrer text,
  user_agent text,
  status text not null default 'qualified',
  submitted_at timestamptz not null default now()
);

create index intake_submissions_submitted_at_idx on intake_submissions (submitted_at desc);
create index intake_submissions_type_idx on intake_submissions (intake_type);
create index intake_submissions_resolved_source_idx on intake_submissions (resolved_source);
create index intake_submissions_utm_source_idx on intake_submissions (utm_source);

alter table intake_submissions enable row level security;

create policy "Anyone can insert intake submissions"
  on intake_submissions for insert with check (true);

create policy "Master admins can view intake submissions"
  on intake_submissions for select using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'master_admin'
  );

create policy "Master admins can update intake submissions"
  on intake_submissions for update using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'master_admin'
  );

-- ── Case Documents ──────────────────────────────────────────

create table case_documents (
  id bigint generated always as identity primary key,
  surrogate_id bigint references intake_submissions(id) on delete cascade not null,
  category text not null,
  file_name text not null,
  file_type text,
  file_size bigint,
  storage_path text not null,
  public_url text not null,
  uploaded_by text,
  created_at timestamptz not null default now()
);

create index case_documents_surrogate_id_idx on case_documents (surrogate_id);

alter table case_documents enable row level security;

create policy "Admins can do everything with case documents"
  on case_documents for all using (true);

-- ── Case Notes ─────────────────────────────────────────────

create table case_notes (
  id bigint generated always as identity primary key,
  surrogate_id bigint references intake_submissions(id) on delete cascade not null,
  author_name text not null,
  author_email text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index case_notes_surrogate_id_idx on case_notes (surrogate_id);

alter table case_notes enable row level security;

create policy "Admins can do everything with case notes"
  on case_notes for all using (true);

-- ── App Config (shared key-value store) ─────────────────────
-- Run this in Supabase SQL Editor

create table app_config (
  id bigint generated always as identity primary key,
  config_key text unique not null,
  config_value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table app_config enable row level security;

create policy "Anyone can read app_config"
  on app_config for select using (true);

create policy "Anyone can insert app_config"
  on app_config for insert with check (true);

create policy "Anyone can update app_config"
  on app_config for update using (true);

-- ── E-Signature Templates ─────────────────────────────────

create table esign_templates (
  id bigint generated always as identity primary key,
  name text not null,
  category text default 'General',
  description text,
  file_path text not null,
  file_name text not null,
  file_size bigint,
  google_doc_id text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table esign_templates enable row level security;
create policy "Anyone can manage esign_templates" on esign_templates for all using (true);

-- ── E-Signature Documents (sent for signing) ──────────────

create table esign_documents (
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
create policy "Anyone can manage esign_documents" on esign_documents for all using (true);

-- ── E-Signature Audit Log ─────────────────────────────────

create table esign_audit_log (
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
create policy "Anyone can manage esign_audit_log" on esign_audit_log for all using (true);

-- ── Google OAuth Tokens ─────────────────────────────────

create table google_tokens (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  google_email text not null,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  scopes text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index google_tokens_user_id_idx on google_tokens (user_id);

alter table google_tokens enable row level security;

create policy "Users can view own google tokens"
  on google_tokens for select using (auth.uid() = user_id);

create policy "Service role can manage all tokens"
  on google_tokens for all using (true);

-- ── Case Emails (logged Gmail messages) ─────────────────

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
