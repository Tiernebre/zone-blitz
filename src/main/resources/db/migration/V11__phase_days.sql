-- Switch phase accounting from weeks to days. Hiring phases are now 21-day windows
-- and the Advance button moves the clock forward one day at a time.
ALTER TABLE leagues RENAME COLUMN phase_week TO phase_day;

ALTER TABLE team_interviews RENAME COLUMN phase_week TO phase_day;
ALTER INDEX team_interviews_team_week_idx RENAME TO team_interviews_team_day_idx;

ALTER TABLE candidate_offers RENAME COLUMN submitted_at_week TO submitted_at_day;

ALTER TABLE team_staff RENAME COLUMN hired_at_week TO hired_at_day;
