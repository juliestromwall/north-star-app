-- Lock surrogate_profiles.profile_data once status='approved'
--
-- Problem: after an admin approves a profile, any stale client tab still
-- holding an older React state can autosave and overwrite profile_data
-- with a smaller/partial payload. Observed in prod 2026-04-21 when
-- Kimberly Miller's (id=195) profile was approved and then clobbered
-- from ~125 filled fields down to 7 four minutes later.
--
-- Fix: a BEFORE UPDATE trigger that raises an exception whenever
-- profile_data changes while status is already 'approved'. To edit an
-- approved profile legitimately, set status back to 'draft' or
-- 'pending_review' first.
--
-- This does NOT block status changes themselves (e.g. approved → draft)
-- and does NOT block edits to other columns.

CREATE OR REPLACE FUNCTION protect_approved_surrogate_profiles()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'approved'
     AND (OLD.profile_data IS DISTINCT FROM NEW.profile_data)
  THEN
    RAISE EXCEPTION
      'surrogate_profiles.profile_data is locked while status=''approved''. Set status to ''draft'' or ''pending_review'' before editing.'
      USING ERRCODE = '23514'; -- check_violation
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_approved_surrogate_profiles_trigger ON surrogate_profiles;

CREATE TRIGGER protect_approved_surrogate_profiles_trigger
BEFORE UPDATE ON surrogate_profiles
FOR EACH ROW
EXECUTE FUNCTION protect_approved_surrogate_profiles();
