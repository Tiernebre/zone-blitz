package app.zoneblitz.gamesimulator.resolver.run;

import app.zoneblitz.gamesimulator.resolver.RunRoles;
import app.zoneblitz.gamesimulator.roster.Physical;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.List;
import java.util.Optional;
import java.util.function.ToDoubleFunction;

/**
 * Role-based run-matchup shift with physical-fit clamping, mirroring {@code
 * ClampedPassMatchupShift}.
 *
 * <p>Formula per axis:
 *
 * <pre>
 *   physical_gap = off_physical_score(role) − def_physical_score(role)
 *   floor        = −1 + 0.5 × max(0, physical_gap)
 *   ceiling      = +1 + 0.5 × min(0, physical_gap)
 *   m            = clamp(off_skill_aggregate − def_skill_aggregate, floor, ceiling)
 * </pre>
 *
 * <p>Two clamped deltas feed the result: the blocking delta (run blockers vs. run defenders) and
 * the carrier delta (ball carrier vs. run defenders). The offense-is-positive sign convention
 * matches the pass side — a positive shift biases outcome sampling toward {@code NORMAL} (vs.
 * {@code FUMBLE}) and pushes yardage percentile draws upward.
 *
 * <p>Defenders sit on both the blocking and carrier legs — that's intentional: front seven
 * performance determines both block defeat at the LOS and the downhill tackle. Duplication is the
 * cost of collapsing the fit/tackle split; a future assigner that separates first-level from
 * second-level defenders can un-collapse without changing this class's shape.
 */
public final class ClampedRunMatchupShift implements MatchupRunResolver.RunMatchupShift {

  @Override
  public double compute(RunRoles roles, Team offense, Team defense) {
    var blocking =
        clampedDelta(
            aggregate(roles.runBlockers(), SkillAxis.RUN_BLOCK::score),
            aggregate(roles.runDefenders(), SkillAxis.RUN_DEFENSE::score),
            aggregatePhysical(roles.runBlockers(), PhysicalRole.RUN_BLOCK),
            aggregatePhysical(roles.runDefenders(), PhysicalRole.RUN_DEFENSE));
    var carrier =
        clampedDelta(
            aggregate(asList(roles.ballCarrier()), SkillAxis.CARRY::score),
            aggregate(roles.runDefenders(), SkillAxis.RUN_DEFENSE::score),
            aggregatePhysical(asList(roles.ballCarrier()), PhysicalRole.CARRY),
            aggregatePhysical(roles.runDefenders(), PhysicalRole.RUN_DEFENSE));

    return blocking + carrier;
  }

  private static List<Player> asList(Optional<Player> player) {
    return player.map(List::of).orElse(List.of());
  }

  private static double clampedDelta(
      double offSkill, double defSkill, double offPhys, double defPhys) {
    var gap = offPhys - defPhys;
    var floor = -1.0 + 0.5 * Math.max(0.0, gap);
    var ceiling = 1.0 + 0.5 * Math.min(0.0, gap);
    var raw = offSkill - defSkill;
    return Math.max(floor, Math.min(ceiling, raw));
  }

  private static double aggregate(List<Player> players, ToDoubleFunction<Player> scorer) {
    if (players.isEmpty()) {
      return 0.0;
    }
    var sum = 0.0;
    for (var p : players) {
      sum += scorer.applyAsDouble(p);
    }
    return sum / players.size();
  }

  private static double aggregatePhysical(List<Player> players, PhysicalRole role) {
    return aggregate(players, p -> role.score(p.physical()));
  }

  private static double center(double value) {
    return (value / 100.0 - 0.5) * 2.0;
  }

  /**
   * Per-role physical weighting. Weights are percentage points that sum to 100; the resulting
   * weighted score is re-centered so an all-50 player scores 0 and an all-100 player scores +1.
   */
  private enum PhysicalRole {
    CARRY {
      @Override
      double score(Physical p) {
        return center(
            (p.speed() * 25
                    + p.agility() * 25
                    + p.explosiveness() * 20
                    + p.power() * 15
                    + p.strength() * 15)
                / 100.0);
      }
    },
    RUN_BLOCK {
      @Override
      double score(Physical p) {
        return center(
            (p.strength() * 30 + p.power() * 30 + p.agility() * 20 + p.stamina() * 20) / 100.0);
      }
    },
    RUN_DEFENSE {
      @Override
      double score(Physical p) {
        return center(
            (p.strength() * 25
                    + p.power() * 20
                    + p.speed() * 20
                    + p.agility() * 20
                    + p.explosiveness() * 15)
                / 100.0);
      }
    };

    abstract double score(Physical physical);
  }

  /**
   * Per-role skill axis. Multi-attribute axes average the raw 0–100 values before centering to
   * {@code [-1, +1]} so every axis sits in the same scalar space as the physical window.
   */
  private enum SkillAxis {
    CARRY {
      @Override
      double score(Player player) {
        var s = player.skill();
        return center((s.ballCarrierVision() + s.breakTackle()) / 2.0);
      }
    },
    RUN_BLOCK {
      @Override
      double score(Player player) {
        return center(player.skill().runBlock());
      }
    },
    RUN_DEFENSE {
      @Override
      double score(Player player) {
        var s = player.skill();
        return center((s.tackling() + s.blockShedding()) / 2.0);
      }
    };

    abstract double score(Player player);
  }
}
