-- Add signing token to esign_documents for secure URLs
ALTER TABLE esign_documents ADD COLUMN IF NOT EXISTS signing_token text UNIQUE;

-- Create index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_esign_documents_signing_token ON esign_documents(signing_token);
