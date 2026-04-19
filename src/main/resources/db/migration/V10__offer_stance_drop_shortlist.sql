-- Negotiation rework:
--   1) Offers now carry a derived `stance` (PENDING / RENEGOTIATE / AGREED) that is
--      recomputed each week tick against the candidate's preferences. The terminal
--      `status` column (ACTIVE / ACCEPTED / REJECTED) is unchanged — stance is a
--      per-tick view over ACTIVE offers. Stored so the UI and CPU auto-hire query
--      it trivially.
--   2) Offers track `revision_count` (how many times the user has revised terms).
--      When it exceeds the cap the candidate walks — offer becomes REJECTED.
--   3) The shortlist concept is removed entirely. The interviews panel is now the
--      single funnel for candidates you're pursuing.

ALTER TABLE candidate_offers
    ADD COLUMN stance TEXT,
    ADD COLUMN revision_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE candidate_offers
    ADD CONSTRAINT candidate_offers_stance_check
        CHECK (stance IS NULL OR stance IN ('PENDING', 'RENEGOTIATE', 'AGREED'));

ALTER TABLE candidate_offers
    ADD CONSTRAINT candidate_offers_revision_count_check
        CHECK (revision_count >= 0);

-- Any ACTIVE offer surviving this migration starts out PENDING; terminal offers
-- stay stanceless.
UPDATE candidate_offers SET stance = 'PENDING' WHERE status = 'ACTIVE';

ALTER TABLE team_hiring_states DROP COLUMN shortlist;
