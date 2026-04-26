package app.zoneblitz.gamesimulator.adjustments;

import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller.PlayCall;
import java.util.Optional;

/**
 * Folds a single {@link PlayEvent} into the running {@link GameStats}. Pure: identical inputs yield
 * identical outputs, no side effects, no RNG.
 *
 * <p>Implementations must update only the offensive side's log — pass/run efficiency, sack/INT
 * counts, explosive plays, and the recent-play window. Non-scrimmage events (kickoffs, punts, field
 * goals, timeouts, end-of-quarter, penalties) return the prior state unchanged. The {@code call}
 * hint carries pass-concept information the {@link PlayEvent} variants do not surface (e.g.
 * play-action vs dropback) so concept-level signals are recoverable; it is {@link Optional#empty}
 * for plays that were not produced from a scrimmage call.
 */
public interface GameStatsAccumulator {

  GameStats apply(GameStats prior, PlayEvent event, Side offense, Optional<PlayCall> call);
}
