-- Re-anchor staff/hiring data on the per-league `teams` row instead of the
-- league-agnostic `franchises` brand. Franchises stay the branding catalog;
-- teams are the in-league instance that can evolve (prestige, scheme,
-- staff continuity, etc.) over time.

-- 1) candidates.hired_by_franchise_id -> hired_by_team_id ------------------
ALTER TABLE candidates ADD COLUMN hired_by_team_id BIGINT REFERENCES teams(id);

UPDATE candidates c
SET hired_by_team_id = t.id
FROM candidate_pools p, teams t
WHERE c.pool_id = p.id
  AND c.hired_by_franchise_id IS NOT NULL
  AND t.league_id = p.league_id
  AND t.franchise_id = c.hired_by_franchise_id;

DROP INDEX candidates_hired_by_idx;
ALTER TABLE candidates DROP COLUMN hired_by_franchise_id;
CREATE INDEX candidates_hired_by_team_idx
    ON candidates (hired_by_team_id)
    WHERE hired_by_team_id IS NOT NULL;

-- 2) candidate_offers.franchise_id -> team_id ------------------------------
ALTER TABLE candidate_offers ADD COLUMN team_id BIGINT REFERENCES teams(id);

UPDATE candidate_offers o
SET team_id = t.id
FROM candidates c, candidate_pools p, teams t
WHERE o.candidate_id = c.id
  AND c.pool_id = p.id
  AND t.league_id = p.league_id
  AND t.franchise_id = o.franchise_id;

ALTER TABLE candidate_offers ALTER COLUMN team_id SET NOT NULL;
DROP INDEX candidate_offers_franchise_idx;
DROP INDEX candidate_offers_one_active_per_franchise;
ALTER TABLE candidate_offers DROP COLUMN franchise_id;
CREATE INDEX candidate_offers_team_idx ON candidate_offers (team_id);
CREATE UNIQUE INDEX candidate_offers_one_active_per_team
    ON candidate_offers (candidate_id, team_id)
    WHERE status = 'ACTIVE';

-- 3) franchise_hiring_states -> team_hiring_states -------------------------
ALTER TABLE franchise_hiring_states ADD COLUMN team_id BIGINT REFERENCES teams(id);

UPDATE franchise_hiring_states fhs
SET team_id = t.id
FROM teams t
WHERE t.league_id = fhs.league_id AND t.franchise_id = fhs.franchise_id;

ALTER TABLE franchise_hiring_states ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE franchise_hiring_states
    DROP CONSTRAINT franchise_hiring_states_league_id_franchise_id_phase_key;
ALTER TABLE franchise_hiring_states DROP COLUMN franchise_id;
ALTER TABLE franchise_hiring_states DROP COLUMN league_id;
ALTER TABLE franchise_hiring_states ADD CONSTRAINT team_hiring_states_team_phase_key
    UNIQUE (team_id, phase);
ALTER TABLE franchise_hiring_states RENAME TO team_hiring_states;

-- 4) franchise_staff -> team_staff -----------------------------------------
ALTER TABLE franchise_staff ADD COLUMN team_id BIGINT REFERENCES teams(id);

UPDATE franchise_staff fs
SET team_id = t.id
FROM teams t
WHERE t.league_id = fs.league_id AND t.franchise_id = fs.franchise_id;

ALTER TABLE franchise_staff ALTER COLUMN team_id SET NOT NULL;
DROP INDEX franchise_staff_league_franchise_idx;
DROP INDEX franchise_staff_unique_role;
ALTER TABLE franchise_staff DROP COLUMN franchise_id;
ALTER TABLE franchise_staff DROP COLUMN league_id;
ALTER TABLE franchise_staff RENAME TO team_staff;
CREATE INDEX team_staff_team_idx ON team_staff (team_id);
CREATE UNIQUE INDEX team_staff_unique_role
    ON team_staff (team_id, role)
    WHERE role NOT IN ('COLLEGE_SCOUT', 'PRO_SCOUT');

-- 5) franchise_interviews -> team_interviews -------------------------------
ALTER TABLE franchise_interviews ADD COLUMN team_id BIGINT REFERENCES teams(id);

UPDATE franchise_interviews fi
SET team_id = t.id
FROM teams t
WHERE t.league_id = fi.league_id AND t.franchise_id = fi.franchise_id;

ALTER TABLE franchise_interviews ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE franchise_interviews
    DROP CONSTRAINT franchise_interviews_league_id_franchise_id_candidate_id_in_key;
DROP INDEX franchise_interviews_league_franchise_phase_idx;
DROP INDEX franchise_interviews_league_franchise_week_idx;
ALTER TABLE franchise_interviews DROP COLUMN franchise_id;
ALTER TABLE franchise_interviews DROP COLUMN league_id;
ALTER TABLE franchise_interviews RENAME TO team_interviews;
ALTER TABLE team_interviews ADD CONSTRAINT team_interviews_team_candidate_index_key
    UNIQUE (team_id, candidate_id, interview_index);
CREATE INDEX team_interviews_team_phase_idx
    ON team_interviews (team_id, phase);
CREATE INDEX team_interviews_team_week_idx
    ON team_interviews (team_id, phase, phase_week);
