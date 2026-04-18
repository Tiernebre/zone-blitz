package app.zoneblitz.gamesimulator;

/**
 * Per-team home-field strength on a 0–100 scale. 50 is the league-average stadium; 0 is a dome with
 * bored fans; 100 is Arrowhead / Lumen / Allegiant at full boil. Higher strength amplifies
 * crowd-noise pre-snap penalties on the road offense and enlarges the league-average home-field
 * scoring tilt.
 *
 * <p>Stored on {@link app.zoneblitz.gamesimulator.GameInputs.PreGameContext} so that only the home
 * team's value is consulted for a given game; away teams' stadium attributes are irrelevant until
 * they host the return matchup. A neutral instance is used when callers don't supply one — the
 * engine then applies no home-field shift, which is the right default for regression tests that are
 * checking other behaviour.
 */
public record HomeFieldAdvantage(int strength) {

  /** League-average stadium strength. */
  public static final int LEAGUE_AVERAGE = 50;

  public HomeFieldAdvantage {
    if (strength < 0 || strength > 100) {
      throw new IllegalArgumentException("strength must be in [0, 100]: " + strength);
    }
  }

  /** Neutral field — no home-field shift applied. */
  public static HomeFieldAdvantage neutral() {
    return new HomeFieldAdvantage(0);
  }

  /** League-average home-field strength. */
  public static HomeFieldAdvantage leagueAverage() {
    return new HomeFieldAdvantage(LEAGUE_AVERAGE);
  }
}
