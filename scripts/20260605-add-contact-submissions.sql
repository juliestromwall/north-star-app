-- contact_submissions table — stores messages from the public marketing-site
-- "Contact Us" form (northstarsurrogacy.com), submitted via the
-- POST /api/contact Cloudflare Pages Function (functions/api/contact.js).
--
-- The function always emails the submission to hello@northstarsurrogacy.com;
-- this table is a durable record on top of that (the insert is fire-and-forget,
-- so a missing table never blocks the email).

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

-- RLS: signed-in users (admins) can read; only the service role (the
-- Cloudflare Function) writes. The public form never touches the DB directly.
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contact_submissions_read_authenticated ON contact_submissions;
CREATE POLICY contact_submissions_read_authenticated
  ON contact_submissions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS contact_submissions_service_all ON contact_submissions;
CREATE POLICY contact_submissions_service_all
  ON contact_submissions FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
