package app.zoneblitz.gamesimulator.resolver;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.PlayCaller;
import app.zoneblitz.gamesimulator.band.BandRepository;
import app.zoneblitz.gamesimulator.band.BandSampler;
import app.zoneblitz.gamesimulator.band.DistributionalBand;
import app.zoneblitz.gamesimulator.band.RateBand;
import app.zoneblitz.gamesimulator.event.IncompleteReason;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.resolver.BaselinePassResolver.PassOutcomeKind;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Role-based, matchup-aware pass resolver. Uses the same {@code passing-plays.json} bands as {@link
 * BaselinePassResolver}; adds role bucketing via {@link RoleAssigner} and a single {@link
 * PassMatchupShift} scalar that feeds the rate band's per-outcome β coefficients inside {@link
 * BandSampler#sampleRate}.
 *
 * <p>R3 keeps {@code m_coverage} as a single aggregate — per-receiver matchups and target selection
 * land in R5. Yardage distributions sample with zero shift; pressure-driven yardage shaping arrives
 * with the attribute families in R4. Target and interceptor picks prefer role buckets so a blitzing
 * CB no longer intercepts from the coverage pool.
 *
 * <p>With the shipped band (all β = 0) and every player at {@code average()} attributes, the
 * clamped shift evaluates to zero and this resolver reproduces {@link BaselinePassResolver}
 * byte-for-byte — the two consume RNG in the exact same order and resolve to the same outcomes.
 */
public final class MatchupPassResolver implements PlayResolver {

  private static final String PASSING_PLAYS = "passing-plays.json";

  private final BandSampler sampler;
  private final RoleAssigner roleAssigner;
  private final PassMatchupShift matchupShift;
  private final RateBand<PassOutcomeKind> outcomeMix;
  private final DistributionalBand completionYards;
  private final DistributionalBand sackYards;
  private final DistributionalBand scrambleYards;

  public MatchupPassResolver(
      BandSampler sampler,
      RoleAssigner roleAssigner,
      PassMatchupShift matchupShift,
      RateBand<PassOutcomeKind> outcomeMix,
      DistributionalBand completionYards,
      DistributionalBand sackYards,
      DistributionalBand scrambleYards) {
    this.sampler = Objects.requireNonNull(sampler, "sampler");
    this.roleAssigner = Objects.requireNonNull(roleAssigner, "roleAssigner");
    this.matchupShift = Objects.requireNonNull(matchupShift, "matchupShift");
    this.outcomeMix = Objects.requireNonNull(outcomeMix, "outcomeMix");
    this.completionYards = Objects.requireNonNull(completionYards, "completionYards");
    this.sackYards = Objects.requireNonNull(sackYards, "sackYards");
    this.scrambleYards = Objects.requireNonNull(scrambleYards, "scrambleYards");
  }

  /**
   * Load a resolver from {@code passing-plays.json} with position-based roles and the clamped
   * attribute-aware pass-matchup shift. Average-attribute rosters produce a zero shift and stay
   * baseline-equivalent; attribute-differentiated rosters exercise the physical-fit clamp.
   */
  public static MatchupPassResolver load(BandRepository repo, BandSampler sampler) {
    var outcomeMix = repo.loadRate(PASSING_PLAYS, "bands.outcome_mix", PassOutcomeKind.class);
    var completionYards = repo.loadDistribution(PASSING_PLAYS, "bands.yardage.completion_yards");
    var sackYards = repo.loadDistribution(PASSING_PLAYS, "bands.yardage.sack_yards");
    var scrambleYards = repo.loadDistribution(PASSING_PLAYS, "bands.yardage.scramble_yards");
    return new MatchupPassResolver(
        sampler,
        new PositionBasedRoleAssigner(),
        new ClampedPassMatchupShift(),
        outcomeMix,
        completionYards,
        sackYards,
        scrambleYards);
  }

  @Override
  public PlayOutcome resolve(
      PlayCaller.PlayCall call, GameState state, Team offense, Team defense, RandomSource rng) {
    Objects.requireNonNull(call, "call");
    Objects.requireNonNull(state, "state");
    Objects.requireNonNull(offense, "offense");
    Objects.requireNonNull(defense, "defense");
    Objects.requireNonNull(rng, "rng");

    var qb =
        firstWithPosition(offense.roster(), Position.QB)
            .orElseThrow(
                () ->
                    new IllegalStateException(
                        "Offense has no QB on roster: " + offense.displayName()));
    var roles = roleAssigner.assign(call, offense, defense);
    var shift = matchupShift.compute(roles, offense, defense);
    var target = pickTarget(roles, qb);
    var outcome = sampler.sampleRate(outcomeMix, shift, rng);

    return switch (outcome) {
      case COMPLETE -> {
        var yards = sampler.sampleDistribution(completionYards, 0.0, rng);
        yield new PlayOutcome.PassComplete(
            qb, target, yards, 0, yards, Optional.empty(), List.of(), false, false);
      }
      case INCOMPLETE ->
          new PlayOutcome.PassIncomplete(
              qb, target, 0, IncompleteReason.OVERTHROWN, Optional.empty());
      case SACK -> {
        var sampled = sampler.sampleDistribution(sackYards, 0.0, rng);
        yield new PlayOutcome.Sack(qb, List.of(), -sampled, Optional.empty());
      }
      case SCRAMBLE -> {
        var yards = sampler.sampleDistribution(scrambleYards, 0.0, rng);
        yield new PlayOutcome.Scramble(qb, yards, Optional.empty(), false, false);
      }
      case INTERCEPTION -> {
        var interceptor = pickInterceptor(roles, defense.roster());
        yield new PlayOutcome.Interception(qb, target, interceptor, 0, false);
      }
    };
  }

  private static PlayerId pickTarget(Roles roles, PlayerId qb) {
    return roles.routeRunners().isEmpty() ? qb : roles.routeRunners().get(0).id();
  }

  private static PlayerId pickInterceptor(Roles roles, List<Player> defenseRoster) {
    if (!roles.coverageDefenders().isEmpty()) {
      return roles.coverageDefenders().get(0).id();
    }
    if (!roles.passRushers().isEmpty()) {
      return roles.passRushers().get(0).id();
    }
    if (defenseRoster.isEmpty()) {
      throw new IllegalStateException("Defense has no players to intercept the pass");
    }
    return defenseRoster.get(0).id();
  }

  private static Optional<PlayerId> firstWithPosition(List<Player> roster, Position position) {
    return roster.stream().filter(p -> p.position() == position).map(Player::id).findFirst();
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
    PassMatchupShift ZERO = (roles, offense, defense) -> 0.0;

    double compute(Roles roles, Team offense, Team defense);
  }
}
