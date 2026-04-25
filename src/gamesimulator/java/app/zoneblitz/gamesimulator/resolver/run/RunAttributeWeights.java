package app.zoneblitz.gamesimulator.resolver.run;

import app.zoneblitz.gamesimulator.roster.Physical;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Skill;
import java.util.Objects;
import java.util.function.ToDoubleFunction;

/**
 * Per-role attribute weighting used by {@link RoleMatchupRunShift}. Captures both the physical mix
 * (weights over each {@link Physical} axis, summing to 100) and the skill aggregate (a 0–100
 * scoring function over {@link Skill}). Scores are centered to {@code [-1, +1]} so an
 * average-everywhere player sits at 0.
 *
 * <p>Package-private — concept profiles are an internal seam of the run resolver and never leak
 * onto its API.
 */
record RunAttributeWeights(
    int speed,
    int acceleration,
    int agility,
    int strength,
    int power,
    int bend,
    int stamina,
    int explosiveness,
    ToDoubleFunction<Skill> skillAggregate) {

  RunAttributeWeights {
    Objects.requireNonNull(skillAggregate, "skillAggregate");
    var sum = speed + acceleration + agility + strength + power + bend + stamina + explosiveness;
    if (sum != 100) {
      throw new IllegalArgumentException("physical axis weights must sum to 100, got " + sum);
    }
  }

  double physicalScore(Physical p) {
    var weighted =
        (p.speed() * speed
                + p.acceleration() * acceleration
                + p.agility() * agility
                + p.strength() * strength
                + p.power() * power
                + p.bend() * bend
                + p.stamina() * stamina
                + p.explosiveness() * explosiveness)
            / 100.0;
    return centered(weighted);
  }

  double skillScore(Player player) {
    return centered(skillAggregate.applyAsDouble(player.skill()));
  }

  private static double centered(double zeroToHundred) {
    return (zeroToHundred / 100.0 - 0.5) * 2.0;
  }
}
