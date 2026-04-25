package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.environment.EnvironmentalModifiers;
import app.zoneblitz.gamesimulator.event.IncompleteReason;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller;
import app.zoneblitz.gamesimulator.resolver.PassOutcome;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import java.util.Objects;
import java.util.Optional;

/**
 * Weather-aware {@link PassResolver} decorator. Re-rolls the delegate's deep completions against
 * {@link EnvironmentalModifiers#deepPassCompletionPenalty()} and flips the outcome to {@link
 * PassOutcome.PassIncomplete} when the roll falls inside the penalty window. Short/intermediate
 * completions are left alone — the calibration target is the deep ball, where tracking data shows
 * the largest weather effect.
 */
public final class EnvironmentalPassResolver implements PassResolver {

  /** Pass plays with air yards at or beyond this threshold count as "deep" for weather purposes. */
  static final int DEEP_AIR_YARDS_THRESHOLD = 20;

  private static final long PASS_WEATHER_SPLIT_KEY = 0x7EA7_4ED0L;

  private final PassResolver delegate;
  private final EnvironmentalModifiers modifiers;

  public EnvironmentalPassResolver(PassResolver delegate, EnvironmentalModifiers modifiers) {
    this.delegate = Objects.requireNonNull(delegate, "delegate");
    this.modifiers = Objects.requireNonNull(modifiers, "modifiers");
  }

  @Override
  public PassOutcome resolve(
      PlayCaller.PlayCall call,
      GameState state,
      OffensivePersonnel offense,
      DefensivePersonnel defense,
      RandomSource rng) {
    var outcome = delegate.resolve(call, state, offense, defense, rng);
    var penalty = modifiers.deepPassCompletionPenalty();
    if (penalty <= 0.0) {
      return outcome;
    }
    if (!(outcome instanceof PassOutcome.PassComplete complete)) {
      return outcome;
    }
    if (complete.airYards() < DEEP_AIR_YARDS_THRESHOLD) {
      return outcome;
    }
    var weatherRng = rng.split(PASS_WEATHER_SPLIT_KEY);
    if (weatherRng.nextDouble() >= penalty) {
      return outcome;
    }
    return new PassOutcome.PassIncomplete(
        complete.qb(),
        complete.target(),
        complete.airYards(),
        IncompleteReason.OVERTHROWN,
        Optional.empty());
  }
}
