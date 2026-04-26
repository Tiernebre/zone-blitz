package app.zoneblitz.gamesimulator.resolver.run;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.adjustments.DefensiveAdjustmentSource;
import app.zoneblitz.gamesimulator.adjustments.StatsBasedDefensiveAdjustments;
import app.zoneblitz.gamesimulator.band.BandRepository;
import app.zoneblitz.gamesimulator.band.BandSampler;
import app.zoneblitz.gamesimulator.band.DistributionalBand;
import app.zoneblitz.gamesimulator.band.RateBand;
import app.zoneblitz.gamesimulator.event.FumbleOutcome;
import app.zoneblitz.gamesimulator.formation.BandBoxCountSampler;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller;
import app.zoneblitz.gamesimulator.resolver.BaselineFumbleRecoveryModel;
import app.zoneblitz.gamesimulator.resolver.FumbleRecoveryModel;
import app.zoneblitz.gamesimulator.resolver.RunOutcome;
import app.zoneblitz.gamesimulator.resolver.RunRoles;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.role.RoleAssigner;
import app.zoneblitz.gamesimulator.role.SchemeFitRoleAssigner;
import app.zoneblitz.gamesimulator.roster.DefensiveCoachTendencies;
import app.zoneblitz.gamesimulator.scheme.BuiltinSchemeCatalog;
import app.zoneblitz.gamesimulator.scheme.DefensiveScheme;
import app.zoneblitz.gamesimulator.scheme.DefensiveSchemeId;
import app.zoneblitz.gamesimulator.scheme.OffensiveScheme;
import app.zoneblitz.gamesimulator.scheme.OffensiveSchemeId;
import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * Role-based, matchup-aware run resolver. Loads a four-way {@code RateBand<RunOutcomeKind>} from
 * {@code rushing-plays.json} ({@code STUFF | NORMAL | BREAKAWAY | FUMBLE}) together with a yardage
 * sub-distribution per non-fumble kind; fumbled runs fall back to the overall yardage distribution.
 * The {@link RunMatchupShift} scalar feeds per-outcome β coefficients inside {@link BandSampler} so
 * a talent advantage redirects probability mass toward {@code BREAKAWAY} and away from {@code
 * STUFF} instead of merely sliding one aggregate ladder.
 *
 * <p>With {@link RunMatchupShift#ZERO} (or average-attribute rosters under {@link
 * RoleMatchupRunShift}) the resolver reproduces the shipped outcome-mix rates and per-bucket ladder
 * percentiles — baseline parity is a structural invariant of the resolver, not a wiring accident.
 * Carrier identity is decided pre-snap by the {@link RoleAssigner}; tackler identity is deferred
 * until run-defender assignment separates first-level from second-level defenders.
 *
 * <p>{@link RunOutcomeKind} is an engine-internal sampling classifier. Consumers see only {@link
 * RunOutcome.Run} with its {@code yards} field — a stuff reads as a {@code -2}-yard run, a
 * breakaway reads as a {@code 32}-yard run. The classifier never escapes this package.
 */
public final class MatchupRunResolver implements RunResolver {

  private static final String RUSHING_PLAYS = "rushing-plays.json";

  /**
   * First-cut β coefficients for outcome sampling. Sign convention matches the shift: positive
   * shift ⇒ offense talent advantage.
   *
   * <p>Stuffs and fumbles get negative β so a strong offense produces fewer of each; breakaways get
   * positive β so the same shift produces more. {@code NORMAL} sits at 0 as the residual bucket.
   * These are hand-tuned starting values; the calibration harness will refine them once the run
   * resolver is wired into the simulate-season loop.
   */
  private static final Map<RunOutcomeKind, Double> DEFAULT_BETAS =
      Map.of(
          RunOutcomeKind.STUFF, -0.4,
          RunOutcomeKind.NORMAL, 0.0,
          RunOutcomeKind.BREAKAWAY, 0.5,
          RunOutcomeKind.FUMBLE, -0.2);

