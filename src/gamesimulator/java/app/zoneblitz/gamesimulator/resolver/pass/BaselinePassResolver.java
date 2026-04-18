package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.band.BandRepository;
import app.zoneblitz.gamesimulator.band.BandSampler;
import app.zoneblitz.gamesimulator.band.DistributionalBand;
import app.zoneblitz.gamesimulator.band.RateBand;
import app.zoneblitz.gamesimulator.event.IncompleteReason;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.resolver.PassOutcome;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Baseline pass resolver: samples outcome and yardage from the bands in {@code passing-plays.json}
 * with {@code matchupShift = 0}.
 *
 * <p>Target, defender, and sacker selection use placeholder first-available-by-role logic pulled
 * directly from on-field personnel; a dedicated target selector will replace the pick when
 * per-receiver modeling lands. For now a completion's {@code airYards} holds the sampled total and
 * {@code yardsAfterCatch} is zero — the air-vs-YAC split arrives with that same selector.
 */
public final class BaselinePassResolver implements PassResolver {

  private static final String PASSING_PLAYS = "passing-plays.json";

  private final BandSampler sampler;
  private final RateBand<PassOutcomeKind> outcomeMix;
  private final DistributionalBand completionYards;
  private final DistributionalBand sackYards;
  private final DistributionalBand scrambleYards;

  public BaselinePassResolver(
      BandSampler sampler,
      RateBand<PassOutcomeKind> outcomeMix,
      DistributionalBand completionYards,
      DistributionalBand sackYards,
      DistributionalBand scrambleYards) {
    this.sampler = Objects.requireNonNull(sampler, "sampler");
    this.outcomeMix = Objects.requireNonNull(outcomeMix, "outcomeMix");
    this.completionYards = Objects.requireNonNull(completionYards, "completionYards");
    this.sackYards = Objects.requireNonNull(sackYards, "sackYards");
    this.scrambleYards = Objects.requireNonNull(scrambleYards, "scrambleYards");
  }

  /** Load a resolver from {@code passing-plays.json} on the classpath. */
  public static BaselinePassResolver load(BandRepository repo, BandSampler sampler) {
    var outcomeMix = repo.loadRate(PASSING_PLAYS, "bands.outcome_mix", PassOutcomeKind.class);
    var completionYards = repo.loadDistribution(PASSING_PLAYS, "bands.yardage.completion_yards");
    var sackYards = repo.loadDistribution(PASSING_PLAYS, "bands.yardage.sack_yards");
    var scrambleYards = repo.loadDistribution(PASSING_PLAYS, "bands.yardage.scramble_yards");
    return new BaselinePassResolver(sampler, outcomeMix, completionYards, sackYards, scrambleYards);
  }

  @Override
  public PassOutcome resolve(
      PlayCaller.PlayCall call,
      GameState state,
      OffensivePersonnel offense,
      DefensivePersonnel defense,
      RandomSource rng) {
    Objects.requireNonNull(call, "call");
    Objects.requireNonNull(state, "state");
    Objects.requireNonNull(offense, "offense");
    Objects.requireNonNull(defense, "defense");
    Objects.requireNonNull(rng, "rng");

    var qb = offense.quarterback().id();
    var target = pickTarget(offense, qb);
    var outcome = sampler.sampleRate(outcomeMix, 0.0, rng);

    return switch (outcome) {
      case COMPLETE -> {
        var yards = sampler.sampleDistribution(completionYards, 0.0, rng);
        yield new PassOutcome.PassComplete(
            qb, target, yards, 0, yards, Optional.empty(), List.of(), false, false);
      }
      case INCOMPLETE ->
          new PassOutcome.PassIncomplete(
              qb, target, 0, IncompleteReason.OVERTHROWN, Optional.empty());
      case SACK -> {
        var sampled = sampler.sampleDistribution(sackYards, 0.0, rng);
        yield new PassOutcome.Sack(qb, List.of(), -sampled, Optional.empty());
      }
      case SCRAMBLE -> {
        var yards = sampler.sampleDistribution(scrambleYards, 0.0, rng);
        yield new PassOutcome.Scramble(qb, yards, Optional.empty(), false, false);
      }
      case INTERCEPTION -> {
        var interceptor = pickInterceptor(defense);
        yield new PassOutcome.Interception(qb, target, interceptor, 0, false);
      }
    };
  }

  private static PlayerId pickTarget(OffensivePersonnel offense, PlayerId qb) {
    return firstId(offense.receivers())
        .or(() -> firstId(offense.tightEnds()))
        .or(() -> firstId(offense.runningBacks()))
        .orElse(qb);
  }

  private static PlayerId pickInterceptor(DefensivePersonnel defense) {
    return firstId(defense.cornerbacks())
        .or(() -> firstId(defense.safeties()))
        .or(() -> firstId(defense.linebackers()))
        .orElseThrow(
            () -> new IllegalStateException("Defense has no players to intercept the pass"));
  }

  private static Optional<PlayerId> firstId(List<Player> players) {
    return players.stream().map(Player::id).findFirst();
  }

  /** Outcome categories in {@code bands.outcome_mix}. Names map to JSON keys case-insensitively. */
  public enum PassOutcomeKind {
    COMPLETE,
    INCOMPLETE,
    INTERCEPTION,
    SACK,
    SCRAMBLE
  }
}
