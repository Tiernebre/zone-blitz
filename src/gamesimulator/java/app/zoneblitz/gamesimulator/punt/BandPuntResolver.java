package app.zoneblitz.gamesimulator.punt;

import app.zoneblitz.gamesimulator.band.BandRepository;
import app.zoneblitz.gamesimulator.band.BandSampler;
import app.zoneblitz.gamesimulator.band.DistributionalBand;
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
 * Band-driven punt resolver. Draws gross yards and return yards from the distributional ladders in
 * {@code special-teams.json}, and samples the outcome from the flat outcome-rate fields ({@code
 * touchback_rate}, {@code fair_catch_rate}, {@code downed_rate}, {@code out_of_bounds_rate}, {@code
 * blocked_rate}, {@code muffed_rate}; the remainder is treated as {@link PuntResult#RETURNED}).
 * Muff recovery side is drawn from {@code muffed-punts.json}'s {@code lost_rate} (probability the
 * kicking team recovers the muff).
 *
 * <p>The outcome is drawn independently of the landing spot. When the outcome implies a specific
 * landing behaviour (touchback, block) the spot is overridden to the rule-book value; otherwise the
 * ball spots where the sampled gross yardage lands, clamped to the field, with any sampled return
 * yards added on {@code RETURNED}.
 *
 * <p>Deferred to follow-ups: fake punts, coffin-corner aim, context-conditioned gross yardage
 * (kicking from own 10 vs. opp 40 share one band today).
 */
public final class BandPuntResolver implements PuntResolver {

  private static final String RESOURCE = "special-teams.json";
  private static final String MUFFS_RESOURCE = "muffed-punts.json";
  private static final int TOUCHBACK_SPOT = 20;
  private static final int BLOCK_RECOVERY_BEHIND_LOS = 5;
  private static final Set<Position> RETURNER_POSITIONS = EnumSet.of(Position.WR, Position.CB);

  private final BandSampler sampler;
  private final DistributionalBand grossYards;
  private final DistributionalBand returnYards;
  private final double blockedRate;
  private final double touchbackRate;
  private final double fairCatchRate;
  private final double downedRate;
  private final double outOfBoundsRate;
  private final double muffedRate;
  private final double muffKickingRecoveryRate;

  public BandPuntResolver(
      BandSampler sampler,
      DistributionalBand grossYards,
      DistributionalBand returnYards,
      double blockedRate,
      double touchbackRate,
      double fairCatchRate,
      double downedRate,
      double outOfBoundsRate,
      double muffedRate,
      double muffKickingRecoveryRate) {
    this.sampler = Objects.requireNonNull(sampler, "sampler");
    this.grossYards = Objects.requireNonNull(grossYards, "grossYards");
    this.returnYards = Objects.requireNonNull(returnYards, "returnYards");
    this.blockedRate = requireRate(blockedRate, "blockedRate");
    this.touchbackRate = requireRate(touchbackRate, "touchbackRate");
    this.fairCatchRate = requireRate(fairCatchRate, "fairCatchRate");
    this.downedRate = requireRate(downedRate, "downedRate");
    this.outOfBoundsRate = requireRate(outOfBoundsRate, "outOfBoundsRate");
    this.muffedRate = requireRate(muffedRate, "muffedRate");
    this.muffKickingRecoveryRate = requireRate(muffKickingRecoveryRate, "muffKickingRecoveryRate");
    var sum =
        blockedRate + touchbackRate + fairCatchRate + downedRate + outOfBoundsRate + muffedRate;
    if (sum > 1.0) {
      throw new IllegalArgumentException(
          "Punt outcome rates sum to " + sum + " (> 1.0); no room for RETURNED");
    }
  }

  /** Load a resolver from the default {@code special-teams.json} + {@code muffed-punts.json}. */
  public static BandPuntResolver load(BandRepository repo, BandSampler sampler) {
    return new BandPuntResolver(
        sampler,
        repo.loadDistribution(RESOURCE, "bands.punts.gross_yards"),
        repo.loadDistribution(RESOURCE, "bands.punts.return_yards"),
        repo.loadScalar(RESOURCE, "bands.punts.blocked_rate"),
        repo.loadScalar(RESOURCE, "bands.punts.touchback_rate"),
        repo.loadScalar(RESOURCE, "bands.punts.fair_catch_rate"),
        repo.loadScalar(RESOURCE, "bands.punts.downed_rate"),
        repo.loadScalar(RESOURCE, "bands.punts.out_of_bounds_rate"),
        repo.loadScalar(MUFFS_RESOURCE, "bands.outcome_mix.muffed.rate"),
        repo.loadScalar(MUFFS_RESOURCE, "bands.muffs.lost_rate"));
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
    var sampledGross = sampler.sampleDistribution(grossYards, 0.0, rng);
    var result = drawOutcome(rng.nextDouble());

    PuntResult finalResult;
    int reportedGross;
    int returnYds;
    Optional<PlayerId> returner;
    Side nextPossession;
    int nextSpotYardLine;

    switch (result) {
      case BLOCKED -> {
        finalResult = PuntResult.BLOCKED;
        reportedGross = 0;
        returnYds = 0;
        returner = Optional.empty();
        var recoverYardLine = Math.max(1, losYardLine - BLOCK_RECOVERY_BEHIND_LOS);
        nextPossession = receivingSide;
        nextSpotYardLine = Math.min(99, 100 - recoverYardLine);
      }
      case TOUCHBACK -> {
        finalResult = PuntResult.TOUCHBACK;
        reportedGross = Math.max(sampledGross, 100 - losYardLine);
        returnYds = 0;
        returner = Optional.empty();
        nextPossession = receivingSide;
        nextSpotYardLine = TOUCHBACK_SPOT;
      }
      case FAIR_CATCH -> {
        finalResult = PuntResult.FAIR_CATCH;
        reportedGross = clipToField(sampledGross, losYardLine);
        returnYds = 0;
        returner = Optional.of(pickReturner(receivingTeam));
        nextPossession = receivingSide;
        nextSpotYardLine = Math.max(1, 100 - (losYardLine + reportedGross));
      }
      case DOWNED -> {
        finalResult = PuntResult.DOWNED;
        reportedGross = clipToField(sampledGross, losYardLine);
        returnYds = 0;
        returner = Optional.empty();
        nextPossession = receivingSide;
        nextSpotYardLine = Math.max(1, 100 - (losYardLine + reportedGross));
      }
      case OUT_OF_BOUNDS -> {
        finalResult = PuntResult.OUT_OF_BOUNDS;
        reportedGross = clipToField(sampledGross, losYardLine);
        returnYds = 0;
        returner = Optional.empty();
        nextPossession = receivingSide;
        nextSpotYardLine = Math.max(1, 100 - (losYardLine + reportedGross));
      }
      case MUFFED -> {
        finalResult = PuntResult.MUFFED;
        reportedGross = clipToField(sampledGross, losYardLine);
        returnYds = 0;
        returner = Optional.of(pickReturner(receivingTeam));
        var recvLanding = Math.max(1, 100 - (losYardLine + reportedGross));
        var kickingRecovers = rng.nextDouble() < muffKickingRecoveryRate;
        if (kickingRecovers) {
          // Kicking team recovers the muff at the landing spot. In the kicking team's frame, the
          // landing spot is losYardLine + reportedGross.
          nextPossession = kickingSide;
          nextSpotYardLine = Math.min(99, losYardLine + reportedGross);
        } else {
          nextPossession = receivingSide;
          nextSpotYardLine = recvLanding;
        }
      }
      case RETURNED -> {
        finalResult = PuntResult.RETURNED;
        reportedGross = clipToField(sampledGross, losYardLine);
        returnYds = sampler.sampleDistribution(returnYards, 0.0, rng);
        returner = Optional.of(pickReturner(receivingTeam));
        var recvLanding = 100 - (losYardLine + reportedGross);
        nextPossession = receivingSide;
        nextSpotYardLine = Math.max(1, Math.min(99, recvLanding + returnYds));
      }
      default -> throw new IllegalStateException("Unexpected bucket: " + result);
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
            returnYds,
            finalResult);
    return new Resolved(event, nextPossession, nextSpotYardLine);
  }

  /**
   * Draws a bucket from the cumulative outcome rates. Separate from {@link PuntResult} because the
   * draw space is fixed order and not all {@code PuntResult} values are band-driven outcomes.
   */
  private PuntResult drawOutcome(double roll) {
    var acc = 0.0;
    if (roll < (acc += blockedRate)) {
      return PuntResult.BLOCKED;
    }
    if (roll < (acc += touchbackRate)) {
      return PuntResult.TOUCHBACK;
    }
    if (roll < (acc += fairCatchRate)) {
      return PuntResult.FAIR_CATCH;
    }
    if (roll < (acc += downedRate)) {
      return PuntResult.DOWNED;
    }
    if (roll < (acc += outOfBoundsRate)) {
      return PuntResult.OUT_OF_BOUNDS;
    }
    if (roll < (acc += muffedRate)) {
      return PuntResult.MUFFED;
    }
    return PuntResult.RETURNED;
  }

  private static int clipToField(int gross, int losYardLine) {
    return Math.max(1, Math.min(gross, 99 - losYardLine));
  }

  private static double requireRate(double rate, String name) {
    if (rate < 0.0 || rate > 1.0 || Double.isNaN(rate)) {
      throw new IllegalArgumentException(name + " must be in [0, 1]; was " + rate);
    }
    return rate;
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
