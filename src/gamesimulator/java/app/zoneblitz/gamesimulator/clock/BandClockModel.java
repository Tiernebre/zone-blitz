package app.zoneblitz.gamesimulator.clock;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.band.BandRepository;
import app.zoneblitz.gamesimulator.band.BandSampler;
import app.zoneblitz.gamesimulator.band.DistributionalBand;
import app.zoneblitz.gamesimulator.resolver.PassOutcome;
import app.zoneblitz.gamesimulator.resolver.PlayOutcome;
import app.zoneblitz.gamesimulator.resolver.RunOutcome;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import java.util.Objects;

/**
 * Samples inter-snap seconds from {@code play-duration.json} (REG 2022-2024) per outcome category.
 * One {@link BandSampler#sampleDistribution} draw per snap; result clamped to remaining seconds in
 * the current quarter. Flat priors — no situational adjustments yet (2-min drill, hurry-up, etc.).
 */
public final class BandClockModel implements ClockModel {

  private static final String RESOURCE = "play-duration.json";

  private final BandSampler sampler;
  private final DistributionalBand runInbounds;
  private final DistributionalBand passCompleteInbounds;
  private final DistributionalBand passIncomplete;
  private final DistributionalBand sack;
  private final DistributionalBand scrambleInbounds;
  private final DistributionalBand scrambleOob;
  private final DistributionalBand interception;
  private final DistributionalBand punt;
  private final DistributionalBand fieldGoal;
  private final DistributionalBand kickoff;
  private final DistributionalBand extraPoint;

  public BandClockModel(
      BandSampler sampler,
      DistributionalBand runInbounds,
      DistributionalBand passCompleteInbounds,
      DistributionalBand passIncomplete,
      DistributionalBand sack,
      DistributionalBand scrambleInbounds,
      DistributionalBand scrambleOob,
      DistributionalBand interception,
      DistributionalBand punt,
      DistributionalBand fieldGoal,
      DistributionalBand kickoff,
      DistributionalBand extraPoint) {
    this.sampler = Objects.requireNonNull(sampler, "sampler");
    this.runInbounds = Objects.requireNonNull(runInbounds, "runInbounds");
    this.passCompleteInbounds =
        Objects.requireNonNull(passCompleteInbounds, "passCompleteInbounds");
    this.passIncomplete = Objects.requireNonNull(passIncomplete, "passIncomplete");
    this.sack = Objects.requireNonNull(sack, "sack");
    this.scrambleInbounds = Objects.requireNonNull(scrambleInbounds, "scrambleInbounds");
    this.scrambleOob = Objects.requireNonNull(scrambleOob, "scrambleOob");
    this.interception = Objects.requireNonNull(interception, "interception");
    this.punt = Objects.requireNonNull(punt, "punt");
    this.fieldGoal = Objects.requireNonNull(fieldGoal, "fieldGoal");
    this.kickoff = Objects.requireNonNull(kickoff, "kickoff");
    this.extraPoint = Objects.requireNonNull(extraPoint, "extraPoint");
  }

  /** Load a model from the default {@code play-duration.json} band resource. */
  public static BandClockModel load(BandRepository repo, BandSampler sampler) {
    return new BandClockModel(
        sampler,
        repo.loadDistribution(RESOURCE, "bands.run_inbounds"),
        repo.loadDistribution(RESOURCE, "bands.pass_complete_inbounds"),
        repo.loadDistribution(RESOURCE, "bands.pass_incomplete"),
        repo.loadDistribution(RESOURCE, "bands.sack"),
        repo.loadDistribution(RESOURCE, "bands.scramble_inbounds"),
        repo.loadDistribution(RESOURCE, "bands.scramble_oob"),
        repo.loadDistribution(RESOURCE, "bands.pass_interception"),
        repo.loadDistribution(RESOURCE, "bands.punt"),
        repo.loadDistribution(RESOURCE, "bands.field_goal"),
        repo.loadDistribution(RESOURCE, "bands.kickoff"),
        repo.loadDistribution(RESOURCE, "bands.extra_point"));
  }

  @Override
  public int secondsConsumed(PlayOutcome outcome, GameState preSnap, RandomSource rng) {
    Objects.requireNonNull(outcome, "outcome");
    Objects.requireNonNull(preSnap, "preSnap");
    Objects.requireNonNull(rng, "rng");
    var band =
        switch (outcome) {
          case PassOutcome.PassComplete c -> passCompleteInbounds;
          case PassOutcome.PassIncomplete i -> passIncomplete;
          case PassOutcome.Sack s -> sack;
          case PassOutcome.Scramble s -> s.slideOrOob() ? scrambleOob : scrambleInbounds;
          case PassOutcome.Interception x -> interception;
          case RunOutcome.Run r -> runInbounds;
        };
    var raw = sampler.sampleDistribution(band, 0.0, rng);
    return Math.max(0, Math.min(raw, preSnap.clock().secondsRemaining()));
  }

  @Override
  public int secondsConsumedForKick(Kick kick, GameState preSnap, RandomSource rng) {
    Objects.requireNonNull(kick, "kick");
    Objects.requireNonNull(preSnap, "preSnap");
    Objects.requireNonNull(rng, "rng");
    var band =
        switch (kick) {
          case PUNT -> punt;
          case FIELD_GOAL -> fieldGoal;
          case KICKOFF -> kickoff;
          case EXTRA_POINT -> extraPoint;
        };
    var raw = sampler.sampleDistribution(band, 0.0, rng);
    return Math.max(0, Math.min(raw, preSnap.clock().secondsRemaining()));
  }
}
