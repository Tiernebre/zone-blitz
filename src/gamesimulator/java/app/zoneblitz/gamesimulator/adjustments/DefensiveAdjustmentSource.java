package app.zoneblitz.gamesimulator.adjustments;

import app.zoneblitz.gamesimulator.roster.DefensiveCoachTendencies;

/**
 * Computes the in-game adjustment bundle the defense should apply on top of its baseline +
 * situational + coach-tendency call lanes. Pure: identical inputs yield identical outputs.
 *
 * <p>Implementations read the offense's {@link TeamPlayLog} (what the offense has done so far this
 * game) and the DC's tendencies, and return a {@link DefensiveAdjustments} bundle. Sample-size
 * floors are an implementation concern — early-game logs should produce {@link
 * DefensiveAdjustments#NEUTRAL}.
 */
public interface DefensiveAdjustmentSource {

  DefensiveAdjustments compute(TeamPlayLog opponentOffenseLog, DefensiveCoachTendencies dc);
}
