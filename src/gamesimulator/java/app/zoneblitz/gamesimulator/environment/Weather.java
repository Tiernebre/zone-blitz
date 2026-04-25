package app.zoneblitz.gamesimulator.environment;

/**
 * Environmental weather snapshot at kickoff. Values are treated as constant for the game — the sim
 * does not simulate weather evolution. Indoor games should pass {@link #indoor()}.
 *
 * @param temperatureF kickoff air temperature in degrees Fahrenheit
 * @param windMph sustained wind speed in miles per hour; non-negative
 * @param precipitation precipitation category; {@link Precipitation#NONE} for dry conditions
 */
public record Weather(int temperatureF, int windMph, Precipitation precipitation) {

  public Weather {
    if (windMph < 0) {
      throw new IllegalArgumentException("windMph must be non-negative; was " + windMph);
    }
    if (precipitation == null) {
      throw new IllegalArgumentException("precipitation must not be null");
    }
  }

  /** Calm, dry, 72°F — the reference "no-effect" profile used by dome and retractable-closed. */
  public static Weather indoor() {
    return new Weather(72, 0, Precipitation.NONE);
  }

  /** Cold in the cold-kicker-range sense: below freezing. */
  public boolean isCold() {
    return temperatureF < 32;
  }

  /** Precipitation severity bucket. */
  public enum Precipitation {
    NONE,
    LIGHT_RAIN,
    HEAVY_RAIN,
    SNOW
  }
}
