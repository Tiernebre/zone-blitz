-- Remove the scouting/noise hiring mechanic. Interviews become a mutual-interest
-- signal between team and candidate, computed deterministically from the
-- candidate's preferences against the team's profile.
--
-- Drops:
--   * candidates.scouted_attrs    (hidden_attrs stays — latent ratings still drive sim outcomes)
--   * team_interviews.scouted_overall (no more noise-reduced numeric estimate)
--
-- Adds:
--   * team_interviews.interest_level (INTERESTED / LUKEWARM / NOT_INTERESTED)
--
-- Per-candidate interviews become one-shot: interview_index is kept for audit
-- but the unique (team_id, candidate_id, interview_index) constraint combined
-- with the use case's one-interview-per-candidate rule means it will always be 1.

ALTER TABLE candidates DROP COLUMN scouted_attrs;

ALTER TABLE team_interviews DROP COLUMN scouted_overall;

ALTER TABLE team_interviews
    ADD COLUMN interest_level TEXT NOT NULL DEFAULT 'LUKEWARM'
        CHECK (interest_level IN ('INTERESTED', 'LUKEWARM', 'NOT_INTERESTED'));

ALTER TABLE team_interviews ALTER COLUMN interest_level DROP DEFAULT;
