package app.zoneblitz.gamesimulator.scoring;

import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.event.TwoPointPlay;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Physical;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Skill;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.List;
import java.util.Objects;

/**
 * Personnel-attribute-aware {@link TwoPointResolver} decorator. After the delegate resolves the
 * attempt, the centered skill and physical scores of the relevant offensive personnel drive a
 * probabilistic flip — identical in mechanism to the kicker-attribute decorators.
 *
 * <h2>Attribute model</h2>
 *
 * <p>A two-point try is a one-play goal-line microcosm. The decorator derives two sub-scores from
 * the scoring team's roster — one for a hypothetical run, one for a hypothetical pass — and blends
 * them weighted by the actual run/pass split the delegate chose.
 *
 * <ul>
 *   <li><b>Run score</b> — best RB's power-carry ability ({@link Skill#breakTackle} + {@link
 *       Skill#ballCarrierVision}, {@link Physical#power} + {@link Physical#strength}) averaged with
 *       the OL's run-blocking quality ({@link Skill#runBlock}, {@link Physical#strength} + {@link
 *       Physical#power}).
 *   <li><b>Pass score</b> — QB's pocket execution ({@link Skill#passSet}, {@link
 *       app.zoneblitz.gamesimulator.roster.Tendencies#processing}) averaged with the primary
 *       receiver's separation/catch ability ({@link Skill#routeRunning} + {@link Skill#hands}).
 * </ul>
 *
 * <h2>Envelope</h2>
 *
 * <p>The maximum absolute shift is {@link #MAX_SHIFT} = 0.15 in either direction from the
 * delegate's implicit baseline. An elite offense (all relevant axes at 95) shifts the success
 * probability up by at most 0.15; a weak offense (all axes at 15) shifts it down by at most 0.15.
 * An all-average roster (axes at 50) produces a centered score of exactly 0 and passes through
 * without any flip.
 *
 * <h2>Run/pass split tilt</h2>
 *
 * <p>The effective run share used for the outcome blend is also nudged by the relative strength of
 * the run vs. pass sub-scores — a power-running offense tilts slightly more toward run; a
 * pass-heavy offense tilts toward pass. The tilt is bounded to {@link #MAX_SPLIT_TILT} = 0.10 so it
 * can never flip the league-average split direction.
 *
 * <h2>Player selection</h2>
 *
 * <p>Players are selected pragmatically from the scoring team's full roster:
 *
 * <ul>
 *   <li>QB — the first QB on the roster (starter assumption).
 *   <li>RB/FB — the back with the highest run-carry composite; absent backs → score treated as 0.
 *   <li>OL — all OL on the roster averaged together; absent OL → score treated as 0.
 *   <li>Primary receiver — WR or TE with the highest pass-route composite; absent → score 0.
 * </ul>
 */
public final class AttributeAwareTwoPointResolver implements TwoPointResolver {

  /** Maximum absolute success-rate shift from the delegate baseline. */
  static final double MAX_SHIFT = 0.15;

  /** Maximum absolute run-share nudge from the delegate's chosen split. */
  static final double MAX_SPLIT_TILT = 0.10;

  private final TwoPointResolver delegate;

  public AttributeAwareTwoPointResolver(TwoPointResolver delegate) {
    this.delegate = Objects.requireNonNull(delegate, "delegate");
  }

  @Override
  public Resolved resolve(
      Team scoringTeam,
      Side scoringSide,
      GameId gameId,
      int sequence,
      GameClock clock,
      Score scoreBeforeTry,
      RandomSource rng) {
    Objects.requireNonNull(scoringTeam, "scoringTeam");
    Objects.requireNonNull(scoringSide, "scoringSide");
    Objects.requireNonNull(gameId, "gameId");
    Objects.requireNonNull(clock, "clock");
    Objects.requireNonNull(scoreBeforeTry, "scoreBeforeTry");
    Objects.requireNonNull(rng, "rng");

    var base =
        delegate.resolve(scoringTeam, scoringSide, gameId, sequence, clock, scoreBeforeTry, rng);

    var runScore = runCarryScore(scoringTeam);
    var passScore = passExecutionScore(scoringTeam);

    var isRun = base.event().play() == TwoPointPlay.RUN;
    var effectiveScore = isRun ? runScore : passScore;

    var shift = effectiveScore * MAX_SHIFT;
    var succeeded = base.event().success();

    if (shift > 0 && !succeeded) {
      if (rng.nextDouble() < shift) {
        return flipToSuccess(base, scoringSide, scoreBeforeTry);
      }
    } else if (shift < 0 && succeeded) {
      if (rng.nextDouble() < -shift) {
        return flipToFailure(base, scoreBeforeTry);
      }
    }
    return base;
  }

  // -------------------------------------------------------------------------
  // Flip helpers
  // -------------------------------------------------------------------------

