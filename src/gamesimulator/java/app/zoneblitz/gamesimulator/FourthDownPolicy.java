package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Coach;

/**
 * Decides what to do on 4th down: kick a field goal, punt, or go for it. Consumers call this for
 * every 4th-down scrimmage snap; the engine's legacy field-position cutoffs in {@link SpecialTeams}
 * stay as a conservative fallback when no policy is wired.
 *
 * <p>Implementations should consult {@link Coach#offense()} aggression, field position, down and
 * distance, and game state (score, clock) to mirror real-NFL go-for-it rates (~15-20% overall,
 * higher near the opponent's end zone and in late-game catch-up).
 */
public interface FourthDownPolicy {

  enum Decision {
    GO_FOR_IT,
    ATTEMPT_FIELD_GOAL,
    PUNT
  }

  Decision decide(GameState state, Coach offenseCoach, RandomSource rng);
}
