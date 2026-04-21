-- ── Admin Note Replies ───────────────────────────────────
-- Private 1:1 replies from a note recipient back to the original author.
-- Visibility: the replier sees their own reply (confirmation); the note author
-- sees all replies to their notes; master admins see everything. Other
-- recipients of the same broadcast note cannot see anyone else's replies.

create table if not exists admin_note_replies (
  id bigint generated always as identity primary key,
  note_id bigint references admin_notes(id) on delete cascade not null,
  replied_by uuid references auth.users(id) not null default auth.uid(),
  replied_by_name text,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_note_replies_note_id_idx on admin_note_replies (note_id);
create index if not exists admin_note_replies_replied_by_idx on admin_note_replies (replied_by);

alter table admin_note_replies enable row level security;

-- Anyone who can currently see the parent note may reply to it
create policy "Users can insert their own replies"
  on admin_note_replies for insert
  with check (
    auth.uid() = replied_by
    and exists (
      select 1 from admin_notes
      where admin_notes.id = admin_note_replies.note_id
        and admin_notes.is_active = true
        and (
          admin_notes.target_user_ids is null
          or auth.uid() = any(admin_notes.target_user_ids)
        )
    )
  );

-- Replier can see their own replies (so the UI can confirm they sent it)
create policy "Users can view their own replies"
  on admin_note_replies for select
  using (auth.uid() = replied_by);

-- Note author can see all replies to their notes
create policy "Note authors can view replies to their notes"
  on admin_note_replies for select
  using (
    exists (
      select 1 from admin_notes
      where admin_notes.id = admin_note_replies.note_id
        and admin_notes.created_by = auth.uid()
    )
  );

-- Master admins see everything
create policy "Master admins can view all replies"
  on admin_note_replies for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'master_admin');

create policy "Master admins can delete any reply"
  on admin_note_replies for delete
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'master_admin');