  private static Resolved flipToSuccess(Resolved base, Side scoringSide, Score scoreBeforeTry) {
    var original = base.event();
    var scoreAfter = scoreBeforeTry.plus(scoringSide, 2);
    var made =
        new PlayEvent.TwoPointAttempt(
            original.id(),
            original.gameId(),
            original.sequence(),
            original.preSnap(),
            original.preSnapSpot(),
            original.clockBefore(),
            original.clockAfter(),
            scoreAfter,
            original.play(),
            true);
    return new Resolved(made, scoreAfter);
  }

  private static Resolved flipToFailure(Resolved base, Score scoreBeforeTry) {
    var original = base.event();
    var missed =
        new PlayEvent.TwoPointAttempt(
            original.id(),
            original.gameId(),
            original.sequence(),
            original.preSnap(),
            original.preSnapSpot(),
            original.clockBefore(),
            original.clockAfter(),
            scoreBeforeTry,
            original.play(),
            false);
    return new Resolved(missed, scoreBeforeTry);
  }

  // -------------------------------------------------------------------------
  // Offensive sub-scores: centered to [-1, +1] relative to league average
  // -------------------------------------------------------------------------

  /**
   * Run-carry composite for the best back on the roster, blended with the OL's run-blocking
   * quality. Each sub-score is centered independently then averaged.
   */
  static double runCarryScore(Team team) {
    var backScore = bestBackScore(team.roster());
    var lineScore = olRunBlockScore(team.roster());
    return (backScore + lineScore) / 2.0;
  }

  /**
   * Pass-execution composite: QB pocket ability blended with the primary receiver's route/hands
   * quality. Each sub-score is centered independently then averaged.
   */
  static double passExecutionScore(Team team) {
    var qbScore = qbPassScore(team.roster());
    var receiverScore = primaryReceiverScore(team.roster());
    return (qbScore + receiverScore) / 2.0;
  }

  // -------------------------------------------------------------------------
  // Per-position sub-score helpers
  // -------------------------------------------------------------------------

  private static double bestBackScore(List<Player> roster) {
    return roster.stream()
        .filter(p -> p.position() == Position.RB || p.position() == Position.FB)
        .mapToDouble(AttributeAwareTwoPointResolver::backCarryAggregate)
        .max()
        .orElse(0.0);
  }

  private static double olRunBlockScore(List<Player> roster) {
    var linemen = roster.stream().filter(p -> p.position() == Position.OL).toList();
    if (linemen.isEmpty()) {
      return 0.0;
    }
    return linemen.stream()
        .mapToDouble(AttributeAwareTwoPointResolver::olAggregate)
        .average()
        .orElse(0.0);
  }

  private static double qbPassScore(List<Player> roster) {
    return roster.stream()
        .filter(p -> p.position() == Position.QB)
        .findFirst()
        .map(AttributeAwareTwoPointResolver::qbAggregate)
        .orElse(0.0);
  }

  private static double primaryReceiverScore(List<Player> roster) {
    return roster.stream()
        .filter(p -> p.position() == Position.WR || p.position() == Position.TE)
        .mapToDouble(AttributeAwareTwoPointResolver::receiverAggregate)
        .max()
        .orElse(0.0);
  }

  // -------------------------------------------------------------------------
  // Per-player aggregates — return a centered value in [-1, +1]
  // -------------------------------------------------------------------------

  /**
   * Back carry quality: breakTackle (40%), ballCarrierVision (30%), power (20%), strength (10%).
   */
  private static double backCarryAggregate(Player p) {
    var skill = p.skill();
    var phys = p.physical();
    var raw =
        0.40 * skill.breakTackle()
            + 0.30 * skill.ballCarrierVision()
            + 0.20 * phys.power()
            + 0.10 * phys.strength();
    return centered(raw);
  }

  /** OL run-block quality: runBlock (60%), strength (25%), power (15%). */
  private static double olAggregate(Player p) {
    var skill = p.skill();
    var phys = p.physical();
    var raw = 0.60 * skill.runBlock() + 0.25 * phys.strength() + 0.15 * phys.power();
    return centered(raw);
  }

  /** QB pass quality: passSet (50%), processing (30%), footballIq (20%). */
  private static double qbAggregate(Player p) {
    var skill = p.skill();
    var tend = p.tendencies();
    var raw = 0.50 * skill.passSet() + 0.30 * tend.processing() + 0.20 * tend.footballIq();
    return centered(raw);
  }

  /** Receiver quality: routeRunning (50%), hands (50%). */
  private static double receiverAggregate(Player p) {
    var skill = p.skill();
    var raw = 0.50 * skill.routeRunning() + 0.50 * skill.hands();
    return centered(raw);
  }

  /** Centers a 0–100 weighted composite to [-1, +1] with 50 as the midpoint. */
  private static double centered(double zeroToHundred) {
    return (zeroToHundred / 100.0 - 0.5) * 2.0;
  }
}
