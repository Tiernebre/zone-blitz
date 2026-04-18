-- O3: PlayEventStore backing table. Events are the source of truth for a simulated game.
-- JSONB payload stores the serialized PlayEvent variant; schema evolution is easier than
-- typed columns per variant (see sim-engine.md lines 548-552).
CREATE TABLE play_events (
    id BIGSERIAL PRIMARY KEY,
    game_id UUID NOT NULL,
    play_index INTEGER NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT play_events_game_play_unique UNIQUE (game_id, play_index)
);

CREATE INDEX play_events_game_id_idx ON play_events (game_id, play_index);
