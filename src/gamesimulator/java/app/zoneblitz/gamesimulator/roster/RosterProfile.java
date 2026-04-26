package app.zoneblitz.gamesimulator.roster;

import java.util.List;

/**
 * Aggregate attribute strengths for a team's full active roster, snapshotted once per game and
 * threaded into the play callers so on-roster talent nudges call distributions toward the side of
 * the ball where the team is strongest.
 *
 * <p>Both leans sit in {@code [-1, +1]} where {@code 0} is league-average, {@code +1} is
 * saturation, and negative values indicate below-average. With a uniformly average roster every
 * field is {@code 0} and the play callers reproduce their pure tendency-driven baselines — baseline
 * parity is a structural invariant.
 *
 * <ul>
 *   <li>{@code passLean} compares the offense's pass-quality (QB arm/route + WR/TE
 *       route-running/speed) against its run-quality (RB carry/power + OL run-block). Positive
 *       values tilt {@code TendencyPlayCaller} toward more passing, negative toward more running.
 *   <li>{@code pressureLean} reflects the defensive line's pass-rush strength
 *       (passRushMoves/blockShedding). Positive values nudge {@code BaselineDefensiveCallSelector}
 *       toward more blitz looks.
 * </ul>
 */
public record RosterProfile(double passLean, double pressureLean) {

  public RosterProfile {
    requireUnit(passLean, "passLean");
    requireUnit(pressureLean, "pressureLean");
  }

  /** Identity profile — every lean at zero, callers reproduce their tendency-only baselines. */
  public static RosterProfile leagueAverage() {
    return new RosterProfile(0.0, 0.0);
  }

  /**
   * Compute the profile from a team's roster by averaging the relevant attribute axes per position
   * group. Empty position groups contribute zero (no lean) so partial rosters degrade gracefully to
   * the closest-to-neutral interpretation.
   */
  public static RosterProfile of(Team team) {
    var roster = team.roster();
    var passStrength = passOffenseStrength(roster);
    var runStrength = runOffenseStrength(roster);
    var pressureStrength = pressureDefenseStrength(roster);
    var passLean = clampUnit((passStrength - runStrength) / 50.0);
    var pressureLean = clampUnit((pressureStrength - 50.0) / 50.0);
    return new RosterProfile(passLean, pressureLean);
  }

  private static double passOffenseStrength(List<Player> roster) {
    var sum = 0.0;
    var n = 0;
    for (var p : roster) {
      switch (p.position()) {
        case QB -> {
          sum +=
              (p.skill().armStrength() + p.skill().shortAccuracy() + p.skill().deepAccuracy())
                  / 3.0;
          n++;
        }
        case WR, TE -> {
          sum += (p.skill().routeRunning() + p.physical().speed() + p.skill().hands()) / 3.0;
          n++;
        }
        default -> {
          // not a passing-game contributor
        }
      }
    }
    return n == 0 ? 50.0 : sum / n;
  }

  private static double runOffenseStrength(List<Player> roster) {
    var sum = 0.0;
    var n = 0;
    for (var p : roster) {
      switch (p.position()) {
        case RB, FB -> {
          sum +=
              (p.skill().ballCarrierVision() + p.skill().breakTackle() + p.physical().power())
                  / 3.0;
          n++;
        }
        case OL -> {
          sum += (p.skill().runBlock() + p.physical().strength() + p.physical().power()) / 3.0;
          n++;
        }
        default -> {
          // not a running-game contributor
        }
      }
    }
    return n == 0 ? 50.0 : sum / n;
  }

  private static double pressureDefenseStrength(List<Player> roster) {
    var sum = 0.0;
    var n = 0;
    for (var p : roster) {
      if (p.position() == Position.DL) {
        sum +=
            (p.skill().passRushMoves() + p.skill().blockShedding() + p.physical().strength()) / 3.0;
        n++;
      }
    }
    return n == 0 ? 50.0 : sum / n;
  }

  private static double clampUnit(double value) {
    return Math.max(-1.0, Math.min(1.0, value));
  }

  private static void requireUnit(double value, String name) {
    if (value < -1.0 || value > 1.0) {
      throw new IllegalArgumentException(name + " must be in [-1, +1], got " + value);
    }
  }
}
