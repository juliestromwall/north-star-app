-- ─────────────────────────────────────────────────────────────────────────
-- Fix: staff cannot see intake_submissions (IP + surrogate applicants)
-- ─────────────────────────────────────────────────────────────────────────
--
-- ROOT CAUSE
-- The SELECT/UPDATE policies on intake_submissions require:
--     (auth.jwt() -> 'app_metadata' ->> 'role') = 'master_admin'
-- but the app stores each user's role in **user_metadata**, not app_metadata
-- (see invite.js / update-admin.js / _auth.js). It also only allowed the single
-- 'master_admin' role. Net effect: no admin JWT ever matches, so every admin's
-- read of intake_submissions returns zero rows — which is why both the IP
-- dashboard and the qualified-surrogate roster show up empty. The rows are
-- present and correct (status defaults to 'qualified'); they were just hidden.
--
-- WHY app_metadata (not user_metadata)
-- user_metadata IS user-editable (a logged-in portal user can change their own
-- via supabase.auth.updateUser). Trusting it in an RLS policy would let any
-- portal user (surrogate/IP) self-assign an admin role and read all applicant
-- PII. app_metadata can only be set with the service role, so it is the correct
-- source of truth for authorization.
--
-- This migration:
--   1) Backfills app_metadata.role from user_metadata.role for existing users.
--   2) Replaces the SELECT/UPDATE policies to allow all staff roles via app_metadata.
--
-- NOTE: app_metadata changes take effect on the user's NEXT login / token
-- refresh. Existing signed-in staff must log out and back in to pick up the new
-- claim. New/edited staff are handled going forward by the paired code changes
-- in invite.js and update-admin.js (they now also write app_metadata.role).
-- ─────────────────────────────────────────────────────────────────────────

-- 1) Backfill app_metadata.role from user_metadata.role (only where it differs).
update auth.users
set raw_app_meta_data =
      coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', raw_user_meta_data ->> 'role')
where raw_user_meta_data ->> 'role' is not null
  and (raw_app_meta_data ->> 'role') is distinct from (raw_user_meta_data ->> 'role');

-- 2) Broaden the read policy to all staff roles (checked via app_metadata).
drop policy if exists "Master admins can view intake submissions" on intake_submissions;
create policy "Staff can view intake submissions"
  on intake_submissions for select using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in
      ('master_admin', 'super_admin', 'office_admin', 'admin', 'records_admin')
  );

-- 3) Same for updates (admins mark applicants qualified, change stage, etc.).
drop policy if exists "Master admins can update intake submissions" on intake_submissions;
create policy "Staff can update intake submissions"
  on intake_submissions for update using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in
      ('master_admin', 'super_admin', 'office_admin', 'admin', 'records_admin')
  );

-- The existing INSERT policy ("Anyone can insert intake submissions") is left
-- unchanged so the public intake form keeps working.
