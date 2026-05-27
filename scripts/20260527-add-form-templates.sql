-- form_templates table for the in-app form builder (/forms)
--
-- Backs the /forms list page + /forms/builder editor + /forms/:id/submit
-- renderer. Replaces the in-memory mockFormDefinitions so admin edits
-- actually persist across reloads.
--
-- Schema mirrors the existing mock shape so the seed migration below is
-- a straight copy from src/data/mock/forms.js — no field renames.

CREATE TABLE IF NOT EXISTS form_templates (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft', -- 'draft' | 'published' | 'archived'
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  assigned_roles text[] DEFAULT ARRAY[]::text[],
  submission_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Touch updated_at on every UPDATE so list views can sort by recency
CREATE OR REPLACE FUNCTION touch_form_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS form_templates_touch ON form_templates;
CREATE TRIGGER form_templates_touch
BEFORE UPDATE ON form_templates
FOR EACH ROW EXECUTE FUNCTION touch_form_templates_updated_at();

-- RLS: any signed-in user can read (so surrogates can load forms assigned
-- to them); any signed-in user can write (admin gating happens in the app
-- layer via getNavForRole — defense-in-depth tightening is a follow-up).
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS form_templates_read_authenticated ON form_templates;
CREATE POLICY form_templates_read_authenticated
  ON form_templates FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS form_templates_write_authenticated ON form_templates;
CREATE POLICY form_templates_write_authenticated
  ON form_templates FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- Service role can always read/write (used by Cloudflare Functions if any
-- form-template API endpoints get built later).
DROP POLICY IF EXISTS form_templates_service_all ON form_templates;
CREATE POLICY form_templates_service_all
  ON form_templates FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
