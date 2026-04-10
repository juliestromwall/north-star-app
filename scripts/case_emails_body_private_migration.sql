-- Migration: add body_html and is_private to case_emails
-- Run in Supabase SQL Editor

ALTER TABLE case_emails ADD COLUMN IF NOT EXISTS body_html text;
ALTER TABLE case_emails ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_case_emails_is_private ON case_emails(is_private);
