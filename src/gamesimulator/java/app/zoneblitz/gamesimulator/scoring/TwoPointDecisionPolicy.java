package app.zoneblitz.gamesimulator.scoring;

import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;

/**
 * Decides whether the scoring team should attempt a two-point conversion or kick the extra point
 * after a touchdown. Implementations should be pure functions of the supplied state so callers can
 * reason deterministically about post-TD scoring sequences.
 */
public interface TwoPointDecisionPolicy {

  /**
   * @param scoreBeforeTry the running score with the touchdown's six points already applied but no
   *     try-point applied yet
   * @param scoringSide the side that just scored the touchdown
   * @param clockAfterTd clock snapshot taken immediately after the touchdown
   * @return {@code true} iff the scoring team should go for two; {@code false} means kick the PAT
   */
  boolean goForTwo(Score scoreBeforeTry, Side scoringSide, GameClock clockAfterTd);
}
