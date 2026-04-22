package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.band.BandRepository;
import app.zoneblitz.gamesimulator.band.BandSampler;
import app.zoneblitz.gamesimulator.band.DistributionalBand;
import app.zoneblitz.gamesimulator.band.RateBand;
import app.zoneblitz.gamesimulator.event.IncompleteReason;
import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.resolver.PassOutcome;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Position;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * Pass-resolver decorator that routes {@link PassConcept#HAIL_MARY} calls through the dedicated
 * end-of-half outcome mix from {@code hail-mary.json} ({@code bands.desperation}). All other
 * concepts are delegated verbatim.
 *
 * <p>Real hail-mary outcomes are much more interception-heavy (~27.7% INT vs. the ~9% on ordinary
 * 40+ air-yard deep shots) and have a far lower completion rate (~12.5% vs. ~28%). Resolving them
 * through the generic outcome mix would understate picks and overstate completions on the handful
 * of desperation heaves that fire per game.
 */
public final class HailMaryPassResolver implements PassResolver {

  private static final String HAIL_MARY = "hail-mary.json";

  private final PassResolver delegate;
  private final BandSampler sampler;
  private final RateBand<PassOutcomeKind> outcomeMix;
  private final DistributionalBand completionYards;

  public HailMaryPassResolver(
      PassResolver delegate,
      BandSampler sampler,
      RateBand<PassOutcomeKind> outcomeMix,
      DistributionalBand completionYards) {
    this.delegate = Objects.requireNonNull(delegate, "delegate");
    this.sampler = Objects.requireNonNull(sampler, "sampler");
    this.outcomeMix = Objects.requireNonNull(outcomeMix, "outcomeMix");
    this.completionYards = Objects.requireNonNull(completionYards, "completionYards");
  }

  /**
   * Compose the production pass stack: a {@link MatchupPassResolver} wrapped in a {@link
   * HailMaryPassResolver} that steers desperation heaves through the dedicated band.
   */
  public static PassResolver load(BandRepository repo, BandSampler sampler) {
    var inner = MatchupPassResolver.load(repo, sampler);
    var rawMix = repo.loadRate(HAIL_MARY, "bands.desperation.outcome_mix", PassOutcomeKind.class);
    // desperation mix only carries COMPLETE / INCOMPLETE / INTERCEPTION — SACK and SCRAMBLE are
    // zero by construction. No β coefficients — matchup shift is not yet tuned for hail marys.
    var mix = new RateBand<>(rawMix.baseProbabilities(), Map.<PassOutcomeKind, Double>of());
    var completionYards = repo.loadDistribution(HAIL_MARY, "bands.deep_shots.completion_yards");
    return new HailMaryPassResolver(inner, sampler, mix, completionYards);
  }

  @Override
  public PassOutcome resolve(
      PlayCaller.PlayCall call,
      GameState state,
      OffensivePersonnel offense,
      DefensivePersonnel defense,
      RandomSource rng) {
    Objects.requireNonNull(call, "call");
    if (call.passConcept() != PassConcept.HAIL_MARY) {
      return delegate.resolve(call, state, offense, defense, rng);
    }
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
            qb, target, yards, 0, yards, Optional.empty(), List.of(), false);
      }
      case INCOMPLETE ->
          new PassOutcome.PassIncomplete(
              qb, target, 0, IncompleteReason.BROKEN_UP, Optional.empty());
      case INTERCEPTION -> {
        var interceptor = pickInterceptor(defense, qb);
        yield new PassOutcome.Interception(qb, target, interceptor, 0);
      }
      // Desperation band never produces SACK or SCRAMBLE; fall back to a PBU-style incomplete.
      case SACK, SCRAMBLE ->
          new PassOutcome.PassIncomplete(
              qb, target, 0, IncompleteReason.BROKEN_UP, Optional.empty());
    };
  }

  private static PlayerId pickTarget(OffensivePersonnel offense, PlayerId qb) {
    for (var p : offense.players()) {
      if (p.position() == Position.WR) {
        return p.id();
      }
    }
    for (var p : offense.players()) {
      if (p.position() == Position.TE) {
        return p.id();
      }
    }
    return qb;
  }

  private static PlayerId pickInterceptor(DefensivePersonnel defense, PlayerId fallbackQb) {
    for (var p : defense.players()) {
      if (p.position() == Position.S || p.position() == Position.CB) {
        return p.id();
      }
    }
    if (!defense.players().isEmpty()) {
      return defense.players().get(0).id();
    }
    return fallbackQb;
  }
}
