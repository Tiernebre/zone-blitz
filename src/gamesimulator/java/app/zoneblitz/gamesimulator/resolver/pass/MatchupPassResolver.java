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
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * Role-based, matchup-aware pass resolver. Loads a five-way {@code RateBand<PassOutcomeKind>} from
 * {@code passing-plays.json} ({@code COMPLETE | INCOMPLETE | INTERCEPTION | SACK | SCRAMBLE})
 * together with per-outcome yardage distributions for completions, sacks, and scrambles. The {@link
 * PassMatchupShift} scalar feeds per-outcome β coefficients inside {@link BandSampler} so a talent
 * advantage redirects probability mass toward {@code COMPLETE} and away from {@code SACK} and
 * {@code INTERCEPTION} instead of merely sliding one aggregate ladder.
 *
 * <p>With {@link PassMatchupShift#ZERO} (or average-attribute rosters under {@link
 * ClampedPassMatchupShift}'s {@code DROPBACK} profile) the resolver reproduces the shipped
 * outcome-mix rates — baseline parity is a structural invariant of the resolver, not a wiring
 * accident. Target identity is decided by the {@link TargetSelector}; interceptor identity falls
 * back to first-available-by-role within coverage and rush roles until per-defender modeling lands.
 *
 * <p>{@link PassOutcomeKind} is an engine-internal sampling classifier. Consumers see only {@link
 * PassOutcome} variants — the classifier never escapes this package.
 */
public final class MatchupPassResolver implements PassResolver {

  private static final String PASSING_PLAYS = "passing-plays.json";

  private static final long SHELL_SPLIT_KEY = 0x2222_ccddL;

  /**
   * First-cut β coefficients for outcome sampling. Sign convention matches the shift: positive
   * shift ⇒ offense talent advantage.
   *
   * <p>Completions and scrambles get positive β so a strong offense produces more of each; sacks,
   * interceptions, and incompletions get negative β so the same shift produces fewer. These are
   * hand-tuned starting values grounded in 2022-24 league splits (sack rate 0% screen → 14%
   * dropback; completion rate 85% screen → 45% dropback); the calibration harness will refine them
   * once concept-aware simulate-season runs land.
   */
  private static final Map<PassOutcomeKind, Double> DEFAULT_BETAS =
      Map.of(
          PassOutcomeKind.COMPLETE, 0.4,
          PassOutcomeKind.INCOMPLETE, -0.1,
          PassOutcomeKind.INTERCEPTION, -0.4,
          PassOutcomeKind.SACK, -0.5,
          PassOutcomeKind.SCRAMBLE, 0.1);

  private static final long PRESSURE_SPLIT_KEY = 0x3333_eeffL;

  /**
   * Completion-yards percentile-shift coefficient layered on top of the band's own gamma. A
   * positive matchup shift (talent advantage, bust-prone coverage shell) pushes the sampled
   * percentile up, fattening the explosive-completion tail. Applied only to {@code
   * completion_yards}; sack-yards, scramble-yards, and interception-return-yards keep their
   * loaded-from-JSON gamma (currently zero) so those distributions remain unaffected.
   *
   * <p>Hand-tuned against {@code TalentAxisSweepCalibrationTests}: at {@code 0.04} the explosive
   * tail moves meaningfully but the win-rate step between adjacent talent pairs stays inside the
   * 30pp smoothness envelope. At saturation shift ±0.6 the uniform-draw input moves by {@code
   * ±0.024} percentile points — about a yard of mean swing on the completion ladder, which matches
   * the shell-level YPA spread seen in 2020-24 pbp. Baseline parity (shift = 0) is preserved
   * because the shift multiplies by zero.
   */
  private static final double DEFAULT_EXPLOSIVE_GAMMA = 0.04;

