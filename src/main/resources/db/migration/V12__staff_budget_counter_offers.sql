-- Staff salary budget per team, season tracking on leagues, and counter-offer
-- support on candidate_offers. Budget enforcement and counter-offer flow are
-- described in docs/technical/staff-market-implementation.md.

-- Season number on the league. Existing leagues are year 1.
ALTER TABLE leagues ADD COLUMN season INTEGER NOT NULL DEFAULT 1;
ALTER TABLE leagues ADD CONSTRAINT leagues_season_check CHECK (season >= 1);

-- Per-team staff salary budget. Seeded at league creation by application code;
-- migration default is 0 so pre-existing teams fall out of budget checks until
-- backfilled (no production data yet).
ALTER TABLE teams ADD COLUMN staff_budget_cents BIGINT NOT NULL DEFAULT 0;
ALTER TABLE teams ADD CONSTRAINT teams_staff_budget_cents_check CHECK (staff_budget_cents >= 0);

-- Counter-offer columns. Both set together when an offer flips to COUNTER_PENDING,
-- both cleared when the counter resolves.
ALTER TABLE candidate_offers ADD COLUMN competing_offer_id BIGINT
    REFERENCES candidate_offers(id) ON DELETE SET NULL;
ALTER TABLE candidate_offers ADD COLUMN counter_deadline_day INTEGER;
ALTER TABLE candidate_offers ADD CONSTRAINT candidate_offers_counter_pair_check
    CHECK ((competing_offer_id IS NULL) = (counter_deadline_day IS NULL));

-- Expand the status enum to include COUNTER_PENDING.
ALTER TABLE candidate_offers DROP CONSTRAINT candidate_offers_status_check;
ALTER TABLE candidate_offers ADD CONSTRAINT candidate_offers_status_check
    CHECK (status IN ('ACTIVE', 'ACCEPTED', 'REJECTED', 'COUNTER_PENDING'));

-- Update the "one outstanding offer per (candidate, team)" uniqueness to cover
-- COUNTER_PENDING. A team with a pending counter shouldn't also have a second
-- live offer on the same candidate.
DROP INDEX candidate_offers_one_active_per_team;
CREATE UNIQUE INDEX candidate_offers_one_outstanding_per_team
    ON candidate_offers (candidate_id, team_id)
    WHERE status IN ('ACTIVE', 'COUNTER_PENDING');
