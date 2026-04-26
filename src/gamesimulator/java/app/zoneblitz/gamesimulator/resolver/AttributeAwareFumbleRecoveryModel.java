package app.zoneblitz.gamesimulator.resolver;

import app.zoneblitz.gamesimulator.band.BandSampler;
import app.zoneblitz.gamesimulator.band.DistributionalBand;
import app.zoneblitz.gamesimulator.event.FumbleOutcome;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Player;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Attribute-driven fumble recovery model. Shifts the baseline 50/50 defense-vs-offense coin based
 * on the fumbling carrier's ball-security profile and the average pursuit awareness of the defender
 * pool, then selects the specific recoverer from the winning pool by weighted draw rather than a
 * uniform pick.
 *
 * <h2>Side-selection shift</h2>
 *
 * <p>The raw defense-recovery rate starts at the {@link
 * BaselineFumbleRecoveryModel#DEFAULT_DEFENSE_RECOVERY_RATE league baseline of 0.5} and is shifted
 * by:
 *
 * <pre>
 *   shift = defenderAwarenessScore − carrierBallSecurityScore
 * </pre>
 *
 * <p>Each score is a centered aggregate on {@code [-1, +1]}: {@code 0} for an average-everywhere
 * player, {@code +1} for a perfect-100 player, {@code -1} for a 0-rated player. The carrier's
 * <em>ball-security score</em> blends {@link
 * app.zoneblitz.gamesimulator.roster.Skill#ballCarrierVision()} (70 % weight, the primary
 * ball-security proxy) with {@link app.zoneblitz.gamesimulator.roster.Skill#breakTackle()} (30 %
 * weight, physical ability to protect the ball through contact). The defenders' <em>awareness
 * score</em> is the mean across the pool of a blend of {@link
 * app.zoneblitz.gamesimulator.roster.Tendencies#footballIq()} (60 %) plus {@link
 * app.zoneblitz.gamesimulator.roster.Skill#blockShedding()} (40 %, proximity/pursuit effort at the
 * pile).
 *
 * <p>Ball-security blend favors the dedicated {@code carrying} axis (60 %) over the legacy
 * vision/break-tackle proxies — carrying is the literal protect-the-ball technique. Vision (25 %)
 * still contributes (avoiding hits in the first place), as does break-tackle (15 %, surviving the
 * hit without losing the ball).
 *
 * <p>The net shift is clamped to {@code ±}{@link #MAX_SIDE_SHIFT} ({@value #MAX_SIDE_SHIFT}) so
 * that even extreme-attribute mismatches cannot push the recovery rate outside {@code [0.30,
 * 0.70]}. This bound reflects the real-world observation that fumble recoveries retain significant
 * randomness regardless of personnel — the ball bounces unpredictably.
 *
 * <h2>Within-pool recoverer pick</h2>
 *
 * <p>Once the winning side is decided, the recoverer is drawn with weights proportional to each
 * candidate's <em>awareness aggregate</em>:
 *
 * <ul>
 *   <li>Defenders: {@link app.zoneblitz.gamesimulator.roster.Tendencies#footballIq()} (60 %) +
 *       {@link app.zoneblitz.gamesimulator.roster.Skill#blockShedding()} (40 %).
 *   <li>Offensive teammates (excluding the fumbler): {@link
 *       app.zoneblitz.gamesimulator.roster.Tendencies#footballIq()} (60 %) + {@link
 *       app.zoneblitz.gamesimulator.roster.Skill#ballCarrierVision()} (40 %).
 * </ul>
 *
 * <p>Raw attribute values (0–100) are used directly as weights; the draw is a weighted index
 * selection over the {@link RandomSource#nextDouble()} coin scaled to the cumulative weight.
 *
 * <h2>Return yards</h2>
 *
 * <p>Return yards are sampled from a {@link DistributionalBand} on defense recoveries when a {@link
 * BandSampler} + band are supplied at construction; offense recoveries always report {@code 0} (the
 * carrier falls on it). Callers without a band fall back to zero return yards on every outcome.
 */
public final class AttributeAwareFumbleRecoveryModel implements FumbleRecoveryModel {

  /**
   * Maximum absolute shift to the defense-recovery probability. Clamps the net shift so the final
   * rate stays within {@code [0.5 − MAX_SIDE_SHIFT, 0.5 + MAX_SIDE_SHIFT]} = {@code [0.30, 0.70]}.
   */
  static final double MAX_SIDE_SHIFT = 0.20;

  private final Optional<BandSampler> sampler;
  private final Optional<DistributionalBand> defenseReturnYards;

  public AttributeAwareFumbleRecoveryModel() {
    this(Optional.empty(), Optional.empty());
  }

  public AttributeAwareFumbleRecoveryModel(BandSampler sampler, DistributionalBand returnYards) {
    this(
        Optional.of(Objects.requireNonNull(sampler, "sampler")),
        Optional.of(Objects.requireNonNull(returnYards, "returnYards")));
  }

  private AttributeAwareFumbleRecoveryModel(
      Optional<BandSampler> sampler, Optional<DistributionalBand> defenseReturnYards) {
    this.sampler = sampler;
    this.defenseReturnYards = defenseReturnYards;
  }

  @Override
  public FumbleOutcome resolve(
      PlayerId fumbledBy,
      List<Player> offensiveTeammates,
      List<Player> defenders,
      RandomSource rng) {
    Objects.requireNonNull(fumbledBy, "fumbledBy");
    Objects.requireNonNull(offensiveTeammates, "offensiveTeammates");
    Objects.requireNonNull(defenders, "defenders");
    Objects.requireNonNull(rng, "rng");

    var offenseCandidates =
        offensiveTeammates.stream().filter(p -> !p.id().equals(fumbledBy)).toList();
    if (offenseCandidates.isEmpty() && defenders.isEmpty()) {
      throw new IllegalArgumentException("no recovery candidates available on either side");
    }

    var carrier =
        offensiveTeammates.stream().filter(p -> p.id().equals(fumbledBy)).findFirst().orElse(null);

    var carrierScore = carrier != null ? ballSecurityScore(carrier) : 0.0;
    var defenderScore = defenders.isEmpty() ? 0.0 : meanAwarenessScore(defenders);
    var rawShift = defenderScore - carrierScore;
    var clampedShift = Math.max(-MAX_SIDE_SHIFT, Math.min(MAX_SIDE_SHIFT, rawShift));

    var defenseRecoveryRate =
        BaselineFumbleRecoveryModel.DEFAULT_DEFENSE_RECOVERY_RATE + clampedShift;

    var coin = rng.nextDouble();
    var defenseWins =
        offenseCandidates.isEmpty() || (!defenders.isEmpty() && coin < defenseRecoveryRate);
    var pool = defenseWins ? defenders : offenseCandidates;
    var recoverer = weightedPick(pool, defenseWins, rng);

    var returnYards =
        defenseWins && sampler.isPresent() && defenseReturnYards.isPresent()
            ? sampler.get().sampleDistribution(defenseReturnYards.get(), 0.0, rng)
            : 0;

    return new FumbleOutcome(fumbledBy, defenseWins, Optional.of(recoverer), returnYards);
  }

  /**
   * Centered ball-security score for the carrier: {@code carrying} (60 %) + {@code
   * ballCarrierVision} (25 %) + {@code breakTackle} (15 %), mapped from [0, 100] to [-1, +1].
   */
  private static double ballSecurityScore(Player carrier) {
    var raw =
        0.60 * carrier.skill().carrying()
            + 0.25 * carrier.skill().ballCarrierVision()
            + 0.15 * carrier.skill().breakTackle();
    return centered(raw);
  }

  /**
   * Mean centered awareness score across a pool of defenders: {@code footballIq} (60 %) + {@code
   * blockShedding} (40 %), mapped from [0, 100] to [-1, +1].
   */
  private static double meanAwarenessScore(List<Player> pool) {
    var sum =
        pool.stream()
            .mapToDouble(p -> 0.60 * p.tendencies().footballIq() + 0.40 * p.skill().blockShedding())
            .sum();
    return centered(sum / pool.size());
  }

  /**
   * Weighted pick from {@code pool}. Weights are raw-attribute awareness aggregates (0–100 domain);
   * pick is a single {@link RandomSource#nextDouble()} draw scaled to total weight. Defender pool
   * uses {@code footballIq + blockShedding}; offensive pool uses {@code footballIq +
   * ballCarrierVision}.
   */
  private static PlayerId weightedPick(List<Player> pool, boolean isDefenders, RandomSource rng) {
    var weights = pool.stream().mapToDouble(p -> awarenessWeight(p, isDefenders)).toArray();
    var total = 0.0;
    for (var w : weights) {
      total += w;
    }
    var threshold = rng.nextDouble() * total;
    var cumulative = 0.0;
    for (var i = 0; i < pool.size(); i++) {
      cumulative += weights[i];
      if (cumulative >= threshold) {
        return pool.get(i).id();
      }
    }
    // Fallback — floating-point edge: threshold == total exactly
    return pool.get(pool.size() - 1).id();
  }

  private static double awarenessWeight(Player p, boolean isDefender) {
    if (isDefender) {
      return 0.60 * p.tendencies().footballIq() + 0.40 * p.skill().blockShedding();
    }
    return 0.60 * p.tendencies().footballIq() + 0.40 * p.skill().ballCarrierVision();
  }

  /** Maps a raw [0, 100] value to a centered [-1, +1] score. Average (50) becomes 0. */
  private static double centered(double zeroToHundred) {
    return (zeroToHundred / 100.0 - 0.5) * 2.0;
  }
}
