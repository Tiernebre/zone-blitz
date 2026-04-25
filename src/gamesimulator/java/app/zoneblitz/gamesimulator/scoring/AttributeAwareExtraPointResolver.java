package app.zoneblitz.gamesimulator.scoring;

import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PatResult;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Skill;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.Objects;
import java.util.function.ToDoubleFunction;

/**
 * Kicker-attribute-aware {@link ExtraPointResolver} decorator. PATs sit at a fixed 33-yard
 * equivalent so the spread between elite and weak kickers is small but real (NFL career splits put
 * elite PAT kickers near 99% and weakest near 88%, ~10 percentage-point band). The decorator flips
 * the delegate's outcome with probability {@code |score| × MAX_SHIFT} when score and base outcome
 * disagree.
 */
public final class AttributeAwareExtraPointResolver implements ExtraPointResolver {

  /** Maximum absolute make-rate shift PATs admit; smaller than FG since baseline is high. */
  static final double MAX_SHIFT = 0.05;

  private static final ToDoubleFunction<Skill> SKILL_AGGREGATE = s -> (double) s.kickAccuracy();

  private static final KickAttributeWeights DEFAULT_WEIGHTS =
      new KickAttributeWeights(0, 0, 0, 10, 60, 0, 0, 30, SKILL_AGGREGATE);

  private final ExtraPointResolver delegate;
  private final KickAttributeWeights weights;

  public AttributeAwareExtraPointResolver(ExtraPointResolver delegate) {
    this(delegate, DEFAULT_WEIGHTS);
  }

  AttributeAwareExtraPointResolver(ExtraPointResolver delegate, KickAttributeWeights weights) {
    this.delegate = Objects.requireNonNull(delegate, "delegate");
    this.weights = Objects.requireNonNull(weights, "weights");
  }

  @Override
  public Resolved resolve(
      Team kickingTeam,
      Side kickingSide,
      GameId gameId,
      int sequence,
      GameClock clock,
      Score scoreBeforePat,
      RandomSource rng) {
    var base =
        delegate.resolve(kickingTeam, kickingSide, gameId, sequence, clock, scoreBeforePat, rng);

    var kicker = lookupKicker(kickingTeam, base.event().kicker());
    var score = weights.skillScore(kicker);
    var shift = score * MAX_SHIFT;

    var made = base.event().result() == PatResult.GOOD;

    if (shift > 0 && !made) {
      if (rng.nextDouble() < shift) {
        return flipToMake(base, kickingSide, scoreBeforePat);
      }
    } else if (shift < 0 && made) {
      if (rng.nextDouble() < -shift) {
        return flipToMiss(base, scoreBeforePat);
      }
    }
    return base;
  }

  private static Resolved flipToMake(Resolved base, Side kickingSide, Score scoreBeforePat) {
    var original = base.event();
    var scoreAfter = scoreBeforePat.plus(kickingSide, 1);
    var made =
        new PlayEvent.ExtraPoint(
            original.id(),
            original.gameId(),
            original.sequence(),
            original.preSnap(),
            original.preSnapSpot(),
            original.clockBefore(),
            original.clockAfter(),
            scoreAfter,
            original.kicker(),
            PatResult.GOOD);
    return new Resolved(made, scoreAfter);
  }

  private static Resolved flipToMiss(Resolved base, Score scoreBeforePat) {
    var original = base.event();
    var missed =
        new PlayEvent.ExtraPoint(
            original.id(),
            original.gameId(),
            original.sequence(),
            original.preSnap(),
            original.preSnapSpot(),
            original.clockBefore(),
            original.clockAfter(),
            scoreBeforePat,
            original.kicker(),
            PatResult.MISSED);
    return new Resolved(missed, scoreBeforePat);
  }

  private static Player lookupKicker(Team team, PlayerId kickerId) {
    return team.roster().stream()
        .filter(p -> p.id().equals(kickerId))
        .findFirst()
        .orElseThrow(() -> new IllegalStateException("kicker not on roster: " + kickerId));
  }
}
