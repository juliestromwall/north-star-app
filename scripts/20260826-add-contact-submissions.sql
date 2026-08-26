-- contact_submissions table — stores messages from the public marketing-site
-- "Contact Us" form (firststarsurrogacy.com), submitted via the
-- POST /api/contact Cloudflare Pages Function (functions/api/contact.js).
--
-- The function always emails the submission to hello@firststarsurrogacy.com
-- (overridable with CONTACT_NOTIFY_EMAIL); this table is a durable record on
-- top of that. The insert is fire-and-forget, so a missing table never blocks
-- the email — which is exactly what has been happening since the endpoint
-- landed on main without this migration.

CREATE TABLE IF NOT EXISTS contact_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  role text,                         -- 'parent' | 'surrogate' | 'other'
  message text,
  turnstile_verified boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'marketing-site',
  status text NOT NULL DEFAULT 'new', -- 'new' | 'read' | 'replied' | 'archived'
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contact_submissions_created_at_idx
  ON contact_submissions (created_at DESC);

-- RLS: only the service role (the Cloudflare Function) writes; the public form
-- never touches the DB directly.
--
-- Reads are gated on app_metadata.role, matching the pattern established in
-- 20260709-fix-intake-submissions-rls.sql. NOT `TO authenticated USING (true)`:
-- surrogates and IPs are authenticated Supabase users too (they sign in to the
-- portal), so a blanket authenticated-read would expose every marketing-site
-- lead's name, email, and message to any logged-in applicant. app_metadata is
-- service-role-only, so it can't be self-assigned the way user_metadata can.
--
-- `marketing` is included alongside the admin roles because these are
-- marketing-site leads (cf. MARKETING_ROLES in src/lib/constants.js).
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contact_submissions_read_authenticated ON contact_submissions;
DROP POLICY IF EXISTS contact_submissions_read_staff ON contact_submissions;
CREATE POLICY contact_submissions_read_staff
  ON contact_submissions FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN
      ('master_admin', 'super_admin', 'office_admin', 'admin', 'records_admin', 'marketing')
  );

-- Staff mark submissions read/replied/archived.
DROP POLICY IF EXISTS contact_submissions_update_staff ON contact_submissions;
CREATE POLICY contact_submissions_update_staff
  ON contact_submissions FOR UPDATE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN
      ('master_admin', 'super_admin', 'office_admin', 'admin', 'records_admin', 'marketing')
  );

DROP POLICY IF EXISTS contact_submissions_service_all ON contact_submissions;
CREATE POLICY contact_submissions_service_all
  ON contact_submissions FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
