package app.zoneblitz.gamesimulator.personnel;

import app.zoneblitz.gamesimulator.GameState;
import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.formation.OffensiveFormation;
import app.zoneblitz.gamesimulator.playcalling.PlayCaller;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Attribute- and situation-aware {@link PersonnelSelector}. Default returns are {@link
 * OffensivePackage#P_11} and {@link DefensivePackage#BASE_43} — the league-modal looks — and the
 * selector deviates only when the called formation, situation (down/distance/yard line), or roster
 * shape strongly justifies it.
 *
 * <p>Three signals shape the choice:
 *
 * <ul>
 *   <li><b>Called formation</b> — JUMBO formation prefers a six-OL/two-TE personnel package; EMPTY
 *       formation prefers a four-WR (P_10/P_00) package.
 *   <li><b>Situation</b> — short-yardage near the goal line tilts toward heavy packages; 3rd/4th
 *       and very-long tilts toward DIME on defense and lighter offensive packages.
 *   <li><b>Roster attributes</b> — when the TE room outshines the WR room (avg pass-game skill +
 *       run-block + speed), the offense leans toward 12 personnel. When uniform, the selector
 *       collapses back to P_11. This keeps calibration tests with all-50 (or all-90 / all-30)
 *       rosters byte-equivalent on the modal package — the relative-strength check stays at zero.
 * </ul>
 *
 * <p>Roster sufficiency is checked before any deviation: if the roster lacks a sixth healthy OL or
 * a second healthy TE, the selector falls back to P_11 silently rather than throwing — the baseline
 * always remains constructible.
 */
public final class BaselinePersonnelSelector implements PersonnelSelector {

  private static final int SHORT_YARDAGE = 2;
  private static final int LONG_YARDAGE = 11;
  private static final int GOAL_LINE_YARDS = 96;
  private static final double TE_BIAS_THRESHOLD = 8.0;

  @Override
  public OffensivePersonnel selectOffense(PlayCaller.PlayCall call, GameState state, Team offense) {
    Objects.requireNonNull(call, "call");
    Objects.requireNonNull(state, "state");
    Objects.requireNonNull(offense, "offense");
    var injured = Set.copyOf(state.injuredPlayers());
    var pkg = pickOffensivePackage(call, state, offense, injured);
    return buildOffense(pkg, offense, injured);
  }

  @Override
  public DefensivePersonnel selectDefense(
      PlayCaller.PlayCall call, OffensivePersonnel offense, GameState state, Team defense) {
    Objects.requireNonNull(call, "call");
    Objects.requireNonNull(offense, "offense");
    Objects.requireNonNull(state, "state");
    Objects.requireNonNull(defense, "defense");
    var injured = Set.copyOf(state.injuredPlayers());
    var pkg = pickDefensivePackage(call, offense, state, defense, injured);
    return buildDefense(pkg, defense, injured);
  }

  private static OffensivePackage pickOffensivePackage(
      PlayCaller.PlayCall call, GameState state, Team offense, Set<PlayerId> injured) {
    var dd = state.downAndDistance();
    var goalLine = state.spot().yardLine() >= GOAL_LINE_YARDS;
    var shortYardage = dd.yardsToGo() <= SHORT_YARDAGE;
    var thirdAndVeryLong = dd.down() >= 3 && dd.yardsToGo() >= LONG_YARDAGE;

    if (call.formation() == OffensiveFormation.JUMBO) {
      var preferred =
          goalLine && shortYardage
              ? List.of(
                  OffensivePackage.JUMBO_6OL_22,
                  OffensivePackage.JUMBO_6OL_13,
                  OffensivePackage.P_22,
                  OffensivePackage.P_12)
              : List.of(
                  OffensivePackage.JUMBO_6OL_13,
                  OffensivePackage.JUMBO_6OL_22,
                  OffensivePackage.P_12);
      var pick = firstAvailable(preferred, offense, injured);
      if (pick != null) {
        return pick;
      }
    }

    if (call.formation() == OffensiveFormation.EMPTY) {
      var preferred = List.of(OffensivePackage.P_10, OffensivePackage.P_01, OffensivePackage.P_00);
      var pick = firstAvailable(preferred, offense, injured);
      if (pick != null) {
        return pick;
      }
    }

    if (goalLine && shortYardage) {
      var pick =
          firstAvailable(
              List.of(OffensivePackage.P_22, OffensivePackage.P_12, OffensivePackage.P_21),
              offense,
              injured);
      if (pick != null) {
        return pick;
      }
    }

    if (thirdAndVeryLong && call.formation() != OffensiveFormation.I_FORM) {
      var pick =
          firstAvailable(List.of(OffensivePackage.P_10, OffensivePackage.P_11), offense, injured);
      if (pick != null) {
        return pick;
      }
    }

    if (rosterTilt(offense) > TE_BIAS_THRESHOLD
        && hasEnoughHealthy(offense, Position.TE, 2, injured)) {
      return OffensivePackage.P_12;
    }

    return OffensivePackage.P_11;
  }

  private static DefensivePackage pickDefensivePackage(
      PlayCaller.PlayCall call,
      OffensivePersonnel offense,
      GameState state,
      Team defense,
      Set<PlayerId> injured) {
    var dd = state.downAndDistance();
    var goalLine = state.spot().yardLine() >= GOAL_LINE_YARDS;
    var shortYardage = dd.yardsToGo() <= SHORT_YARDAGE;
    var thirdAndVeryLong = dd.down() >= 3 && dd.yardsToGo() >= LONG_YARDAGE;
    var thirdAndLong = dd.down() >= 3 && dd.yardsToGo() >= 7;

    if (goalLine && shortYardage) {
      var pick =
          firstAvailableDefense(
              List.of(
                  DefensivePackage.GOAL_LINE_551,
                  DefensivePackage.GOAL_LINE_641,
                  DefensivePackage.GOAL_LINE_632,
                  DefensivePackage.BASE_43),
              defense,
              injured);
      if (pick != null) {
        return pick;
      }
    }

    if (thirdAndVeryLong) {
      var pick =
          firstAvailableDefense(
              List.of(
                  DefensivePackage.DIME_416, DefensivePackage.NICKEL_425, DefensivePackage.BASE_43),
              defense,
              injured);
      if (pick != null) {
        return pick;
      }
    }

    if (thirdAndLong) {
      var pick =
          firstAvailableDefense(
              List.of(DefensivePackage.NICKEL_425, DefensivePackage.BASE_43), defense, injured);
      if (pick != null) {
        return pick;
      }
    }

    if (offense.pkg().wrs() >= 4
        && hasEnoughDefensiveBacks(defense, DefensivePackage.NICKEL_425, injured)) {
      return DefensivePackage.NICKEL_425;
    }

    return DefensivePackage.BASE_43;
  }

  /**
   * Tilt toward 12 personnel when the TE room outshines the WR room on receiver-relevant axes.
   * Returns 0 for uniform-attribute rosters; positive when TEs are stronger; negative when WRs are.
   * The threshold ({@link #TE_BIAS_THRESHOLD}) is conservative so calibration rosters with uniform
   * attributes never trigger the deviation.
   */
  private static double rosterTilt(Team offense) {
    var tes = playersAt(offense, Position.TE);
    var wrs = playersAt(offense, Position.WR);
    if (tes.isEmpty() || wrs.isEmpty()) {
      return 0.0;
    }
    var teScore = receiverScore(tes);
    var wrScore = receiverScore(wrs);
    return teScore - wrScore;
  }

  private static double receiverScore(List<Player> players) {
    var sum = 0.0;
    for (var p : players) {
      sum +=
          (p.skill().routeRunning()
                  + p.skill().hands()
                  + p.physical().speed()
                  + p.skill().runBlock())
              / 4.0;
    }
    return sum / players.size();
  }

  private static List<Player> playersAt(Team team, Position position) {
    var list = new ArrayList<Player>();
    for (var p : team.roster()) {
      if (p.position() == position) {
        list.add(p);
      }
    }
    return list;
  }

  private static OffensivePackage firstAvailable(
      List<OffensivePackage> candidates, Team offense, Set<PlayerId> injured) {
    for (var pkg : candidates) {
      if (canBuild(pkg, offense, injured)) {
        return pkg;
      }
    }
    return null;
  }

  private static DefensivePackage firstAvailableDefense(
      List<DefensivePackage> candidates, Team defense, Set<PlayerId> injured) {
    for (var pkg : candidates) {
      if (canBuildDefense(pkg, defense, injured)) {
        return pkg;
      }
    }
    return null;
  }

  private static boolean canBuild(OffensivePackage pkg, Team offense, Set<PlayerId> injured) {
    if (!hasEnoughHealthy(offense, Position.QB, pkg.quarterbacks(), injured)) return false;
    if (!hasEnoughRunningBacks(offense, pkg.rbs(), injured)) return false;
    if (!hasEnoughHealthy(offense, Position.TE, pkg.tes(), injured)) return false;
    if (!hasEnoughHealthy(offense, Position.WR, pkg.wrs(), injured)) return false;
    if (!hasEnoughHealthy(offense, Position.OL, pkg.offensiveLinemen(), injured)) return false;
    return true;
  }

  private static boolean canBuildDefense(
      DefensivePackage pkg, Team defense, Set<PlayerId> injured) {
    if (!hasEnoughHealthy(defense, Position.DL, pkg.defensiveLinemen(), injured)) return false;
    if (!hasEnoughHealthy(defense, Position.LB, pkg.linebackers(), injured)) return false;
    if (!hasEnoughDefensiveBacks(defense, pkg, injured)) return false;
    return true;
  }

  private static boolean hasEnoughHealthy(
      Team team, Position position, int needed, Set<PlayerId> injured) {
    if (needed == 0) return true;
    var count = 0;
    for (var p : team.roster()) {
      if (p.position() == position && !injured.contains(p.id())) {
        count++;
        if (count >= needed) return true;
      }
    }
    return false;
  }

  private static boolean hasEnoughRunningBacks(Team team, int needed, Set<PlayerId> injured) {
    if (needed == 0) return true;
    var count = 0;
    for (var p : team.roster()) {
      if ((p.position() == Position.RB || p.position() == Position.FB)
          && !injured.contains(p.id())) {
        count++;
        if (count >= needed) return true;
      }
    }
    return false;
  }

  private static boolean hasEnoughDefensiveBacks(
      Team team, DefensivePackage pkg, Set<PlayerId> injured) {
    if (pkg.defensiveBacks() == 0) return true;
    var count = 0;
    for (var p : team.roster()) {
      if ((p.position() == Position.CB || p.position() == Position.S)
          && !injured.contains(p.id())) {
        count++;
        if (count >= pkg.defensiveBacks()) return true;
      }
    }
    return false;
  }

  private static OffensivePersonnel buildOffense(
      OffensivePackage pkg, Team offense, Set<PlayerId> injured) {
    var players = new ArrayList<Player>(11);
    addFirstN(offense.roster(), Position.QB, pkg.quarterbacks(), players, injured);
    addRunningBacks(offense.roster(), pkg.rbs(), players, injured);
    addFirstN(offense.roster(), Position.TE, pkg.tes(), players, injured);
    addFirstN(offense.roster(), Position.WR, pkg.wrs(), players, injured);
    addFirstN(offense.roster(), Position.OL, pkg.offensiveLinemen(), players, injured);
    return new OffensivePersonnel(pkg, players);
  }

  private static DefensivePersonnel buildDefense(
      DefensivePackage pkg, Team defense, Set<PlayerId> injured) {
    var players = new ArrayList<Player>(11);
    addFirstN(defense.roster(), Position.DL, pkg.defensiveLinemen(), players, injured);
    addFirstN(defense.roster(), Position.LB, pkg.linebackers(), players, injured);
    addDefensiveBacks(defense.roster(), pkg.defensiveBacks(), players, injured);
    return new DefensivePersonnel(pkg, players);
  }

  private static void addFirstN(
      List<Player> roster, Position position, int count, List<Player> out, Set<PlayerId> injured) {
    var picked = 0;
    for (var p : roster) {
      if (picked == count) {
        return;
      }
      if (p.position() == position && !injured.contains(p.id())) {
        out.add(p);
        picked++;
      }
    }
    if (picked < count) {
      throw new IllegalStateException(
          "Roster has only %d healthy %s; needed %d".formatted(picked, position, count));
    }
  }

  private static void addRunningBacks(
      List<Player> roster, int count, List<Player> out, Set<PlayerId> injured) {
    var picked = 0;
    for (var p : roster) {
      if (picked == count) {
        return;
      }
      if ((p.position() == Position.RB || p.position() == Position.FB)
          && !injured.contains(p.id())) {
        out.add(p);
        picked++;
      }
    }
    if (picked < count) {
      throw new IllegalStateException(
          "Roster has only %d healthy RB/FB; needed %d".formatted(picked, count));
    }
  }

  private static void addDefensiveBacks(
      List<Player> roster, int count, List<Player> out, Set<PlayerId> injured) {
    var picked = 0;
    for (var p : roster) {
      if (picked == count) {
        return;
      }
      if ((p.position() == Position.CB || p.position() == Position.S)
          && !injured.contains(p.id())) {
        out.add(p);
        picked++;
      }
    }
    if (picked < count) {
      throw new IllegalStateException(
          "Roster has only %d healthy DB; needed %d".formatted(picked, count));
    }
  }
}