  private final BandSampler sampler;
  private final RoleAssigner roleAssigner;
  private final OffensiveScheme offenseScheme;
  private final DefensiveScheme defenseScheme;
  private final RunMatchupShift matchupShift;
  private final RateBand<RunOutcomeKind> outcomeMix;
  private final Map<RunOutcomeKind, DistributionalBand> yardsByKind;
  private final DistributionalBand fumbleYards;
  private final FumbleRecoveryModel fumbleRecoveryModel;
  private final DefensiveAdjustmentSource defensiveAdjustments =
      new StatsBasedDefensiveAdjustments();

  public MatchupRunResolver(
      BandSampler sampler,
      RoleAssigner roleAssigner,
      OffensiveScheme offenseScheme,
      DefensiveScheme defenseScheme,
      RunMatchupShift matchupShift,
      RateBand<RunOutcomeKind> outcomeMix,
      Map<RunOutcomeKind, DistributionalBand> yardsByKind,
      DistributionalBand fumbleYards) {
    this(
        sampler,
        roleAssigner,
        offenseScheme,
        defenseScheme,
        matchupShift,
        outcomeMix,
        yardsByKind,
        fumbleYards,
        new BaselineFumbleRecoveryModel());
  }

  public MatchupRunResolver(
      BandSampler sampler,
      RoleAssigner roleAssigner,
      OffensiveScheme offenseScheme,
      DefensiveScheme defenseScheme,
      RunMatchupShift matchupShift,
      RateBand<RunOutcomeKind> outcomeMix,
      Map<RunOutcomeKind, DistributionalBand> yardsByKind,
      DistributionalBand fumbleYards,
      FumbleRecoveryModel fumbleRecoveryModel) {
    this.sampler = Objects.requireNonNull(sampler, "sampler");
    this.roleAssigner = Objects.requireNonNull(roleAssigner, "roleAssigner");
    this.offenseScheme = Objects.requireNonNull(offenseScheme, "offenseScheme");
    this.defenseScheme = Objects.requireNonNull(defenseScheme, "defenseScheme");
    this.matchupShift = Objects.requireNonNull(matchupShift, "matchupShift");
    this.outcomeMix = Objects.requireNonNull(outcomeMix, "outcomeMix");
    this.fumbleRecoveryModel = Objects.requireNonNull(fumbleRecoveryModel, "fumbleRecoveryModel");
    Objects.requireNonNull(yardsByKind, "yardsByKind");
    for (var kind :
        new RunOutcomeKind[] {
          RunOutcomeKind.STUFF, RunOutcomeKind.NORMAL, RunOutcomeKind.BREAKAWAY
        }) {
      if (!yardsByKind.containsKey(kind)) {
        throw new IllegalArgumentException("yardsByKind missing entry for " + kind);
      }
    }
    this.yardsByKind = Map.copyOf(yardsByKind);
    this.fumbleYards = Objects.requireNonNull(fumbleYards, "fumbleYards");
  }

