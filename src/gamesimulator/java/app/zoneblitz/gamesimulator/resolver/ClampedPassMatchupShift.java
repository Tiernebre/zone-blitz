package app.zoneblitz.gamesimulator.resolver;

import app.zoneblitz.gamesimulator.roster.Physical;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.List;
import java.util.function.ToDoubleFunction;

/**
 * Role-based pass-matchup shift with physical-fit clamping.
 *
 * <p>Follows the formula from the design doc (lines 214-232):
 *
 * <pre>
 *   physical_gap = off_physical_score(role) − def_physical_score(role)
 *   floor        = −1 + 0.5 × max(0, physical_gap)
 *   ceiling      = +1 + 0.5 × min(0, physical_gap)
 *   m            = clamp(off_skill_aggregate − def_skill_aggregate, floor, ceiling)
 * </pre>
 *
 * <p>Physical gap creates the window; skill delta moves within it. This is the math that rules out
 * an OL covering a 4.3 WR via maxed coverage skill: the floor rises with the offense's physical
 * advantage, preventing any defensive skill pool from dragging the matchup back below it.
 *
 * <p>Returns a single scalar combining the coverage clamp and the pass-rush clamp. R3 collapsed
 * coverage into one aggregate — per-receiver matchups land in R5. Tendency levers (composure,
 * football IQ, processing, …) will modulate the clamped {@code m} once the corresponding downstream
 * models land; this class only honors the attribute fields R4 ships.
 */
public final class ClampedPassMatchupShift implements MatchupPassResolver.PassMatchupShift {

  @Override
  public double compute(Roles roles, Team offense, Team defense) {
    var coverage =
        clampedDelta(
            aggregate(roles.routeRunners(), SkillAxis.ROUTE::score),
            aggregate(roles.coverageDefenders(), SkillAxis.COVERAGE::score),
            aggregatePhysical(roles.routeRunners(), PhysicalRole.ROUTE),
            aggregatePhysical(roles.coverageDefenders(), PhysicalRole.COVERAGE));
    var passRush =
        clampedDelta(
            aggregate(roles.passRushers(), SkillAxis.PASS_RUSH::score),
            aggregate(roles.passBlockers(), SkillAxis.PASS_BLOCK::score),
            aggregatePhysical(roles.passRushers(), PhysicalRole.PASS_RUSH),
            aggregatePhysical(roles.passBlockers(), PhysicalRole.PASS_BLOCK));

    return coverage - passRush;
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
    ROUTE {
      @Override
      double score(Physical p) {
        return center(
            (p.speed() * 35 + p.acceleration() * 25 + p.agility() * 20 + p.explosiveness() * 20)
                / 100.0);
      }
    },
    COVERAGE {
      @Override
      double score(Physical p) {
        return center(
            (p.speed() * 35 + p.acceleration() * 25 + p.agility() * 25 + p.explosiveness() * 15)
                / 100.0);
      }
    },
    PASS_RUSH {
      @Override
      double score(Physical p) {
        return center(
            (p.strength() * 25
                    + p.power() * 25
                    + p.speed() * 20
                    + p.bend() * 15
                    + p.explosiveness() * 15)
                / 100.0);
      }
    },
    PASS_BLOCK {
      @Override
      double score(Physical p) {
        return center(
            (p.strength() * 30 + p.power() * 30 + p.agility() * 20 + p.stamina() * 20) / 100.0);
      }
    };

    abstract double score(Physical physical);
  }

  /**
   * Per-role skill axis. Multi-attribute axes average the raw 0–100 values before centering to
   * {@code [-1, +1]} so every axis sits in the same scalar space as the physical window.
   */
  private enum SkillAxis {
    ROUTE {
      @Override
      double score(Player player) {
        var s = player.skill();
        return center((s.routeRunning() + s.hands()) / 2.0);
      }
    },
    COVERAGE {
      @Override
      double score(Player player) {
        return center(player.skill().coverageTechnique());
      }
    },
    PASS_RUSH {
      @Override
      double score(Player player) {
        var s = player.skill();
        return center((s.passRushMoves() + s.blockShedding()) / 2.0);
      }
    },
    PASS_BLOCK {
      @Override
      double score(Player player) {
        return center(player.skill().passSet());
      }
    };

    abstract double score(Player player);
  }
}
