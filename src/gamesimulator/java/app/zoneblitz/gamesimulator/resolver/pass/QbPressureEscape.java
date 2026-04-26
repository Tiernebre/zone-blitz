package app.zoneblitz.gamesimulator.resolver.pass;

import app.zoneblitz.gamesimulator.resolver.PassRoles;
import app.zoneblitz.gamesimulator.rng.RandomSource;
import app.zoneblitz.gamesimulator.roster.Physical;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Skill;
import app.zoneblitz.gamesimulator.roster.Tendencies;
import java.util.List;
import java.util.function.ToDoubleFunction;

/**
 * Pressure-gradient escape resolver.
 *
 * <p>Protection vs. pass-rush strength is computed as a symmetric [-1, +1] scalar: defense wins at
 * +1, offense wins at -1, even matchup at 0. OL contributes {@code passSet} skill and strength /
 * power / agility physical; DL contributes {@code passRushMoves + blockShedding} skill and a mirror
 * physical mix. The scalar shapes how much pressure a QB absorbs.
 *
 * <p>Given a nominal sack, the model redistributes outcome mass toward scramble (QB mobility) and
 * throwaway (QB awareness). Mobility blends physical speed/acceleration/agility (60%) with the
 * dedicated {@code mobility} skill (40%) — the skill axis captures escape instinct distinct from
 * raw athleticism. Awareness blends the {@code processing} tendency (40%) and {@code footballIq}
 * (15%) with the dedicated {@code pocketPresence} skill (45%) — pocket presence is the proxy for
 * sack-vs-throwaway decision quality under pressure. At average attributes and even matchup the
 * redistribution is zero, so the shipped sack rate is preserved by construction.
 *
 * <p>Package-private: the pressure classifier drives sampling; outcome records never see it.
 */
final class QbPressureEscape implements PressureModel {

  private static final double MAX_SCRAMBLE_REDIRECT = 0.55;
  private static final double MAX_THROWAWAY_REDIRECT = 0.55;
  private static final double MOBILITY_COEFFICIENT = 0.80;
  private static final double AWARENESS_COEFFICIENT = 0.80;
  private static final double PRESSURE_PENALTY = 0.35;

  @Override
  public PressureResolution resolve(PassRoles roles, Player qb, RandomSource rng) {
    var pressure = pressureStrength(roles);
    var mobility = qbMobilityEdge(qb);
    var awareness = qbAwarenessEdge(qb.tendencies(), qb.skill());

    var scrambleRedirect =
        clamp(MOBILITY_COEFFICIENT * mobility - PRESSURE_PENALTY * pressure, MAX_SCRAMBLE_REDIRECT);
    var throwawayRedirect =
        clamp(
            AWARENESS_COEFFICIENT * awareness - PRESSURE_PENALTY * pressure,
            MAX_THROWAWAY_REDIRECT);

    var combined = scrambleRedirect + throwawayRedirect;
    if (combined > 0.95) {
      var scale = 0.95 / combined;
      scrambleRedirect *= scale;
      throwawayRedirect *= scale;
    }

    var roll = rng.nextDouble();
    if (roll < scrambleRedirect) {
      return PressureResolution.SCRAMBLE;
    }
    if (roll < scrambleRedirect + throwawayRedirect) {
      return PressureResolution.THROWAWAY;
    }
    return PressureResolution.SACK;
  }

  private static double pressureStrength(PassRoles roles) {
    var blockers = roles.passBlockers();
    var rushers = roles.passRushers();
    if (blockers.isEmpty() && rushers.isEmpty()) {
      return 0.0;
    }
    var olSkill = aggregate(blockers, QbPressureEscape::blockerProtectionSkill);
    var dlSkill =
        aggregate(rushers, p -> (p.skill().passRushMoves() + p.skill().blockShedding()) / 2.0);
    var olPhysical =
        aggregate(
            blockers,
            p -> weightedPhysical(p.physical(), 0.20, 0.35, 0.25, 0.20, 0.0, 0.0, 0.0, 0.0));
    var dlPhysical =
        aggregate(
            rushers,
            p -> weightedPhysical(p.physical(), 0.25, 0.0, 0.0, 0.25, 0.25, 0.10, 0.0, 0.15));
    var skillGap = centered(dlSkill) - centered(olSkill);
    var physicalGap = centered(dlPhysical) - centered(olPhysical);
    return clamp((skillGap + physicalGap) / 2.0, 1.0);
  }

  private static double blockerProtectionSkill(Player p) {
    return p.position() == Position.RB ? p.skill().passProtection() : p.skill().passSet();
  }

  private static double qbMobilityEdge(Physical physical) {
    var raw = (physical.speed() + physical.acceleration() + physical.agility()) / 3.0;
    return centered(raw);
  }

  private static double qbMobilityEdge(Player qb) {
    var physicalEdge = qbMobilityEdge(qb.physical());
    var skillEdge = centered(qb.skill().mobility());
    return 0.60 * physicalEdge + 0.40 * skillEdge;
  }

  private static double qbAwarenessEdge(Tendencies tendencies, Skill skill) {
    var raw =
        0.40 * tendencies.processing()
            + 0.15 * tendencies.footballIq()
            + 0.45 * skill.pocketPresence();
    return centered(raw);
  }

  private static double aggregate(List<Player> players, ToDoubleFunction<Player> score) {
    if (players.isEmpty()) {
      return 50.0;
    }
    var sum = 0.0;
    for (var p : players) {
      sum += score.applyAsDouble(p);
    }
    return sum / players.size();
  }

  private static double weightedPhysical(
      Physical p,
      double speed,
      double acceleration,
      double agility,
      double strength,
      double power,
      double bend,
      double stamina,
      double explosiveness) {
    return p.speed() * speed
        + p.acceleration() * acceleration
        + p.agility() * agility
        + p.strength() * strength
        + p.power() * power
        + p.bend() * bend
        + p.stamina() * stamina
        + p.explosiveness() * explosiveness;
  }

  private static double centered(double zeroToHundred) {
    return (zeroToHundred / 100.0 - 0.5) * 2.0;
  }

  private static double clamp(double value, double limit) {
    if (value > limit) {
      return limit;
    }
    if (value < -limit) {
      return -limit;
    }
    return value;
  }
}
