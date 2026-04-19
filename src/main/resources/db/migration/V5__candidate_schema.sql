-- Candidate domain + preferences schema.
-- Models the league-wide candidate pool, per-candidate preferences, offers,
-- per-franchise hiring state, and terminal franchise staff hires.
-- See docs/technical/league-phases.md (Candidate pool, Specialty, Archetype,
-- Age & experience, Candidate preferences, Persistence sections).

-- Pool of candidates generated once per (league, phase, candidate_type).
CREATE TABLE candidate_pools (
    id BIGSERIAL PRIMARY KEY,
    league_id BIGINT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    phase TEXT NOT NULL,
    candidate_type TEXT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (league_id, phase, candidate_type),
    CHECK (candidate_type IN ('HEAD_COACH', 'DIRECTOR_OF_SCOUTING', 'COORDINATOR', 'POSITION_COACH', 'SCOUT'))
);

CREATE INDEX candidate_pools_league_phase_idx
    ON candidate_pools (league_id, phase);

-- Candidate rows live inside a pool. Hidden attrs are never shown to the user;
-- scouted attrs are the noised estimate. hired_by_franchise_id is set when a
-- franchise signs the candidate; scout_branch is only populated for scouts.
CREATE TABLE candidates (
    id BIGSERIAL PRIMARY KEY,
    pool_id BIGINT NOT NULL REFERENCES candidate_pools(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    specialty_position TEXT NOT NULL,
    archetype TEXT NOT NULL,
    age INTEGER NOT NULL,
    total_experience_years INTEGER NOT NULL,
    experience_by_role JSONB NOT NULL DEFAULT '{}'::jsonb,
    hidden_attrs JSONB NOT NULL DEFAULT '{}'::jsonb,
    scouted_attrs JSONB NOT NULL DEFAULT '{}'::jsonb,
    hired_by_franchise_id BIGINT REFERENCES franchises(id),
    scout_branch TEXT,
    CHECK (kind IN ('HEAD_COACH', 'DIRECTOR_OF_SCOUTING', 'OFFENSIVE_COORDINATOR',
                    'DEFENSIVE_COORDINATOR', 'SPECIAL_TEAMS_COORDINATOR', 'POSITION_COACH', 'SCOUT')),
    CHECK (specialty_position IN ('QB', 'RB', 'FB', 'WR', 'TE', 'OL', 'DL', 'EDGE',
                                  'LB', 'CB', 'S', 'K', 'P', 'LS')),
    CHECK (archetype IN (
        'CEO', 'OFFENSIVE_PLAY_CALLER', 'DEFENSIVE_PLAY_CALLER',
        'OFFENSIVE_GURU', 'DEFENSIVE_GURU', 'TEACHER', 'TACTICIAN',
        'COLLEGE_EVALUATOR', 'PRO_EVALUATOR', 'GENERALIST'
    )),
    CHECK (age BETWEEN 20 AND 90),
    CHECK (total_experience_years >= 0),
    CHECK (scout_branch IS NULL OR scout_branch IN ('COLLEGE', 'PRO'))
);

CREATE INDEX candidates_pool_idx ON candidates (pool_id);
CREATE INDEX candidates_hired_by_idx ON candidates (hired_by_franchise_id)
    WHERE hired_by_franchise_id IS NOT NULL;

-- Wide preferences table. One row per candidate; one (target, weight) pair per
-- dimension. Weights normalized 0..1 across dimensions by the generator.
CREATE TABLE candidate_preferences (
    candidate_id BIGINT PRIMARY KEY REFERENCES candidates(id) ON DELETE CASCADE,

    compensation_target NUMERIC(12, 2) NOT NULL,
    compensation_weight NUMERIC(4, 3) NOT NULL,

    contract_length_target INTEGER NOT NULL,
    contract_length_weight NUMERIC(4, 3) NOT NULL,

    guaranteed_money_target NUMERIC(4, 3) NOT NULL,
    guaranteed_money_weight NUMERIC(4, 3) NOT NULL,

    market_size_target TEXT NOT NULL,
    market_size_weight NUMERIC(4, 3) NOT NULL,

    geography_target TEXT NOT NULL,
    geography_weight NUMERIC(4, 3) NOT NULL,

    climate_target TEXT NOT NULL,
    climate_weight NUMERIC(4, 3) NOT NULL,

    franchise_prestige_target NUMERIC(5, 2) NOT NULL,
    franchise_prestige_weight NUMERIC(4, 3) NOT NULL,

    competitive_window_target TEXT NOT NULL,
    competitive_window_weight NUMERIC(4, 3) NOT NULL,

    role_scope_target TEXT NOT NULL,
    role_scope_weight NUMERIC(4, 3) NOT NULL,

    staff_continuity_target TEXT NOT NULL,
    staff_continuity_weight NUMERIC(4, 3) NOT NULL,

    scheme_alignment_target TEXT NOT NULL,
    scheme_alignment_weight NUMERIC(4, 3) NOT NULL,

    owner_stability_target NUMERIC(5, 2) NOT NULL,
    owner_stability_weight NUMERIC(4, 3) NOT NULL,

    facility_quality_target NUMERIC(5, 2) NOT NULL,
    facility_quality_weight NUMERIC(4, 3) NOT NULL,

    CHECK (market_size_target IN ('SMALL', 'MEDIUM', 'LARGE')),
    CHECK (geography_target IN ('NE', 'SE', 'MW', 'SW', 'W')),
    CHECK (climate_target IN ('WARM', 'COLD', 'NEUTRAL')),
    CHECK (competitive_window_target IN ('CONTENDER', 'NEUTRAL', 'REBUILD')),
    CHECK (role_scope_target IN ('LOW', 'MEDIUM', 'HIGH')),
    CHECK (staff_continuity_target IN ('KEEP_EXISTING', 'BRING_OWN', 'HYBRID')),
    CHECK (compensation_weight BETWEEN 0 AND 1),
    CHECK (contract_length_weight BETWEEN 0 AND 1),
    CHECK (guaranteed_money_weight BETWEEN 0 AND 1),
    CHECK (market_size_weight BETWEEN 0 AND 1),
    CHECK (geography_weight BETWEEN 0 AND 1),
    CHECK (climate_weight BETWEEN 0 AND 1),
    CHECK (franchise_prestige_weight BETWEEN 0 AND 1),
    CHECK (competitive_window_weight BETWEEN 0 AND 1),
    CHECK (role_scope_weight BETWEEN 0 AND 1),
    CHECK (staff_continuity_weight BETWEEN 0 AND 1),
    CHECK (scheme_alignment_weight BETWEEN 0 AND 1),
    CHECK (owner_stability_weight BETWEEN 0 AND 1),
    CHECK (facility_quality_weight BETWEEN 0 AND 1),
    CHECK (guaranteed_money_target BETWEEN 0 AND 1),
    CHECK (contract_length_target > 0),
    CHECK (compensation_target >= 0)
);

-- Franchise-initiated offer on a candidate. Status tracks lifecycle:
-- ACTIVE until the week tick resolves it to ACCEPTED or REJECTED.
CREATE TABLE candidate_offers (
    id BIGSERIAL PRIMARY KEY,
    candidate_id BIGINT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    franchise_id BIGINT NOT NULL REFERENCES franchises(id),
    terms JSONB NOT NULL DEFAULT '{}'::jsonb,
    submitted_at_week INTEGER NOT NULL,
    status TEXT NOT NULL,
    CHECK (status IN ('ACTIVE', 'ACCEPTED', 'REJECTED')),
    CHECK (submitted_at_week > 0)
);

CREATE INDEX candidate_offers_candidate_idx ON candidate_offers (candidate_id);
CREATE INDEX candidate_offers_franchise_idx ON candidate_offers (franchise_id);
CREATE UNIQUE INDEX candidate_offers_one_active_per_franchise
    ON candidate_offers (candidate_id, franchise_id)
    WHERE status = 'ACTIVE';

-- Per-franchise hiring sub-state within a phase.
CREATE TABLE franchise_hiring_states (
    id BIGSERIAL PRIMARY KEY,
    franchise_id BIGINT NOT NULL REFERENCES franchises(id),
    league_id BIGINT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    phase TEXT NOT NULL,
    step TEXT NOT NULL,
    shortlist JSONB NOT NULL DEFAULT '[]'::jsonb,
    interviewing_candidate_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    CHECK (step IN ('SEARCHING', 'HIRED')),
    UNIQUE (league_id, franchise_id, phase)
);

-- Terminal hires; one row per filled staff seat.
CREATE TABLE franchise_staff (
    id BIGSERIAL PRIMARY KEY,
    franchise_id BIGINT NOT NULL REFERENCES franchises(id),
    league_id BIGINT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    candidate_id BIGINT NOT NULL REFERENCES candidates(id),
    role TEXT NOT NULL,
    scout_branch TEXT,
    hired_at_phase TEXT NOT NULL,
    hired_at_week INTEGER NOT NULL,
    hired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (role IN (
        'HEAD_COACH', 'OFFENSIVE_COORDINATOR', 'DEFENSIVE_COORDINATOR', 'SPECIAL_TEAMS_COORDINATOR',
        'QB_COACH', 'RB_COACH', 'WR_COACH', 'TE_COACH', 'OL_COACH', 'DL_COACH',
        'EDGE_COACH', 'LB_COACH', 'DB_COACH',
        'DIRECTOR_OF_SCOUTING', 'COLLEGE_SCOUT', 'PRO_SCOUT'
    )),
    CHECK (scout_branch IS NULL OR scout_branch IN ('COLLEGE', 'PRO')),
    CHECK (hired_at_week > 0)
);

CREATE INDEX franchise_staff_league_franchise_idx
    ON franchise_staff (league_id, franchise_id);
CREATE UNIQUE INDEX franchise_staff_unique_role
    ON franchise_staff (league_id, franchise_id, role)
    WHERE role NOT IN ('COLLEGE_SCOUT', 'PRO_SCOUT');
