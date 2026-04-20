-- Staff contracts anchor multi-year salary obligations for hired coaches and
-- scouts. The derived committed-budget query (JooqStaffBudgetRepository) reads
-- this table plus outstanding candidate_offers to compute a team's cap use.
-- Firing mid-contract sets terminated_at_season; remaining guarantee becomes
-- dead cap in subsequent seasons.

CREATE TABLE staff_contracts (
    id BIGSERIAL PRIMARY KEY,
    team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    candidate_id BIGINT NOT NULL REFERENCES candidates(id),
    team_staff_id BIGINT NOT NULL REFERENCES team_staff(id) ON DELETE CASCADE,
    apy_cents BIGINT NOT NULL,
    guarantee_cents BIGINT NOT NULL,
    contract_years INTEGER NOT NULL,
    start_season INTEGER NOT NULL,
    end_season INTEGER NOT NULL,
    terminated_at_season INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (apy_cents > 0),
    CHECK (guarantee_cents >= 0),
    CHECK (contract_years > 0),
    CHECK (end_season >= start_season),
    CHECK (terminated_at_season IS NULL OR terminated_at_season BETWEEN start_season AND end_season)
);

CREATE INDEX staff_contracts_team_idx ON staff_contracts (team_id);
CREATE INDEX staff_contracts_team_season_idx ON staff_contracts (team_id, start_season, end_season);
CREATE UNIQUE INDEX staff_contracts_team_staff_unique ON staff_contracts (team_staff_id);