  /**
   * Load a resolver from {@code rushing-plays.json} with position-based roles, the default
   * per-outcome β coefficients, and a composite shift stacking the clamped attribute-aware shift
   * and a box-count-aware shift driven by {@link BandBoxCountSampler}.
   */
  public static MatchupRunResolver load(BandRepository repo, BandSampler sampler) {
    var loadedMix = repo.loadRate(RUSHING_PLAYS, "bands.outcome_mix", RunOutcomeKind.class);
    var outcomeMix = new RateBand<>(loadedMix.baseProbabilities(), DEFAULT_BETAS);

    var yardsByKind = new EnumMap<RunOutcomeKind, DistributionalBand>(RunOutcomeKind.class);
    yardsByKind.put(
        RunOutcomeKind.STUFF, repo.loadDistribution(RUSHING_PLAYS, "bands.by_outcome.stuff"));
    yardsByKind.put(
        RunOutcomeKind.NORMAL, repo.loadDistribution(RUSHING_PLAYS, "bands.by_outcome.normal"));
    yardsByKind.put(
        RunOutcomeKind.BREAKAWAY,
        repo.loadDistribution(RUSHING_PLAYS, "bands.by_outcome.breakaway"));
    var fumbleYards = repo.loadDistribution(RUSHING_PLAYS, "bands.overall");
    var fumbleReturnYards = repo.loadDistribution(RUSHING_PLAYS, "bands.fumble_return_yards");

    var boxSampler = BandBoxCountSampler.load(repo);
    var composite =
        new CompositeRunMatchupShift(
            new RoleMatchupRunShift(), new BoxCountRunShift(boxSampler), new GoalLineRunShift());

    var fumbleRecoveryModel =
        new BaselineFumbleRecoveryModel(
            BaselineFumbleRecoveryModel.DEFAULT_DEFENSE_RECOVERY_RATE, sampler, fumbleReturnYards);

    var catalog = new BuiltinSchemeCatalog();
    var defaultOffenseScheme = catalog.offense(OffensiveSchemeId.WEST_COAST);
    var defaultDefenseScheme = catalog.defense(DefensiveSchemeId.COVER_2_PRESS);
    return new MatchupRunResolver(
        sampler,
        new SchemeFitRoleAssigner(defaultOffenseScheme),
        defaultOffenseScheme,
        defaultDefenseScheme,
        composite,
        outcomeMix,
        yardsByKind,
        fumbleYards,
        fumbleRecoveryModel);
  }

  @Override
  public RunOutcome resolve(
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

    var assignment = roleAssigner.assign(call, offense, defense);
    var roles = RunRoles.from(assignment);
    var carrier =
        roles
            .ballCarrier()
            .orElseThrow(
                () ->
                    new IllegalStateException(
                        "Offensive personnel has no rushing-eligible player"));
    var concept = call.runConcept();
    var bundle =
        defensiveAdjustments.compute(
            state.stats().forOffense(state.possession()), DefensiveCoachTendencies.average());
    var context =
        new RunMatchupContext(
            concept,
            roles,
            call.formation(),
            state.spot().yardLine(),
            state.downAndDistance().yardsToGo(),
            offenseScheme,
            defenseScheme,
            assignment,
            bundle.boxLoadingShift());
    var shift = matchupShift.compute(context, rng);
    var kind = sampler.sampleRate(outcomeMix, shift, rng);
    var yardsBand = kind == RunOutcomeKind.FUMBLE ? fumbleYards : yardsByKind.get(kind);
    var yards = sampler.sampleDistribution(yardsBand, shift, rng);

    var fumble =
        kind == RunOutcomeKind.FUMBLE
            ? Optional.of(
                fumbleRecoveryModel.resolve(
                    carrier.id(), offense.players(), defense.players(), rng))
            : Optional.<FumbleOutcome>empty();

    return new RunOutcome.Run(carrier.id(), concept, yards, Optional.empty(), fumble, false);
  }

  /**
   * Single-scalar role-aggregate reducer for run plays. Encodes the full matchup signal — blocking
   * win plus carrier-vs-defense — into one number that combines with the outcome-mix band's
   * per-outcome β coefficients inside {@link BandSampler}. A positive shift represents an offensive
   * talent advantage.
   */
  @FunctionalInterface
  public interface RunMatchupShift {

    /** Identity shift — keeps the resolver baseline-equivalent. */
    RunMatchupShift ZERO = (context, rng) -> 0.0;

    /**
     * Compute the scalar shift for the supplied context.
     *
     * @param context pre-snap inputs: concept, roles, formation
     * @param rng randomness source; implementations that sample (e.g. box count) should {@link
     *     RandomSource#split(long)} off a child stream so the parent is not disturbed
     * @return signed scalar; positive values represent an offensive talent advantage
     */
    double compute(RunMatchupContext context, RandomSource rng);
  }
}
