-- Add google_doc_id column to esign_templates
-- Run this in Supabase SQL Editor

ALTER TABLE esign_templates ADD COLUMN IF NOT EXISTS google_doc_id text;
