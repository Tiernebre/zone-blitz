package app.zoneblitz.gamesimulator.penalty;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.event.PenaltyType;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.penalty.PenaltyCatalog.Bucket;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller;
import app.zoneblitz.gamesimulator.resolver.PlayOutcome;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Coach;
import app.zoneblitz.gamesimulator.roster.Player;
import java.util.List;
import java.util.Optional;

/**
 * Default {@link PenaltyModel} calibrated to nflfastR 2020–2024 per-play rates (see {@link
 * PenaltyCatalog}). Each bucket's aggregate rate is drawn once per snap; the specific type is
 * chosen from that bucket's cumulative distribution, then the against-side is chosen by the type's
 * offense/defense split, then a committing player is drawn from the offending unit by an
 * inverse-discipline weighted sample (see {@link #pickCommitter}).
 *
 * <p>Per-player {@code discipline} shifts the rate linearly around the league-average baseline:
 * unit mean of 50 leaves rates unchanged, mean of 100 cuts them by {@link #MAX_SHIFT}, mean of 0
 * raises them by the same fraction. Once a flag fires, the offending player is drawn from the
 * offending unit by an inverse-discipline weighted sample so the worst-discipline players are
 * disproportionately likely to be flagged; the envelope is bounded by {@link #COMMITTER_K} so the
 * spread between the highest- and lowest-discipline player stays under ~3x. For pre-snap draws,
 * each side's {@link Coach#quality()} {@code preparation} layers on top of player discipline as a
 * second multiplier — preparation of 50 is neutral, 100 cuts pre-snap rates by {@link
 * #MAX_PREP_SHIFT}, 0 raises them by the same fraction. Only pre-snap penalties are
 * preparation-sensitive; live-ball and post-play fouls remain driven by player discipline alone.
 */
public final class BandPenaltyModel implements PenaltyModel {

  /** Maximum linear rate shift at the discipline extremes (mean discipline 0 or 100). */
  private static final double MAX_SHIFT = 0.4;

  /** Maximum linear rate shift at the coach-preparation extremes (preparation 0 or 100). */
  private static final double MAX_PREP_SHIFT = 0.8;

  /**
   * Envelope on the inverse-discipline committer-pick weights. With {@code k = 1.0} a discipline-0
   * player carries a base weight of 2.0 and a discipline-100 player carries 0.0 (clamped to {@link
   * #COMMITTER_FLOOR}); the resulting max:min weight ratio sits at 8:1 with the floor active and
   * roughly 3:1 between realistic extremes (e.g. discipline 25 vs 75).
   */
  private static final double COMMITTER_K = 1.0;

  /**
   * Lower clamp on the per-player committer weight so even a flawless player can still be flagged.
   */
  private static final double COMMITTER_FLOOR = 0.25;

  /**
   * Down + distance threshold past which a snap is treated as an "obvious pass" situation for
   * penalty-rate modulation. Matches the nflfastR convention used in pbp analyses: 3rd/4th and 7+.
   */
  private static final int OBVIOUS_PASS_MIN_DOWN = 3;

  private static final int OBVIOUS_PASS_MIN_YARDS_TO_GO = 7;

  @Override
  public Optional<PenaltyDraw.PreSnap> preSnap(
      GameState state,
      OffensivePersonnel offense,
      DefensivePersonnel defense,
      Coach offenseCoach,
      Coach defenseCoach,
      RandomSource rng) {
    var offensePrep = preparationFactor(offenseCoach);
    var defensePrep = preparationFactor(defenseCoach);
    var drawn =
        drawInBucket(
            Bucket.PRE_SNAP,
            state.possession(),
            isObviousPass(state),
            offense,
            defense,
            offensePrep,
            defensePrep,
            rng);
    if (drawn.isEmpty()) {
      return Optional.empty();
    }
    var d = drawn.get();
    return Optional.of(
        new PenaltyDraw.PreSnap(
            d.type(), d.against(), d.committedBy(), d.yards(), d.enforcement()));
  }

  @Override
  public Optional<PenaltyDraw.LiveBall> duringPlay(
      PlayCaller.PlayCall call,
      PlayOutcome outcome,
      GameState state,
      OffensivePersonnel offense,
      DefensivePersonnel defense,
      RandomSource rng) {
    var drawn =
        drawInBucket(
            Bucket.DURING,
            state.possession(),
            isObviousPass(state),
            offense,
            defense,
            1.0,
            1.0,
            rng);
    if (drawn.isEmpty()) {
      return Optional.empty();
    }
    var d = drawn.get();
    return Optional.of(
        new PenaltyDraw.LiveBall(
            d.type(), d.against(), d.committedBy(), d.yards(), d.enforcement()));
  }

