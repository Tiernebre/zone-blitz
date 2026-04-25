package app.zoneblitz.gamesimulator;

import app.zoneblitz.gamesimulator.environment.EnvironmentalModifiers;
import app.zoneblitz.gamesimulator.environment.HomeFieldAdvantage;
import app.zoneblitz.gamesimulator.environment.Roof;
import app.zoneblitz.gamesimulator.environment.Surface;
import app.zoneblitz.gamesimulator.environment.Weather;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.roster.Coach;
import app.zoneblitz.gamesimulator.roster.Team;
import app.zoneblitz.gamesimulator.scheme.BuiltinSchemeCatalog;
import app.zoneblitz.gamesimulator.scheme.DefaultSchemeResolver;
import app.zoneblitz.gamesimulator.scheme.ResolvedScheme;
import app.zoneblitz.gamesimulator.scheme.SchemeResolver;
import java.util.Objects;
import java.util.Optional;

/**
 * All inputs required to simulate a single game. Rosters and coaches are pre-fetched by the caller
 * from the roster feature's public use case — the sim never touches persistence. {@link
 * PreGameContext} carries environmental inputs (weather, surface, roof) alongside the home team's
 * {@link HomeFieldAdvantage}.
 *
 * <p>{@link #gameType()} drives overtime rules: regular-season games use modified sudden death with
 * a single 10-minute period that may end tied; playoff games play indefinite 15-minute sudden-death
 * periods until a winner is determined.
 */
public record GameInputs(
    GameId gameId,
    Team home,
    Team away,
    Coach homeCoach,
    Coach awayCoach,
    ResolvedScheme homeScheme,
    ResolvedScheme awayScheme,
    PreGameContext preGameContext,
    GameType gameType,
    Optional<Long> seed) {

  private static final SchemeResolver DEFAULT_SCHEME_RESOLVER =
      new DefaultSchemeResolver(new BuiltinSchemeCatalog());

  public GameInputs {
    Objects.requireNonNull(gameId, "gameId");
    Objects.requireNonNull(home, "home");
    Objects.requireNonNull(away, "away");
    Objects.requireNonNull(homeCoach, "homeCoach");
    Objects.requireNonNull(awayCoach, "awayCoach");
    Objects.requireNonNull(homeScheme, "homeScheme");
    Objects.requireNonNull(awayScheme, "awayScheme");
    Objects.requireNonNull(preGameContext, "preGameContext");
    Objects.requireNonNull(gameType, "gameType");
    Objects.requireNonNull(seed, "seed");
  }

  /**
   * Backward-compatible constructor that resolves schemes from the supplied coaches via the
   * built-in {@link DefaultSchemeResolver}. New call sites should resolve schemes explicitly so the
   * catalog and resolver stay swappable; this overload exists so legacy fixtures don't break.
   */
  public GameInputs(
      GameId gameId,
      Team home,
      Team away,
      Coach homeCoach,
      Coach awayCoach,
      PreGameContext preGameContext,
      GameType gameType,
      Optional<Long> seed) {
    this(
        gameId,
        home,
        away,
        homeCoach,
        awayCoach,
        DEFAULT_SCHEME_RESOLVER.resolve(homeCoach, homeCoach, homeCoach),
        DEFAULT_SCHEME_RESOLVER.resolve(awayCoach, awayCoach, awayCoach),
        preGameContext,
        gameType,
        seed);
  }

  /**
   * Convenience constructor that defaults {@link #gameType()} to {@link GameType#REGULAR_SEASON}
   * and resolves schemes from coaches.
   */
  public GameInputs(
      GameId gameId,
      Team home,
      Team away,
      Coach homeCoach,
      Coach awayCoach,
      PreGameContext preGameContext,
      Optional<Long> seed) {
    this(gameId, home, away, homeCoach, awayCoach, preGameContext, GameType.REGULAR_SEASON, seed);
  }

  /**
   * Pre-game environmental + matchup context. Carries the home team's {@link HomeFieldAdvantage}
   * alongside {@link Weather}, {@link Surface}, and {@link Roof}; resolvers consult derived {@link
   * EnvironmentalModifiers} to bias kick accuracy, punt distance, deep-pass completion, fumble
   * rate, and kicker range.
   *
   * <p>Indoor or roof-closed games should pass {@link Roof#DOME} / {@link Roof#RETRACTABLE_CLOSED};
   * the modifier layer zeroes weather out in that case regardless of the supplied {@link Weather}.
   */
  public record PreGameContext(
      HomeFieldAdvantage homeFieldAdvantage, Weather weather, Surface surface, Roof roof) {

    public PreGameContext {
      Objects.requireNonNull(homeFieldAdvantage, "homeFieldAdvantage");
      Objects.requireNonNull(weather, "weather");
      Objects.requireNonNull(surface, "surface");
      Objects.requireNonNull(roof, "roof");
    }

    /** Neutral baseline — no HFA shift, indoor/calm/grass. */
    public PreGameContext() {
      this(HomeFieldAdvantage.neutral(), Weather.indoor(), Surface.GRASS, Roof.DOME);
    }
  }
}