  private final BandSampler sampler;
  private final PassRoleAssigner roleAssigner;
  private final PassMatchupShift matchupShift;
  private final SituationalPassShift situationalShift;
  private final CoverageShellSampler shellSampler;
  private final TargetSelector targetSelector;
  private final PressureModel pressureModel;
  private final RateBand<PassOutcomeKind> outcomeMix;
  private final DistributionalBand completionYards;
  private final DistributionalBand sackYards;
  private final DistributionalBand scrambleYards;
  private final DistributionalBand interceptionReturnYards;

  public MatchupPassResolver(
      BandSampler sampler,
      PassRoleAssigner roleAssigner,
      PassMatchupShift matchupShift,
      CoverageShellSampler shellSampler,
      TargetSelector targetSelector,
      PressureModel pressureModel,
      RateBand<PassOutcomeKind> outcomeMix,
      DistributionalBand completionYards,
      DistributionalBand sackYards,
      DistributionalBand scrambleYards,
      DistributionalBand interceptionReturnYards) {
    this(
        sampler,
        roleAssigner,
        matchupShift,
        SituationalPassShift.ZERO,
        shellSampler,
        targetSelector,
        pressureModel,
        outcomeMix,
        completionYards,
        sackYards,
        scrambleYards,
        interceptionReturnYards);
  }

  MatchupPassResolver(
      BandSampler sampler,
      PassRoleAssigner roleAssigner,
      PassMatchupShift matchupShift,
      SituationalPassShift situationalShift,
      CoverageShellSampler shellSampler,
      TargetSelector targetSelector,
      PressureModel pressureModel,
      RateBand<PassOutcomeKind> outcomeMix,
      DistributionalBand completionYards,
      DistributionalBand sackYards,
      DistributionalBand scrambleYards,
      DistributionalBand interceptionReturnYards) {
    this.sampler = Objects.requireNonNull(sampler, "sampler");
    this.roleAssigner = Objects.requireNonNull(roleAssigner, "roleAssigner");
    this.matchupShift = Objects.requireNonNull(matchupShift, "matchupShift");
    this.situationalShift = Objects.requireNonNull(situationalShift, "situationalShift");
    this.shellSampler = Objects.requireNonNull(shellSampler, "shellSampler");
    this.targetSelector = Objects.requireNonNull(targetSelector, "targetSelector");
    this.pressureModel = Objects.requireNonNull(pressureModel, "pressureModel");
    this.outcomeMix = Objects.requireNonNull(outcomeMix, "outcomeMix");
    this.completionYards = Objects.requireNonNull(completionYards, "completionYards");
    this.sackYards = Objects.requireNonNull(sackYards, "sackYards");
    this.scrambleYards = Objects.requireNonNull(scrambleYards, "scrambleYards");
    this.interceptionReturnYards =
        Objects.requireNonNull(interceptionReturnYards, "interceptionReturnYards");
  }

