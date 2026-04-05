-- Add tag column to case_emails for categorization
ALTER TABLE case_emails ADD COLUMN IF NOT EXISTS tag text;

-- Index for fast tag filtering
CREATE INDEX IF NOT EXISTS idx_case_emails_tag ON case_emails(tag);
