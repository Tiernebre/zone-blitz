package app.zoneblitz.gamesimulator.role;

import app.zoneblitz.gamesimulator.roster.Player;
import java.util.Map;
import java.util.Objects;

/**
 * Per-role attribute demand vector. Each family map keys an axis (physical, skill, tendency) to a
 * non-negative integer weight; within a non-empty map weights sum to exactly 100. An empty map
 * signals the role does not consider that family — the corresponding score is 0 (centered
 * baseline).
 *
 * <p>The decomposed scores ({@link #physicalScore}, {@link #skillScore}, {@link #tendencyScore})
 * each return a centered value in {@code [-1, +1]}, mirroring the existing {@code centered()}
 * convention so {@code RoleMatchupPassShift} can preserve the same physical-gap clamp math {@code
 * RoleMatchupPassShift} uses today.
 */
public record RoleDemand(
    Map<PhysicalAxis, Integer> physicalWeights,
    Map<SkillAxis, Integer> skillWeights,
    Map<TendencyAxis, Integer> tendencyWeights) {

  public RoleDemand {
    Objects.requireNonNull(physicalWeights, "physicalWeights");
    Objects.requireNonNull(skillWeights, "skillWeights");
    Objects.requireNonNull(tendencyWeights, "tendencyWeights");
    requireSumIs100OrEmpty(physicalWeights, "physicalWeights");
    requireSumIs100OrEmpty(skillWeights, "skillWeights");
    requireSumIs100OrEmpty(tendencyWeights, "tendencyWeights");
    physicalWeights = Map.copyOf(physicalWeights);
    skillWeights = Map.copyOf(skillWeights);
    tendencyWeights = Map.copyOf(tendencyWeights);
  }

  public static RoleDemand of(
      Map<PhysicalAxis, Integer> physicalWeights, Map<SkillAxis, Integer> skillWeights) {
    return new RoleDemand(physicalWeights, skillWeights, Map.of());
  }

  public double physicalScore(Player player) {
    Objects.requireNonNull(player, "player");
    if (physicalWeights.isEmpty()) {
      return 0.0;
    }
    var raw = 0.0;
    for (var entry : physicalWeights.entrySet()) {
      raw += entry.getValue() * entry.getKey().extract(player.physical());
    }
    return centered(raw / 100.0);
  }

  public double skillScore(Player player) {
    Objects.requireNonNull(player, "player");
    if (skillWeights.isEmpty()) {
      return 0.0;
    }
    var raw = 0.0;
    for (var entry : skillWeights.entrySet()) {
      raw += entry.getValue() * entry.getKey().extract(player.skill());
    }
    return centered(raw / 100.0);
  }

  public double tendencyScore(Player player) {
    Objects.requireNonNull(player, "player");
    if (tendencyWeights.isEmpty()) {
      return 0.0;
    }
    var raw = 0.0;
    for (var entry : tendencyWeights.entrySet()) {
      raw += entry.getValue() * entry.getKey().extract(player.tendencies());
    }
    return centered(raw / 100.0);
  }

  private static double centered(double weightedAverage) {
    return (weightedAverage - 50.0) / 50.0;
  }

  private static void requireSumIs100OrEmpty(Map<?, Integer> weights, String name) {
    if (weights.isEmpty()) {
      return;
    }
    var sum = 0;
    for (var value : weights.values()) {
      Objects.requireNonNull(value, name + " weight value");
      if (value < 0) {
        throw new IllegalArgumentException(name + " weights must be non-negative, got " + value);
      }
      sum += value;
    }
    if (sum != 100) {
      throw new IllegalArgumentException(name + " weights must sum to 100, got " + sum);
    }
  }
}
