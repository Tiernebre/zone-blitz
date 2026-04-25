package app.zoneblitz.gamesimulator.fatigue;

import app.zoneblitz.gamesimulator.event.PlayerId;
import app.zoneblitz.gamesimulator.personnel.DefensivePersonnel;
import app.zoneblitz.gamesimulator.personnel.OffensivePersonnel;
import app.zoneblitz.gamesimulator.roster.DefensiveCoachTendencies;
import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import app.zoneblitz.gamesimulator.roster.Team;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Default {@link FatigueModel}. Position-specific snap thresholds drive both the rotation decision
 * and the performance-multiplier curve. Motor moderates the threshold linearly: {@code motor=50}
 * leaves the baseline threshold unchanged; {@code motor=100} extends it 50%; {@code motor=0}
 * shortens it 50%.
 *
 * <p>Real NFL snap-share priors per Big Data Bowl tracking: starting RBs play roughly 55–70% of
 * offensive snaps in committee backfields, with backups taking the rest. Starting interior DLs play
 * roughly 50–65% in rotation-heavy fronts. The constants below approximate that — a 35-snap RB
 * baseline starts committee work in the second half of a typical 60-snap game; the 40-snap DL
 * baseline does the same and the 55-snap LB baseline keeps three-down linebackers on the field
 * almost always.
 */
public final class PositionalFatigueModel implements FatigueModel {

  private static final int RB_BASE_THRESHOLD = 35;
  private static final int DL_BASE_THRESHOLD = 40;
  private static final int LB_BASE_THRESHOLD = 55;
  private static final int FATIGUE_FLOOR = 60;
  private static final double PERFORMANCE_FLOOR = 0.70;

  @Override
  public OffensivePersonnel rotateOffense(
      OffensivePersonnel base, Team offense, Map<PlayerId, Integer> snapCounts) {
    Objects.requireNonNull(base, "base");
    Objects.requireNonNull(offense, "offense");
    Objects.requireNonNull(snapCounts, "snapCounts");
    var onField = base.runningBacks();
    if (onField.isEmpty()) {
      return base;
    }
    var rotated = rotateOut(onField, offense.roster(), snapCounts, Position.RB, Position.FB, 0);
    if (rotated.equals(onField)) {
      return base;
    }
    var newPlayers = replacePlayers(base.players(), onField, rotated);
    return new OffensivePersonnel(base.pkg(), newPlayers);
  }

  @Override
  public DefensivePersonnel rotateDefense(
      DefensivePersonnel base,
      Team defense,
      Map<PlayerId, Integer> snapCounts,
      DefensiveCoachTendencies coach) {
    Objects.requireNonNull(base, "base");
    Objects.requireNonNull(defense, "defense");
    Objects.requireNonNull(snapCounts, "snapCounts");
    Objects.requireNonNull(coach, "coach");
    var thresholdShift = (coach.substitutionAggression() - 50) / 5;
    var dlOn = base.defensiveLine();
    var dlRotated =
        rotateOut(dlOn, defense.roster(), snapCounts, Position.DL, Position.DL, thresholdShift);
    var lbOn = base.linebackers();
    var lbRotated =
        rotateOut(lbOn, defense.roster(), snapCounts, Position.LB, Position.LB, thresholdShift);
    if (dlRotated.equals(dlOn) && lbRotated.equals(lbOn)) {
      return base;
    }
    var afterDl = replacePlayers(base.players(), dlOn, dlRotated);
    var afterLb = replacePlayers(afterDl, lbOn, lbRotated);
    return new DefensivePersonnel(base.pkg(), afterLb);
  }

  @Override
  public double performanceMultiplier(Player player, int snapCount) {
    Objects.requireNonNull(player, "player");
    var threshold = motorAdjustedThreshold(player, snapCount);
    if (snapCount <= threshold) {
      return 1.0;
    }
    var span = Math.max(1, FATIGUE_FLOOR - threshold);
    var over = Math.min(span, snapCount - threshold);
    var fall = (1.0 - PERFORMANCE_FLOOR) * (over / (double) span);
    return 1.0 - fall;
  }

