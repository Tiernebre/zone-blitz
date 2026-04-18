package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.band.BandRepository;
import app.zoneblitz.gamesimulator.band.BandSampler;
import app.zoneblitz.gamesimulator.band.DistributionalBand;
import app.zoneblitz.gamesimulator.band.RateBand;
import app.zoneblitz.gamesimulator.event.IncompleteReason;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.formation.BandCoverageShellSampler;
import app.zoneblitz.gamesimulator.formation.CoverageShellSampler;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.resolver.PassOutcome;
import app.zoneblitz.gamesimulator.resolver.PassRoleAssigner;
import app.zoneblitz.gamesimulator.resolver.PassRoles;
import app.zoneblitz.gamesimulator.resolver.PositionBasedPassRoleAssigner;
import app.zoneblitz.gamesimulator.resolver.pass.BaselinePassResolver.PassOutcomeKind;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Role-based, matchup-aware pass resolver. Uses the same {@code passing-plays.json} bands as {@link
 * BaselinePassResolver}; adds role bucketing via {@link PassRoleAssigner}, a single {@link
 * PassMatchupShift} scalar that feeds the rate band's per-outcome β coefficients inside {@link
 * BandSampler#sampleRate}, and a {@link TargetSelector} that picks the intended receiver for
 * throw-shaped outcomes.
 *
 * <p>With the shipped band (all β = 0), average-attribute rosters, and a deterministic target
 * selector that draws no randomness, this resolver reproduces {@link BaselinePassResolver}
 * byte-for-byte. The default {@link ScoreBasedTargetSelector} consumes one Gaussian per candidate
 * receiver, so the bit-parity property is a structural invariant of the resolver + a non-consuming
 * selector, not of the default wiring.
 */
public final class MatchupPassResolver implements PassResolver {

  private static final String PASSING_PLAYS = "passing-plays.json";

  private static final long SHELL_SPLIT_KEY = 0x2222_ccddL;

  private final BandSampler sampler;
  private final PassRoleAssigner roleAssigner;
  private final PassMatchupShift matchupShift;
  private final CoverageShellSampler shellSampler;
  private final TargetSelector targetSelector;
  private final RateBand<PassOutcomeKind> outcomeMix;
  private final DistributionalBand completionYards;
  private final DistributionalBand sackYards;
  private final DistributionalBand scrambleYards;

  public MatchupPassResolver(
      BandSampler sampler,
      PassRoleAssigner roleAssigner,
      PassMatchupShift matchupShift,
      CoverageShellSampler shellSampler,
      TargetSelector targetSelector,
      RateBand<PassOutcomeKind> outcomeMix,
      DistributionalBand completionYards,
      DistributionalBand sackYards,
      DistributionalBand scrambleYards) {
    this.sampler = Objects.requireNonNull(sampler, "sampler");
    this.roleAssigner = Objects.requireNonNull(roleAssigner, "roleAssigner");
    this.matchupShift = Objects.requireNonNull(matchupShift, "matchupShift");
    this.shellSampler = Objects.requireNonNull(shellSampler, "shellSampler");
    this.targetSelector = Objects.requireNonNull(targetSelector, "targetSelector");
    this.outcomeMix = Objects.requireNonNull(outcomeMix, "outcomeMix");
    this.completionYards = Objects.requireNonNull(completionYards, "completionYards");
    this.sackYards = Objects.requireNonNull(sackYards, "sackYards");
    this.scrambleYards = Objects.requireNonNull(scrambleYards, "scrambleYards");
  }

  /**
   * Load a resolver from {@code passing-plays.json} with position-based roles, the clamped
   * attribute-aware pass-matchup shift, and the score-based target selector.
   */
  public static MatchupPassResolver load(BandRepository repo, BandSampler sampler) {
    var outcomeMix = repo.loadRate(PASSING_PLAYS, "bands.outcome_mix", PassOutcomeKind.class);
    var completionYards = repo.loadDistribution(PASSING_PLAYS, "bands.yardage.completion_yards");
    var sackYards = repo.loadDistribution(PASSING_PLAYS, "bands.yardage.sack_yards");
    var scrambleYards = repo.loadDistribution(PASSING_PLAYS, "bands.yardage.scramble_yards");
    var shellSampler = BandCoverageShellSampler.load(repo);
    var composite =
        new CompositePassMatchupShift(new ClampedPassMatchupShift(), new CoverageShellPassShift());
    return new MatchupPassResolver(
        sampler,
        new PositionBasedPassRoleAssigner(),
        composite,
        shellSampler,
        new ScoreBasedTargetSelector(),
        outcomeMix,
        completionYards,
        sackYards,
        scrambleYards);
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

    var qbPlayer = offense.quarterback();
    var qb = qbPlayer.id();
    var roles = roleAssigner.assign(call, offense, defense);
    var shellRng = rng.split(SHELL_SPLIT_KEY);
    var shell = shellSampler.sample(call.formation(), shellRng);
    var context = new PassMatchupContext(roles, call.formation(), shell);
    var shift = matchupShift.compute(context, rng);
    var target = resolveTarget(call, roles, qbPlayer, qb, rng);
    var outcome = sampler.sampleRate(outcomeMix, shift, rng);

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
        var interceptor = pickInterceptor(roles, defense);
        yield new PassOutcome.Interception(qb, target, interceptor, 0, false);
      }
    };
  }

  private PlayerId resolveTarget(
      PlayCaller.PlayCall call, PassRoles roles, Player qbPlayer, PlayerId qbId, RandomSource rng) {
    if (roles.routeRunners().isEmpty()) {
      return qbId;
    }
    var choice = targetSelector.select(call, roles, qbPlayer, rng);
    return switch (choice) {
      case TargetChoice.Throw t -> t.receiverId();
      case TargetChoice.Scramble ignored -> qbId;
      case TargetChoice.Throwaway ignored -> qbId;
      case TargetChoice.Sack ignored -> qbId;
    };
  }

  private static PlayerId pickInterceptor(PassRoles roles, DefensivePersonnel defense) {
    if (!roles.coverageDefenders().isEmpty()) {
      return roles.coverageDefenders().get(0).id();
    }
    if (!roles.passRushers().isEmpty()) {
      return roles.passRushers().get(0).id();
    }
    if (defense.players().isEmpty()) {
      throw new IllegalStateException("Defense has no players to intercept the pass");
    }
    return defense.players().get(0).id();
  }

  /**
   * Single-scalar role-aggregate reducer. Encodes the full matchup signal — pass-rush win vs.
   * coverage win — into one number that combines with the rate band's per-outcome β coefficients
   * inside {@link BandSampler#sampleRate}. The {@link #ZERO} default leaves outcome sampling at the
   * base distribution; R4's attribute-aware aggregator replaces it once {@code Physical} and {@code
   * Skill} land on {@code Player}.
   */
  @FunctionalInterface
  public interface PassMatchupShift {

    /** Identity shift — keeps the resolver baseline-equivalent. */
    PassMatchupShift ZERO = (context, rng) -> 0.0;

    double compute(PassMatchupContext context, RandomSource rng);
  }
}
