package app.zoneblitz.gamesimulator.event;

/**
 * Passing play concept — the kind of dropback the offense ran. Play-type granularity (not
 * route-family); per-receiver route modeling lands with the target selector.
 *
 * <p>Buckets are sized to match FTN charting tags (2022-24 regular season): DROPBACK and QUICK_GAME
 * together make ~70% of passes, PLAY_ACTION ~18%, SCREEN ~10%, RPO ~2%, HAIL_MARY &lt;1%. Each
 * concept carries distinct outcome tendencies (screens complete 85%+, dropbacks take 14% sacks,
 * hail marys pick 16%), which the resolver captures via concept-aware leg weights in the matchup
 * shift.
 *
 * <p>Each constant carries leg weights for the role-keyed pass matchup shift: {@link
 * #coverageLegWeight()} scales the route-runner-vs-coverage delta, {@link #passRushLegWeight()}
 * scales the pass-rusher-vs-protection delta. {@code DROPBACK} uses {@code 1.0 / 1.0} so the legacy
 * {@code coverage − pass_rush} shape is preserved exactly — baseline parity is structural. Other
 * weights are tuned from FTN-tagged outcomes: SCREEN/QUICK_GAME drop pass-rush weight to near zero
 * (&lt;0.1% sack rate vs. 14% dropback), PLAY_ACTION tilts coverage up (YPA 7.5 vs. 6.1 league),
 * HAIL_MARY goes all-in on coverage physical mismatch.
 */
public enum PassConcept implements ConceptFamily {
  /**
   * Short rhythm throws (air yards ≤ 5) — RPS/slant/flat/checkdown. High completion, near-zero
   * sack.
   */
  QUICK_GAME(1.1, 0.2),
  /** Standard dropback — the residual "true dropback" bucket. Longer holds, higher sack rate. */
  DROPBACK(1.0, 1.0),
  /** Play-action pass — deeper shots off a run fake. Higher YPA, often from under center. */
  PLAY_ACTION(1.3, 0.9),
  /**
   * Screen pass — short throw behind the line with blocking in front. Near-zero sack, near-zero
   * INT.
   */
  SCREEN(1.0, 0.05),
  /** Run-pass option — concept reads a key defender, pulls to pass. Short throws, low sack. */
  RPO(1.0, 0.3),
  /**
   * Desperation heave — end-of-half or end-of-game deep shot. Very low completion, very high INT.
   */
  HAIL_MARY(1.5, 0.0);

  private final double coverageLegWeight;
  private final double passRushLegWeight;

  PassConcept(double coverageLegWeight, double passRushLegWeight) {
    this.coverageLegWeight = coverageLegWeight;
    this.passRushLegWeight = passRushLegWeight;
  }

  public double coverageLegWeight() {
    return coverageLegWeight;
  }

  public double passRushLegWeight() {
    return passRushLegWeight;
  }
}
