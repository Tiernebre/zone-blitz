-- Add human-readable first/last name to every candidate. Pre-v1; no prod data
-- to preserve. Wipe existing candidate-derived rows so the new NOT NULL columns
-- can land without a backfill — transition handlers will regenerate pools on
-- next phase entry.

TRUNCATE TABLE candidates RESTART IDENTITY CASCADE;
TRUNCATE TABLE candidate_pools RESTART IDENTITY CASCADE;

ALTER TABLE candidates
    ADD COLUMN first_name TEXT NOT NULL,
    ADD COLUMN last_name TEXT NOT NULL;
