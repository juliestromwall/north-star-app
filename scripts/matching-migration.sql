-- Matching & Journeys Migration
-- Run this in Supabase SQL Editor

-- ── Matched Journeys ──────────────────────────────────────
create table if not exists matched_journeys (
  id bigint generated always as identity primary key,
  gc_case_id bigint not null,
  ip_case_id bigint not null,
  stage text not null default 'journey-oversight',
  status text not null default 'Legal Review',
  assigned_to text,
  journey_data jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table matched_journeys enable row level security;
create policy "matched_journeys_all" on matched_journeys for all using (true);

-- ── Profile Shares (secure links) ────────────────────────
create table if not exists profile_shares (
  id bigint generated always as identity primary key,
  token text unique not null,
  case_id bigint not null,
  case_type text not null,
  shared_by text,
  shared_by_email text,
  shared_to_email text,
  shared_to_name text,
  message text,
  expires_at timestamptz not null,
  viewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index profile_shares_token_idx on profile_shares (token);

alter table profile_shares enable row level security;
create policy "profile_shares_all" on profile_shares for all using (true);

-- ── Match Questions ───────────────────────────────────────
create table if not exists match_questions (
  id bigint generated always as identity primary key,
  share_id bigint references profile_shares(id) on delete set null,
  journey_id bigint references matched_journeys(id) on delete set null,
  case_id bigint,
  case_type text,
  asker_name text,
  asker_email text,
  question text not null,
  answer text,
  answered_by text,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

alter table match_questions enable row level security;
create policy "match_questions_all" on match_questions for all using (true);

-- ── Journey Notes (with labels for shared/gc/ip) ─────────
create table if not exists journey_notes (
  id bigint generated always as identity primary key,
  journey_id bigint references matched_journeys(id) on delete cascade not null,
  note_type text not null default 'shared',
  content text not null,
  created_by text,
  created_by_email text,
  updated_at timestamptz,
  created_at timestamptz not null default now()
);

alter table journey_notes enable row level security;
create policy "journey_notes_all" on journey_notes for all using (true);
