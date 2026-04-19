-- Per-franchise interview events against pool candidates. Each row represents
-- one completed interview. interview_index is the 1-based count for that
-- (franchise, candidate) pair and drives the noise-reduction function. Weekly
-- capacity is enforced by counting rows per (franchise, phase, phase_week).
CREATE TABLE franchise_interviews (
    id BIGSERIAL PRIMARY KEY,
    league_id BIGINT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    franchise_id BIGINT NOT NULL REFERENCES franchises(id),
    candidate_id BIGINT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    phase TEXT NOT NULL,
    phase_week INTEGER NOT NULL,
    interview_index INTEGER NOT NULL,
    scouted_overall NUMERIC(5, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (phase_week > 0),
    CHECK (interview_index > 0),
    UNIQUE (league_id, franchise_id, candidate_id, interview_index)
);

CREATE INDEX franchise_interviews_league_franchise_phase_idx
    ON franchise_interviews (league_id, franchise_id, phase);
CREATE INDEX franchise_interviews_league_franchise_week_idx
    ON franchise_interviews (league_id, franchise_id, phase, phase_week);
CREATE INDEX franchise_interviews_candidate_idx
    ON franchise_interviews (candidate_id);