  @Override
  public Optional<PenaltyDraw.PostPlay> postPlay(
      Side offenseSide, OffensivePersonnel offense, DefensivePersonnel defense, RandomSource rng) {
    var drawn = drawInBucket(Bucket.POST_PLAY, offenseSide, false, offense, defense, 1.0, 1.0, rng);
    if (drawn.isEmpty()) {
      return Optional.empty();
    }
    var d = drawn.get();
    return Optional.of(
        new PenaltyDraw.PostPlay(
            d.type(), d.against(), d.committedBy(), d.yards(), d.enforcement()));
  }

  private Optional<Drawn> drawInBucket(
      Bucket bucket,
      Side offenseSide,
      boolean obviousPass,
      OffensivePersonnel offense,
      DefensivePersonnel defense,
      double offensePrepFactor,
      double defensePrepFactor,
      RandomSource rng) {
    var offenseFactor = disciplineFactor(offense.players()) * offensePrepFactor;
    var defenseFactor = disciplineFactor(defense.players()) * defensePrepFactor;
    var specs = PenaltyCatalog.inBucket(bucket);

    var adjusted = new double[specs.size()];
    var total = 0.0;
    for (var i = 0; i < specs.size(); i++) {
      var s = specs.get(i);
      if (s.type() == PenaltyType.ROUGHING_THE_KICKER) {
        adjusted[i] = 0.0;
        continue;
      }
      var r = s.rate() * (s.offenseProb() * offenseFactor + (1 - s.offenseProb()) * defenseFactor);
      if (obviousPass) {
        r *= s.obviousPassMultiplier();
      }
      adjusted[i] = r;
      total += r;
    }
    if (total <= 0.0) {
      return Optional.empty();
    }
    var fireRoll = rng.nextDouble();
    if (fireRoll >= total) {
      return Optional.empty();
    }

    var typeRoll = rng.nextDouble() * total;
    var acc = 0.0;
    PenaltyCatalog.Spec picked = specs.get(specs.size() - 1);
    for (var i = 0; i < specs.size(); i++) {
      acc += adjusted[i];
      if (typeRoll < acc) {
        picked = specs.get(i);
        break;
      }
    }

    var against = rng.nextDouble() < picked.offenseProb() ? offenseSide : other(offenseSide);
    var offendingUnit = (against == offenseSide) ? offense.players() : defense.players();
    var committedBy = pickCommitter(offendingUnit, rng);
    var enforcement = PenaltyCatalog.enforcementFor(picked.type(), against, offenseSide);
    return Optional.of(new Drawn(picked.type(), against, committedBy, picked.yards(), enforcement));
  }

  private static PlayerId pickCommitter(List<Player> unit, RandomSource rng) {
    var weights = new double[unit.size()];
    var total = 0.0;
    for (var i = 0; i < unit.size(); i++) {
      var raw = 1 + COMMITTER_K * (50.0 - unit.get(i).tendencies().discipline()) / 50.0;
      var w = Math.max(COMMITTER_FLOOR, raw);
      weights[i] = w;
      total += w;
    }
    var roll = rng.nextDouble() * total;
    var acc = 0.0;
    for (var i = 0; i < unit.size(); i++) {
      acc += weights[i];
      if (roll < acc) {
        return unit.get(i).id();
      }
    }
    return unit.get(unit.size() - 1).id();
  }

  private static double disciplineFactor(List<Player> unit) {
    var mean = unit.stream().mapToInt(p -> p.tendencies().discipline()).average().orElse(50.0);
    var shift = (50.0 - mean) / 50.0 * MAX_SHIFT;
    return Math.max(1 - MAX_SHIFT, Math.min(1 + MAX_SHIFT, 1 + shift));
  }

  private static double preparationFactor(Coach coach) {
    var shift = (50.0 - coach.quality().preparation()) / 50.0 * MAX_PREP_SHIFT;
    return Math.max(1 - MAX_PREP_SHIFT, Math.min(1 + MAX_PREP_SHIFT, 1 + shift));
  }

  private static boolean isObviousPass(GameState state) {
    var dd = state.downAndDistance();
    return dd.down() >= OBVIOUS_PASS_MIN_DOWN && dd.yardsToGo() >= OBVIOUS_PASS_MIN_YARDS_TO_GO;
  }

  private static Side other(Side side) {
    return side == Side.HOME ? Side.AWAY : Side.HOME;
  }

  private record Drawn(
      PenaltyType type,
      Side against,
      PlayerId committedBy,
      int yards,
      PenaltyEnforcement enforcement) {}
}
