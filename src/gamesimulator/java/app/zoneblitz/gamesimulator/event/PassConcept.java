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
 */
public enum PassConcept implements ConceptFamily {
  /**
   * Short rhythm throws (air yards ≤ 5) — RPS/slant/flat/checkdown. High completion, near-zero
   * sack.
   */
  QUICK_GAME,
  /** Standard dropback — the residual "true dropback" bucket. Longer holds, higher sack rate. */
  DROPBACK,
  /** Play-action pass — deeper shots off a run fake. Higher YPA, often from under center. */
  PLAY_ACTION,
  /**
   * Screen pass — short throw behind the line with blocking in front. Near-zero sack, near-zero
   * INT.
   */
  SCREEN,
  /** Run-pass option — concept reads a key defender, pulls to pass. Short throws, low sack. */
  RPO,
  /**
   * Desperation heave — end-of-half or end-of-game deep shot. Very low completion, very high INT.
   */
  HAIL_MARY
}
