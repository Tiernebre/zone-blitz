-- Phase week counter: current week within the league's active phase (1-indexed).
ALTER TABLE leagues
    ADD COLUMN phase_week INTEGER NOT NULL DEFAULT 1;
