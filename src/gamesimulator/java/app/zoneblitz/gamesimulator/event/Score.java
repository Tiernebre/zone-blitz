package app.zoneblitz.gamesimulator.event;

/** Running score for both teams after a play. */
public record Score(int home, int away) {

  /** Return a new score with {@code points} added to {@code side}. */
  public Score plus(Side side, int points) {
    return switch (side) {
      case HOME -> new Score(home + points, away);
      case AWAY -> new Score(home, away + points);
    };
  }
}
