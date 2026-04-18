package app.zoneblitz.gamesimulator.formation;

/**
 * The pre-snap alignment the offense shows: QB/RB/TE/WR arrangement around the line of scrimmage.
 *
 * <p>Distinct from personnel (who is on the field). The same 11 players can line up {@code
 * SHOTGUN}, {@code EMPTY}, or {@code SINGLEBACK} and the defense will respond with different box
 * counts and coverage shells — which is what formation captures here. Callers in the sim use this
 * enum as a key into {@link BoxCountSampler} and {@link CoverageShellSampler} priors derived from
 * Big Data Bowl tracking.
 */
public enum OffensiveFormation {
  /** 1 RB next to QB in shotgun depth, 3+ WRs — the modern default passing look. */
  SHOTGUN,
  /** No RB in the backfield, 5 eligibles split out. Spreads the box and pulls safeties wide. */
  EMPTY,
  /** QB under center, single RB behind — the traditional pro-style balanced set. */
  SINGLEBACK,
  /** QB under center, FB+RB stacked in the backfield. Condensed, heavy-run tells. */
  I_FORM,
  /** QB ~4 yards deep, RB directly behind. Hybrid between shotgun and singleback. */
  PISTOL,
  /** Extra OL/TE in tight, often max protection or short-yardage power. */
  JUMBO
}
