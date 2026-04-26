package app.zoneblitz.gamesimulator.adjustments;

import app.zoneblitz.gamesimulator.roster.CoachTendencies;

/**
 * Computes the in-game adjustment bundle the offense should apply on top of its baseline +
 * situational + coach-tendency call lanes. Pure: identical inputs yield identical outputs.
 *
 * <p>Implementations read the offense's <em>own</em> {@link TeamPlayLog} as a proxy for what the
 * defense has been doing. High sack rate ⇒ defense is blitzing ⇒ counter with screens/quick game;
 * high stuff rate ⇒ box is loaded ⇒ pivot to play-action. Sample-size floors are an implementation
 * concern — early-game logs should produce {@link OffensiveAdjustments#NEUTRAL}.
 */
public interface OffensiveAdjustmentSource {

  OffensiveAdjustments compute(TeamPlayLog ownOffenseLog, CoachTendencies oc);
}
