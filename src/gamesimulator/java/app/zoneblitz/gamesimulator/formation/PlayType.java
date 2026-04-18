package app.zoneblitz.gamesimulator.formation;

/**
 * Coarse play-type bucket used to pick the right pre-snap prior.
 *
 * <p>The defense commits its box count and coverage shell before the snap, but its expectation of
 * run vs. pass shifts those priors materially — light boxes come out on passing downs, heavy boxes
 * on rushing downs. The sim samples both priors with the coach-intended play type.
 */
public enum PlayType {
  RUN,
  PASS
}
