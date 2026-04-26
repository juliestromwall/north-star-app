-- Tandem Journey Migration
-- Adds a self-referential pointer so two matched_journeys rows for the
-- SAME IP can be linked as a "tandem" pair (one IP, two surrogates running
-- in parallel). The pointer goes in both directions — when admin links
-- journey A↔B, both rows store each other's id. Clearing one clears both.
--
-- Run in Supabase SQL Editor for both staging and prod.

alter table matched_journeys
  add column if not exists tandem_partner_journey_id bigint
    references matched_journeys(id) on delete set null;

create index if not exists matched_journeys_tandem_idx
  on matched_journeys (tandem_partner_journey_id);

-- Reload PostgREST schema cache so the new column is exposed via REST.
notify pgrst, 'reload schema';