  private static int baseThresholdFor(Position position) {
    return switch (position) {
      case RB, FB -> RB_BASE_THRESHOLD;
      case DL -> DL_BASE_THRESHOLD;
      case LB -> LB_BASE_THRESHOLD;
      default -> Integer.MAX_VALUE;
    };
  }

  private static int motorAdjustedThreshold(Player player, int snapCount) {
    var base = baseThresholdFor(player.position());
    if (base == Integer.MAX_VALUE) {
      return base;
    }
    var motor = player.tendencies().motor();
    var motorShift = (motor - 50) * base / 100;
    return Math.max(1, base + motorShift);
  }

  /**
   * Position-aware rotation. For each on-field player whose snap count exceeds their motor-adjusted
   * threshold, swap in the freshest backup of the same position group not currently on the field.
   * If no backup exists or all backups are equally fatigued (i.e. no real freshness gain), the
   * starter stays in.
   */
  private List<Player> rotateOut(
      List<Player> onField,
      List<Player> roster,
      Map<PlayerId, Integer> snapCounts,
      Position primary,
      Position alternate,
      int thresholdShift) {
    if (onField.isEmpty()) {
      return onField;
    }
    var onFieldIds = new ArrayList<PlayerId>(onField.size());
    for (var p : onField) {
      onFieldIds.add(p.id());
    }
    var result = new ArrayList<>(onField);
    for (var i = 0; i < result.size(); i++) {
      var starter = result.get(i);
      var snaps = snapCounts.getOrDefault(starter.id(), 0);
      var threshold = motorAdjustedThreshold(starter, snaps) + thresholdShift;
      if (snaps <= threshold) {
        continue;
      }
      var backup = freshestBackup(roster, snapCounts, primary, alternate, onFieldIds);
      if (backup.isEmpty()) {
        continue;
      }
      var fresh = backup.get();
      var freshSnaps = snapCounts.getOrDefault(fresh.id(), 0);
      if (freshSnaps >= snaps) {
        continue;
      }
      result.set(i, fresh);
      onFieldIds.set(i, fresh.id());
    }
    return List.copyOf(result);
  }

  private static java.util.Optional<Player> freshestBackup(
      List<Player> roster,
      Map<PlayerId, Integer> snapCounts,
      Position primary,
      Position alternate,
      List<PlayerId> onFieldIds) {
    Player best = null;
    var bestSnaps = Integer.MAX_VALUE;
    for (var p : roster) {
      if (p.position() != primary && p.position() != alternate) {
        continue;
      }
      if (onFieldIds.contains(p.id())) {
        continue;
      }
      var snaps = snapCounts.getOrDefault(p.id(), 0);
      if (snaps < bestSnaps) {
        bestSnaps = snaps;
        best = p;
      }
    }
    return java.util.Optional.ofNullable(best);
  }

  private static List<Player> replacePlayers(
      List<Player> all, List<Player> oldOnes, List<Player> newOnes) {
    if (oldOnes.equals(newOnes)) {
      return all;
    }
    var result = new ArrayList<Player>(all.size());
    var swapIndex = 0;
    for (var p : all) {
      var idx = indexOfId(oldOnes, p.id());
      if (idx >= 0) {
        result.add(newOnes.get(idx));
        swapIndex++;
      } else {
        result.add(p);
      }
    }
    if (swapIndex != oldOnes.size()) {
      throw new IllegalStateException("rotation swap mismatch");
    }
    return List.copyOf(result);
  }

  private static int indexOfId(List<Player> players, PlayerId id) {
    for (var i = 0; i < players.size(); i++) {
      if (players.get(i).id().equals(id)) {
        return i;
      }
    }
    return -1;
  }
}
