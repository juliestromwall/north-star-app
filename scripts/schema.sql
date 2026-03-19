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