  /**
   * Load a resolver from {@code passing-plays.json} with position-based roles, the default
   * per-outcome β coefficients, and a composite shift stacking the clamped attribute-aware shift
   * and a coverage-shell shift.
   */
  public static MatchupPassResolver load(BandRepository repo, BandSampler sampler) {
    var loadedMix = repo.loadRate(PASSING_PLAYS, "bands.outcome_mix", PassOutcomeKind.class);
    var outcomeMix = new RateBand<>(loadedMix.baseProbabilities(), DEFAULT_BETAS);

    var loadedCompletionYards =
        repo.loadDistribution(PASSING_PLAYS, "bands.yardage.completion_yards");
    var completionYards =
        new DistributionalBand(
            loadedCompletionYards.min(),
            loadedCompletionYards.max(),
            loadedCompletionYards.percentileLadder(),
            DEFAULT_EXPLOSIVE_GAMMA);
    var sackYards = repo.loadDistribution(PASSING_PLAYS, "bands.yardage.sack_yards");
    var scrambleYards = repo.loadDistribution(PASSING_PLAYS, "bands.yardage.scramble_yards");
    var interceptionReturnYards =
        repo.loadDistribution(PASSING_PLAYS, "bands.yardage.interception_return_yards");
    var shellSampler = BandCoverageShellSampler.load(repo);
    var composite =
        new CompositePassMatchupShift(new ClampedPassMatchupShift(), new CoverageShellPassShift());
    return new MatchupPassResolver(
        sampler,
        new PositionBasedPassRoleAssigner(),
        composite,
        new DownDistancePassShift(),
        shellSampler,
        new ScoreBasedTargetSelector(),
        new QbPressureEscape(),
        outcomeMix,
        completionYards,
        sackYards,
        scrambleYards,
        interceptionReturnYards);
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
    var context = new PassMatchupContext(call.passConcept(), roles, call.formation(), shell);
    var shift = matchupShift.compute(context, rng);
    var target = resolveTarget(call, roles, qbPlayer, qb, rng);
    var offsets = situationalShift.compute(state);
    var outcome = sampler.sampleRate(outcomeMix, shift, offsets, rng);

    return switch (outcome) {
      case COMPLETE -> {
        var yards = sampler.sampleDistribution(completionYards, shift, rng);
        yield new PassOutcome.PassComplete(
            qb, target, yards, 0, yards, Optional.empty(), List.of(), false);
      }
      case INCOMPLETE ->
          new PassOutcome.PassIncomplete(
              qb, target, 0, IncompleteReason.OVERTHROWN, Optional.empty());
      case SACK -> resolvePressure(qb, target, roles, qbPlayer, shift, rng);
      case SCRAMBLE -> {
        var yards = sampler.sampleDistribution(scrambleYards, shift, rng);
        yield new PassOutcome.Scramble(qb, yards, Optional.empty(), false);
      }
      case INTERCEPTION -> {
        var interceptor = pickInterceptor(roles, defense);
        var returnYards = sampler.sampleDistribution(interceptionReturnYards, shift, rng);
        yield new PassOutcome.Interception(qb, target, interceptor, returnYards);
      }
    };
  }

  private PassOutcome resolvePressure(
      PlayerId qb,
      PlayerId target,
      PassRoles roles,
      Player qbPlayer,
      double shift,
      RandomSource rng) {
    var pressureRng = rng.split(PRESSURE_SPLIT_KEY);
    var resolution = pressureModel.resolve(roles, qbPlayer, pressureRng);
    return switch (resolution) {
      case SACK -> {
        var sampled = sampler.sampleDistribution(sackYards, shift, rng);
        yield new PassOutcome.Sack(qb, List.of(), -sampled, Optional.empty());
      }
      case SCRAMBLE -> {
        var yards = sampler.sampleDistribution(scrambleYards, shift, rng);
        yield new PassOutcome.Scramble(qb, yards, Optional.empty(), false);
      }
      case THROWAWAY ->
          new PassOutcome.PassIncomplete(
              qb, target, 0, IncompleteReason.THROWN_AWAY, Optional.empty());
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
   * Single-scalar role-aggregate reducer for pass plays. Encodes the full matchup signal — coverage
   * win minus pass-rush win, weighted by concept — into one number that combines with the
   * outcome-mix band's per-outcome β coefficients inside {@link BandSampler#sampleRate}. A positive
   * shift represents an offensive talent advantage.
   */
  @FunctionalInterface
  public interface PassMatchupShift {

    /** Identity shift — keeps the resolver baseline-equivalent. */
    PassMatchupShift ZERO = (context, rng) -> 0.0;

    /**
     * Compute the scalar shift for the supplied context.
     *
     * @param context pre-snap inputs: concept, roles, formation, coverage shell
     * @param rng randomness source; implementations that sample (e.g. shell) should {@link
     *     RandomSource#split(long)} off a child stream so the parent is not disturbed
     * @return signed scalar; positive values represent an offensive talent advantage
     */
    double compute(PassMatchupContext context, RandomSource rng);
  }
}
