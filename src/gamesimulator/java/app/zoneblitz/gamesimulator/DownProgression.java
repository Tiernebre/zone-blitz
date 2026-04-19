package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.event.DownAndDistance;

/** Advances {@link DownAndDistance} after a live-ball snap. */
final class DownProgression {

  private DownProgression() {}

  /** Returns {@code null} to signal turnover on downs (4th down failed). */
  static DownAndDistance advance(DownAndDistance dd, SnapAdvance advance, int preYl) {
    if (dd.down() == 0) {
      // Freshly-spotted ball after a kickoff or turnover; normalize to 1st-and-10 (or goal-to-go).
      return GameState.freshFirstDown(advance.endYardLine());
    }
    if (advance.offensiveYards() >= dd.yardsToGo()) {
      return GameState.freshFirstDown(advance.endYardLine());
    }
    var nextDown = dd.down() + 1;
    if (nextDown > 4) {
      return null;
    }
    var remaining = Math.max(1, dd.yardsToGo() - Math.max(0, advance.offensiveYards()));
    // If a big loss moved past prior LOS the "remaining" math still caps at 1 by design — the
    // resolver never produces a first down from behind, so forcing a minimum of 1 keeps
    // downstream narration sensible.
    return new DownAndDistance(nextDown, remaining);
  }
}
