package app.zoneblitz.gamesimulator.adjustments;

import app.zoneblitz.gamesimulator.event.PassConcept;

/**
 * Coarse classification of a single scrimmage play, recorded into {@link TeamPlayLog}'s rolling
 * recent-play window. Pass kinds map 1:1 to {@link PassConcept}; runs collapse to a single bucket
 * (run-concept granularity is captured separately by aggregate counters).
 */
public enum PlayKind {
  PASS_DROPBACK,
  PASS_QUICK_GAME,
  PASS_PLAY_ACTION,
  PASS_SCREEN,
  PASS_RPO,
  PASS_HAIL_MARY,
  RUN;

  public static PlayKind fromPassConcept(PassConcept concept) {
    return switch (concept) {
      case DROPBACK -> PASS_DROPBACK;
      case QUICK_GAME -> PASS_QUICK_GAME;
      case PLAY_ACTION -> PASS_PLAY_ACTION;
      case SCREEN -> PASS_SCREEN;
      case RPO -> PASS_RPO;
      case HAIL_MARY -> PASS_HAIL_MARY;
    };
  }
}
