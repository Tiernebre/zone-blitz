package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.band.BandRepository;
import app.zoneblitz.gamesimulator.band.BandSampler;
import app.zoneblitz.gamesimulator.band.DistributionalBand;
import app.zoneblitz.gamesimulator.band.RateBand;
import app.zoneblitz.gamesimulator.event.IncompleteReason;
import app.zoneblitz.gamesimulator.event.PassConcept;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller;
import app.zoneblitz.gamesimulator.resolver.PassOutcome;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
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
 *
 * <p>Attribute-aware shift on the desperation mix:
 *
 * <ul>
 *   <li><b>QB arm strength + deep accuracy</b> — a cannon-armed accurate QB gets the ball on target
 *       deep, lifting completions and shrinking interceptions.
 *   <li><b>WR contested catch + hands</b> — a 50-50 winner converts deflections into receptions
 *       instead of picks.
 *   <li><b>DB ball skills + coverage technique</b> — ball-hawk safeties / corners do the opposite,
 *       depressing completions and inflating picks.
 * </ul>
 *
 * <p>The aggregate is signed: positive means offense advantage, negative means ball-hawking defense
 * advantage. With league-average attributes the shift is exactly zero and the desperation mix
 * reproduces the published hail-mary distribution.
 */
public final class HailMaryPassResolver implements PassResolver {

  private static final String HAIL_MARY = "hail-mary.json";

  /**
   * Per-outcome β coefficients for the desperation outcome mix. Positive shift (offense advantage)
   * raises completions and reduces interceptions; negative shift does the opposite. SACK / SCRAMBLE
   * stay at zero — the desperation mix doesn't sample those, but the values are required by {@link
   * BandSampler} for an exhaustive enum.
   */
  private static final Map<PassOutcomeKind, Double> DESPERATION_BETAS =
      Map.of(
          PassOutcomeKind.COMPLETE, 0.6,
          PassOutcomeKind.INCOMPLETE, 0.0,
          PassOutcomeKind.INTERCEPTION, -0.6,
          PassOutcomeKind.SACK, 0.0,
          PassOutcomeKind.SCRAMBLE, 0.0);

  /** Maximum absolute shift the attribute aggregate can produce; bounds elite/floor swings. */
  static final double SHIFT_ENVELOPE = 1.0;

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
    var mix = new RateBand<>(rawMix.baseProbabilities(), DESPERATION_BETAS);
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
    var shift = computeShift(offense, defense);
    var outcome = sampler.sampleRate(outcomeMix, shift, rng);
    return switch (outcome) {
      case COMPLETE -> {
        var yards = sampler.sampleDistribution(completionYards, shift, rng);
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
      case SACK, SCRAMBLE ->
          new PassOutcome.PassIncomplete(
              qb, target, 0, IncompleteReason.BROKEN_UP, Optional.empty());
    };
  }

  static double computeShift(OffensivePersonnel offense, DefensivePersonnel defense) {
    var qbEdge = qbHeaveEdge(offense.quarterback());
    var receiverEdge = meanReceiverContestedEdge(offense);
    var defenderEdge = meanDefenderBallSkillsEdge(defense);
    var raw = (qbEdge + receiverEdge) / 2.0 - defenderEdge;
    return clamp(raw, SHIFT_ENVELOPE);
  }

  private static double qbHeaveEdge(Player qb) {
    var skill = qb.skill();
    return centered((skill.armStrength() + skill.deepAccuracy()) / 2.0);
  }

  private static double meanReceiverContestedEdge(OffensivePersonnel offense) {
    var n = 0;
    var sum = 0.0;
    for (var p : offense.players()) {
      if (p.position() == Position.WR || p.position() == Position.TE) {
        var skill = p.skill();
        sum += centered((skill.contestedCatch() + skill.hands()) / 2.0);
        n++;
      }
    }
    if (n == 0) {
      return 0.0;
    }
    return sum / n;
  }

  private static double meanDefenderBallSkillsEdge(DefensivePersonnel defense) {
    var n = 0;
    var sum = 0.0;
    for (var p : defense.players()) {
      if (p.position() == Position.S || p.position() == Position.CB) {
        var skill = p.skill();
        sum += centered((skill.ballSkills() + skill.coverageTechnique()) / 2.0);
        n++;
      }
    }
    if (n == 0) {
      return 0.0;
    }
    return sum / n;
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

  private static double centered(double zeroToHundred) {
    return (zeroToHundred / 100.0 - 0.5) * 2.0;
  }

  private static double clamp(double value, double limit) {
    if (value > limit) {
      return limit;
    }
    if (value < -limit) {
      return -limit;
    }
    return value;
  }
}
