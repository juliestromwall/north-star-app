-- Add "Not Needed" state to journey_expenses for the Submitted-to-Escrow
-- disposition column. Admins can now mark a row as:
--   • Escrow Not Funded (default — submitted_to_escrow=false, escrow_not_needed=false)
--   • Yes              (submitted_to_escrow=true)
--   • Not Needed       (escrow_not_needed=true) — row displays green
-- Paid is a further end-state set via disbursement_paid_at.

ALTER TABLE journey_expenses
  ADD COLUMN IF NOT EXISTS escrow_not_needed boolean NOT NULL DEFAULT false;
