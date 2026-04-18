package app.zoneblitz.gamesimulator.personnel;

import app.zoneblitz.gamesimulator.roster.Player;
import app.zoneblitz.gamesimulator.roster.Position;
import java.util.List;
import java.util.Objects;

/**
 * The 11 offensive players on the field for a single snap, together with the {@link
 * OffensivePackage} grouping that describes their position mix. The compact constructor rejects any
 * player list that violates the package's expected counts, so downstream resolvers can read {@link
 * #quarterback()}, {@link #runningBacks()}, {@link #tightEnds()}, {@link #receivers()}, and {@link
 * #offensiveLine()} without re-validating anything.
 *
 * <p>Running backs count fullbacks in with halfbacks ({@link Position#RB} + {@link Position#FB});
 * the NFL naming convention treats them identically. Specialists ({@link Position#K}, {@link
 * Position#P}, {@link Position#LS}) never appear on a scrimmage snap and are rejected outright.
 */
public record OffensivePersonnel(OffensivePackage pkg, List<Player> players) {

  public OffensivePersonnel {
    Objects.requireNonNull(pkg, "pkg");
    Objects.requireNonNull(players, "players");
    if (players.size() != 11) {
      throw new IllegalArgumentException(
          "Offensive personnel must have exactly 11 players; got " + players.size());
    }
    players = List.copyOf(players);
    validate(pkg, players);
  }

  public Player quarterback() {
    return players.stream()
        .filter(p -> p.position() == Position.QB)
        .findFirst()
        .orElseThrow(() -> new IllegalStateException("Offensive personnel missing a quarterback"));
  }

  public List<Player> runningBacks() {
    return players.stream()
        .filter(p -> p.position() == Position.RB || p.position() == Position.FB)
        .toList();
  }

  public List<Player> tightEnds() {
    return filterByPosition(Position.TE);
  }

  public List<Player> receivers() {
    return filterByPosition(Position.WR);
  }

  public List<Player> offensiveLine() {
    return filterByPosition(Position.OL);
  }

  private List<Player> filterByPosition(Position position) {
    return players.stream().filter(p -> p.position() == position).toList();
  }

  private static void validate(OffensivePackage pkg, List<Player> players) {
    var qbs = 0;
    var rbs = 0;
    var tes = 0;
    var wrs = 0;
    var ol = 0;
    for (var p : players) {
      switch (p.position()) {
        case QB -> qbs++;
        case RB, FB -> rbs++;
        case TE -> tes++;
        case WR -> wrs++;
        case OL -> ol++;
        default ->
            throw new IllegalArgumentException(
                "Offensive personnel contains ineligible position "
                    + p.position()
                    + " for player "
                    + p.displayName());
      }
    }
    require(pkg, "QB", pkg.quarterbacks(), qbs);
    require(pkg, "RB", pkg.rbs(), rbs);
    require(pkg, "TE", pkg.tes(), tes);
    require(pkg, "WR", pkg.wrs(), wrs);
    require(pkg, "OL", pkg.offensiveLinemen(), ol);
  }

  private static void require(OffensivePackage pkg, String label, int expected, int actual) {
    if (expected != actual) {
      throw new IllegalArgumentException(
          "%s personnel requires %d %s; got %d".formatted(pkg.name(), expected, label, actual));
    }
  }
}
