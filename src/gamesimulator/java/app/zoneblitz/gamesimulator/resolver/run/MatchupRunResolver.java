package app.zoneblitz.gamesimulator.resolver.run;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.band.BandRepository;
import app.zoneblitz.gamesimulator.band.BandSampler;
import app.zoneblitz.gamesimulator.band.DistributionalBand;
import app.zoneblitz.gamesimulator.band.RateBand;
import app.zoneblitz.gamesimulator.event.FumbleOutcome;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.RunConcept;
import app.zoneblitz.gamesimulator.resolver.PositionBasedRunRoleAssigner;
import app.zoneblitz.gamesimulator.resolver.RunOutcome;
import app.zoneblitz.gamesimulator.resolver.RunRoleAssigner;
import app.zoneblitz.gamesimulator.resolver.RunRoles;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.Objects;
import java.util.Optional;

/**
 * Role-based, matchup-aware run resolver. Uses the same {@code rushing-plays.json} yardage
 * distribution as {@link BaselineRunResolver}; adds role bucketing via {@link RunRoleAssigner}, a
 * single {@link RunMatchupShift} scalar that feeds the outcome-mix rate band's per-outcome β
 * coefficients and the yardage distribution's γ coefficient inside {@link BandSampler}.
 *
 * <p>The outcome-mix band is deliberately two-sided: {@code NORMAL} vs. {@code FUMBLE}. Stuffs and
 * breakaways are not separate outcome kinds — they fall out of the yardage distribution's tails.
 * When the matchup shift is zero (identity {@link RunMatchupShift#ZERO} or average-attribute
 * rosters with {@link ClampedRunMatchupShift}), outcome probabilities reproduce the base
 * fumble-rate and yardage sampling reproduces the ladder percentiles — so baseline parity is a
 * structural invariant of the resolver, not a wiring accident.
 *
 * <p>Carrier identity is decided pre-snap by the {@link RunRoleAssigner} from the play call, not
 * mid-snap here — the run analog of {@code TargetSelector} on the pass side is a no-op today.
 * Tackler identity is deferred until run-defender assignment gains more structure than a single
 * aggregate bucket.
 */
public final class MatchupRunResolver implements RunResolver {

  private static final String RUSHING_PLAYS = "rushing-plays.json";
  private static final RunConcept BASELINE_CONCEPT = RunConcept.INSIDE_ZONE;

  private final BandSampler sampler;
  private final RunRoleAssigner roleAssigner;
  private final RunMatchupShift matchupShift;
  private final RateBand<RunOutcomeKind> outcomeMix;
  private final DistributionalBand overallYards;

  public MatchupRunResolver(
      BandSampler sampler,
      RunRoleAssigner roleAssigner,
      RunMatchupShift matchupShift,
      RateBand<RunOutcomeKind> outcomeMix,
      DistributionalBand overallYards) {
    this.sampler = Objects.requireNonNull(sampler, "sampler");
    this.roleAssigner = Objects.requireNonNull(roleAssigner, "roleAssigner");
    this.matchupShift = Objects.requireNonNull(matchupShift, "matchupShift");
    this.outcomeMix = Objects.requireNonNull(outcomeMix, "outcomeMix");
    this.overallYards = Objects.requireNonNull(overallYards, "overallYards");
  }

  /**
   * Load a resolver from {@code rushing-plays.json} with position-based roles and the clamped
   * attribute-aware run-matchup shift.
   */
  public static MatchupRunResolver load(BandRepository repo, BandSampler sampler) {
    var outcomeMix = repo.loadRate(RUSHING_PLAYS, "bands.outcome_mix", RunOutcomeKind.class);
    var overallYards = repo.loadDistribution(RUSHING_PLAYS, "bands.overall");
    return new MatchupRunResolver(
        sampler,
        new PositionBasedRunRoleAssigner(),
        new ClampedRunMatchupShift(),
        outcomeMix,
        overallYards);
  }

  @Override
  public RunOutcome resolve(
      PlayCaller.PlayCall call, GameState state, Team offense, Team defense, RandomSource rng) {
    Objects.requireNonNull(call, "call");
    Objects.requireNonNull(state, "state");
    Objects.requireNonNull(offense, "offense");
    Objects.requireNonNull(defense, "defense");
    Objects.requireNonNull(rng, "rng");

    var roles = roleAssigner.assign(call, offense, defense);
    var carrier =
        roles
            .ballCarrier()
            .orElseThrow(
                () ->
                    new IllegalStateException(
                        "Offense has no rushing-eligible player on roster: "
                            + offense.displayName()));
    var shift = matchupShift.compute(roles, offense, defense);
    var outcome = sampler.sampleRate(outcomeMix, shift, rng);

    return switch (outcome) {
      case NORMAL -> {
        var yards = sampler.sampleDistribution(overallYards, shift, rng);
        yield new RunOutcome.Run(
            carrier.id(),
            BASELINE_CONCEPT,
            yards,
            Optional.empty(),
            Optional.empty(),
            false,
            false);
      }
      case FUMBLE -> {
        var yards = sampler.sampleDistribution(overallYards, shift, rng);
        yield new RunOutcome.Run(
            carrier.id(),
            BASELINE_CONCEPT,
            yards,
            Optional.empty(),
            Optional.of(fumble(carrier.id())),
            false,
            false);
      }
    };
  }

  private static FumbleOutcome fumble(PlayerId carrier) {
    return new FumbleOutcome(carrier, false, Optional.empty(), 0);
  }

  /**
   * Single-scalar role-aggregate reducer for run plays. Encodes the full matchup signal — blocking
   * win plus carrier-vs-defense — into one number that combines with the outcome-mix band's
   * per-outcome β coefficients and the yardage distribution's γ coefficient inside {@link
   * BandSampler}.
   */
  @FunctionalInterface
  public interface RunMatchupShift {

    /** Identity shift — keeps the resolver baseline-equivalent. */
    RunMatchupShift ZERO = (roles, offense, defense) -> 0.0;

    double compute(RunRoles roles, Team offense, Team defense);
  }
}
