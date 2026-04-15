-- Expense enhancements: escrow flow, payment tracking
-- Run this in Supabase SQL Editor

-- Add new columns to journey_expenses
ALTER TABLE journey_expenses ADD COLUMN IF NOT EXISTS escrow_opened boolean DEFAULT true;
ALTER TABLE journey_expenses ADD COLUMN IF NOT EXISTS pay_to_type text; -- 'surrogate', 'ip1', 'ip2', 'other'
ALTER TABLE journey_expenses ADD COLUMN IF NOT EXISTS pay_via text; -- 'venmo', 'zelle'
ALTER TABLE journey_expenses ADD COLUMN IF NOT EXISTS pay_via_info text; -- username/phone
ALTER TABLE journey_expenses ADD COLUMN IF NOT EXISTS needs_payment boolean DEFAULT false;
ALTER TABLE journey_expenses ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE journey_expenses ADD COLUMN IF NOT EXISTS paid_by text;
