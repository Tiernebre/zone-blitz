package app.zoneblitz.gamesimulator.punt;

import app.zoneblitz.gamesimulator.event.DownAndDistance;
import app.zoneblitz.gamesimulator.event.FieldPosition;
import app.zoneblitz.gamesimulator.event.GameClock;
import app.zoneblitz.gamesimulator.event.GameId;
import app.zoneblitz.gamesimulator.event.PlayEvent;
import app.zoneblitz.gamesimulator.event.PlayId;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.event.PuntResult;
import app.zoneblitz.gamesimulator.event.Score;
import app.zoneblitz.gamesimulator.event.Side;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.EnumSet;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Baseline distance-only punt resolver. Gross kick distance is sampled by the supplied {@link
 * GrossYardsSampler} (defaulting to a mean-45 distribution that tapers when kicking from the
 * opponent's side of the field to reduce touchbacks). Outcome is then bucketed from the landing
 * spot:
 *
 * <ul>
 *   <li>ball in the end zone → {@link PuntResult#TOUCHBACK}, receiving team starts at own 20.
 *   <li>landing inside the receiver's 10 (pinned) → mostly {@link PuntResult#DOWNED}, with some
 *       fair catches and short returns.
 *   <li>otherwise → mixed {@link PuntResult#FAIR_CATCH} / {@link PuntResult#RETURNED} with a small
 *       {@link PuntResult#OUT_OF_BOUNDS} tail.
 * </ul>
 *
 * Blocks, muffs, fake punts, and coffin-corner aiming are deferred.
 */
public final class DistanceCurvePuntResolver implements PuntResolver {

  private static final int TOUCHBACK_SPOT = 20;
  private static final Set<Position> RETURNER_POSITIONS = EnumSet.of(Position.WR, Position.CB);

  private final GrossYardsSampler grossSampler;

  public DistanceCurvePuntResolver() {
    this(DistanceCurvePuntResolver::baselineGrossYards);
  }

  /** For tests that want deterministic gross distance independent of the outcome rng. */
  public DistanceCurvePuntResolver(GrossYardsSampler grossSampler) {
    this.grossSampler = Objects.requireNonNull(grossSampler, "grossSampler");
  }

  /** Samples the punt's gross yards (distance from the LOS to the landing spot). */
  @FunctionalInterface
  public interface GrossYardsSampler {
    int sample(int losYardLine, RandomSource rng);
  }

  static int baselineGrossYards(int losYardLine, RandomSource rng) {
    var spaceToGoalLine = 100 - losYardLine;
    var ceiling = Math.max(20, spaceToGoalLine - 1);
    var mean = Math.min(45, Math.max(30, spaceToGoalLine - 5));
    var jitter = (int) Math.round((rng.nextDouble() - 0.5) * 16);
    return Math.max(20, Math.min(ceiling + 10, mean + jitter));
  }

  @Override
  public Resolved resolve(
      Team kickingTeam,
      Team receivingTeam,
      Side kickingSide,
      GameId gameId,
      int sequence,
      FieldPosition preSnapSpot,
      DownAndDistance preSnap,
      GameClock clock,
      Score scoreAfter,
      RandomSource rng) {
    Objects.requireNonNull(kickingTeam, "kickingTeam");
    Objects.requireNonNull(receivingTeam, "receivingTeam");
    Objects.requireNonNull(kickingSide, "kickingSide");
    Objects.requireNonNull(gameId, "gameId");
    Objects.requireNonNull(preSnapSpot, "preSnapSpot");
    Objects.requireNonNull(preSnap, "preSnap");
    Objects.requireNonNull(clock, "clock");
    Objects.requireNonNull(scoreAfter, "scoreAfter");
    Objects.requireNonNull(rng, "rng");

    var receivingSide = kickingSide == Side.HOME ? Side.AWAY : Side.HOME;
    var losYardLine = preSnapSpot.yardLine();
    var gross = grossSampler.sample(losYardLine, rng);
    var landing = losYardLine + gross;

    PuntResult result;
    int returnYards;
    Optional<PlayerId> returner;
    int receivingTakeoverYardLine;
    int reportedGross;

    if (landing >= 100) {
      result = PuntResult.TOUCHBACK;
      returnYards = 0;
      returner = Optional.empty();
      receivingTakeoverYardLine = TOUCHBACK_SPOT;
      reportedGross = 100 - losYardLine;
    } else {
      var recvLanding = 100 - landing;
      var roll = rng.nextDouble();
      if (recvLanding <= 10) {
        if (roll < 0.65) {
          result = PuntResult.DOWNED;
          returnYards = 0;
          returner = Optional.empty();
        } else if (roll < 0.88) {
          result = PuntResult.FAIR_CATCH;
          returnYards = 0;
          returner = Optional.of(pickReturner(receivingTeam));
        } else {
          result = PuntResult.RETURNED;
          returnYards = (int) Math.round(rng.nextDouble() * 5);
          returner = Optional.of(pickReturner(receivingTeam));
        }
      } else {
        if (roll < 0.05) {
          result = PuntResult.OUT_OF_BOUNDS;
          returnYards = 0;
          returner = Optional.empty();
        } else if (roll < 0.45) {
          result = PuntResult.FAIR_CATCH;
          returnYards = 0;
          returner = Optional.of(pickReturner(receivingTeam));
        } else {
          result = PuntResult.RETURNED;
          returnYards = 4 + (int) Math.round(rng.nextDouble() * 10);
          returner = Optional.of(pickReturner(receivingTeam));
        }
      }
      receivingTakeoverYardLine = Math.max(1, Math.min(99, recvLanding + returnYards));
      reportedGross = gross;
    }

    var punter = pickPunter(kickingTeam);
    var id = new PlayId(new UUID(gameId.value().getMostSignificantBits(), 0xFC00L | sequence));
    var event =
        new PlayEvent.Punt(
            id,
            gameId,
            sequence,
            preSnap,
            preSnapSpot,
            clock,
            clock,
            scoreAfter,
            punter,
            reportedGross,
            returner,
            returnYards,
            result);
    return new Resolved(event, receivingSide, receivingTakeoverYardLine);
  }

  private static PlayerId pickPunter(Team team) {
    return team.roster().stream()
        .filter(p -> p.position() == Position.P)
        .map(p -> p.id())
        .findFirst()
        .orElseGet(
            () ->
                team.roster().stream()
                    .filter(p -> p.position() == Position.K)
                    .map(p -> p.id())
                    .findFirst()
                    .orElseGet(() -> team.roster().get(0).id()));
  }

  private static PlayerId pickReturner(Team team) {
    return team.roster().stream()
        .filter(p -> RETURNER_POSITIONS.contains(p.position()))
        .map(p -> p.id())
        .findFirst()
        .orElseGet(() -> team.roster().get(0).id());
  }
}
