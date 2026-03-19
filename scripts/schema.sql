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
