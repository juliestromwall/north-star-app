-- Lock intake_submissions inserts down to the service role.
-- Apply manually in Supabase after the /api/intake-submit endpoint is deployed.

drop policy if exists "Anyone can insert intake submissions" on intake_submissions;

create policy "Service role can insert intake submissions"
  on intake_submissions
  for insert
  to service_role
  with check (true);
